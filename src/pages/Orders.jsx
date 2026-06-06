import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getOrders, updateStatus, collectPayment } from '../api/orders'
import { getProfile } from '../api/auth'
import toast from 'react-hot-toast'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import Modal from '../components/ui/Modal'
import Spinner from '../components/ui/Spinner'
import EmptyState from '../components/ui/EmptyState'
import { formatINR, statusColor } from '../utils'
import { CreditCard, RefreshCw, X, ChevronDown, Printer } from 'lucide-react'
import ReceiptView, { printReceipt } from '../components/ui/ReceiptView'

const STATUS_LABELS = { pending:'Pending', kot_sent:'KOT Sent', preparing:'Preparing', ready:'Ready', served:'Served', paid:'Paid', cancelled:'Cancelled' }

const FILTERS = [
  { key: '',        label: 'All',    statuses: [] },
  { key: 'active',  label: 'Active', statuses: ['pending','kot_sent','preparing'] },
  { key: 'ready',   label: 'Ready',  statuses: ['ready','served'] },
  { key: 'paid',    label: 'Paid',   statuses: ['paid'] },
]
const PAY_ICONS = { cash:'💵', upi:'📱', card:'💳', print:'🖨️' }

export default function Orders() {
  const qc = useQueryClient()
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter,   setTypeFilter]   = useState('')
  const [payModal,     setPayModal]     = useState(null)
  const [receiptModal, setReceiptModal] = useState(null)
  const [expandedId,   setExpandedId]  = useState(null)

  const { data: orders, isLoading, refetch } = useQuery({
    queryKey: ['orders', statusFilter, typeFilter],
    queryFn: () => {
      return getOrders({
        limit: 200,
        ...(typeFilter ? { order_type: typeFilter } : {}),
      })
    },
    refetchInterval: 15000,
  })

  const { data: profile } = useQuery({ queryKey: ['profile'], queryFn: getProfile })

  const statusMut = useMutation({
    mutationFn: ({ id, status }) => updateStatus(id, status),
    onSuccess: () => { toast.success('Order updated!'); qc.invalidateQueries({ queryKey: ['orders'] }); qc.invalidateQueries({ queryKey: ['summary'] }); qc.invalidateQueries({ queryKey: ['orders', 'live'] }) },
    onError: e => toast.error(String(e)),
  })

  const payMut = useMutation({
    mutationFn: ({ id, method }) => collectPayment(id, { payment_method: method, discount_percent: 0 }),
    onSuccess: (paidOrder) => {
      toast.success('✅ Payment collected!')
      qc.invalidateQueries({ queryKey: ['orders'] })
      qc.invalidateQueries({ queryKey: ['orders', 'live'] })
      qc.invalidateQueries({ queryKey: ['summary'] })
      const orderForReceipt = { ...payModal, ...paidOrder }
      setPayModal(null)
      if (window.electronAPI?.printBill) {
        window.electronAPI.printBill({ restaurant: { name: profile?.restaurant_name, phone: profile?.phone, address: profile?.address, city: profile?.city, gstin: profile?.gstin, fssai: profile?.fssai, gst_rate: profile?.gst_rate, show_gst_breakup: profile?.show_gst_breakup }, order: orderForReceipt })
      } else {
        setReceiptModal(orderForReceipt)
      }
    },
    onError: e => toast.error(String(e)),
  })

  const counts = (orders || []).reduce((acc, o) => { acc[o.status] = (acc[o.status] || 0) + 1; return acc }, {})

  const activeFilter = FILTERS.find(f => f.key === statusFilter)
  const filteredOrders = (orders || []).filter(o => {
    if (!activeFilter || !activeFilter.statuses.length) return true
    return activeFilter.statuses.includes(o.status)
  })

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h2 className="font-display font-bold text-base text-text">All Orders</h2>
          <p className="text-xs text-muted">{filteredOrders.length} orders</p>
        </div>
        <div className="flex gap-2 ml-auto flex-wrap">
          <select className="bg-surface border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-green cursor-pointer"
            value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
            <option value="">All Types</option>
            <option value="dine_in">Dine-in</option>
            <option value="takeaway">Takeaway</option>
            <option value="delivery">Delivery</option>
          </select>
          <Button variant="secondary" size="sm" icon={<RefreshCw size={13}/>} onClick={() => refetch()}>Refresh</Button>
        </div>
      </div>

      {/* Simplified filters */}
      <div className="flex gap-2 flex-wrap">
        {FILTERS.map(f => {
          const count = f.statuses.reduce((s, st) => s + (counts[st] || 0), 0)
          return (
            <button key={f.key} onClick={() => setStatusFilter(f.key)}
              className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                statusFilter === f.key
                  ? 'bg-green-dim border-green/30 text-green2'
                  : 'border-border2 bg-surface2 text-text2 hover:border-green hover:text-green'
              }`}>
              {f.label}{count > 0 && f.key ? ` · ${count}` : ''}
            </button>
          )
        })}
      </div>

      {/* Orders */}
      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : filteredOrders.length === 0 ? (
        <EmptyState icon="📋" title="No orders found" description="Orders will appear here once created" />
      ) : (
        <div className="space-y-2">
          {filteredOrders.map(order => (
            <Card key={order.id} className="overflow-hidden">
              {/* Main row */}
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-display font-bold text-sm text-text">{order.order_number}</p>
                    <Badge color={statusColor(order.status)}>{STATUS_LABELS[order.status]}</Badge>
                    <Badge color={order.payment_status === 'paid' ? 'green' : 'orange'}>
                      {order.payment_status === 'paid'
                        ? `${PAY_ICONS[order.payment_method] || '💳'} ${order.payment_method?.toUpperCase() || 'PAID'}`
                        : 'Unpaid'}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted mt-0.5">
                    {order.order_type === 'dine_in' ? `Dine-in${order.table_number ? ' · Table '+order.table_number : ''}` : order.order_type?.replace('_',' ')}
                    {order.customer_name ? ` · ${order.customer_name}` : ''}
                    {' · '}{new Date(order.created_at).toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' })}
                  </p>
                </div>

                <p className="font-display font-black text-base text-text">{formatINR(order.total_amount)}</p>

                <div className="flex gap-1.5 flex-shrink-0">
                  {/* Print receipt */}
                  <Button variant="secondary" size="xs" icon={<Printer size={11}/>}
                    onClick={() => setReceiptModal(order)}>
                    Receipt
                  </Button>

                  {/* Pay button */}
                  {order.payment_status !== 'paid' && order.status !== 'cancelled' && (
                    <Button variant="primary" size="xs" icon={<CreditCard size={11}/>}
                      onClick={() => setPayModal(order)}>
                      Collect
                    </Button>
                  )}

                  {/* Status dropdown */}
                  {order.status !== 'paid' && order.status !== 'cancelled' && (
                    <select
                      className="bg-surface2 border border-border2 rounded-lg px-2 py-1 text-xs outline-none focus:border-green cursor-pointer"
                      value={order.status}
                      onChange={e => statusMut.mutate({ id: order.id, status: e.target.value })}>
                      {['kot_sent','preparing','ready','served'].map(s => (
                        <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                      ))}
                    </select>
                  )}

                  {/* Cancel */}
                  {order.status !== 'cancelled' && order.payment_status !== 'paid' && (
                    <Button variant="danger" size="xs" icon={<X size={11}/>}
                      onClick={() => { if(confirm('Cancel this order?')) statusMut.mutate({ id: order.id, status: 'cancelled' }) }}>
                      Cancel
                    </Button>
                  )}

                  {/* Expand */}
                  <button onClick={() => setExpandedId(expandedId === order.id ? null : order.id)}
                    className="p-1.5 rounded-lg hover:bg-surface2 text-muted hover:text-text transition-colors">
                    <ChevronDown size={14} className={`transition-transform ${expandedId === order.id ? 'rotate-180' : ''}`} />
                  </button>
                </div>
              </div>

              {/* Expanded detail */}
              {expandedId === order.id && (
                <div className="mt-3 pt-3 border-t border-border">
                  <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-muted">
                        <th className="text-left pb-1.5">Item</th>
                        <th className="text-center pb-1.5">Qty</th>
                        <th className="text-right pb-1.5">Price</th>
                        <th className="text-right pb-1.5">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(order.items || []).filter(item => !item.cancelled_at).map(item => (
                        <tr key={item.id} className="border-t border-border">
                          <td className="py-1.5 text-text2 font-medium">{item.name}</td>
                          <td className="py-1.5 text-center text-muted">×{item.quantity}</td>
                          <td className="py-1.5 text-right text-muted">₹{item.price}</td>
                          <td className="py-1.5 text-right font-bold text-text">₹{item.total}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                  <div className="flex justify-between items-end mt-3 pt-2 border-t border-border flex-wrap gap-2">
                    <div className="text-xs text-muted space-y-0.5">
                      <div>GST: {formatINR(order.gst_amount)}</div>
                      {order.discount_amount > 0 && <div>Discount: -{formatINR(order.discount_amount)}</div>}
                      {order.payment_method && (
                        <div className="text-green2 font-semibold">
                          Paid via {PAY_ICONS[order.payment_method]} {order.payment_method?.toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="font-display font-black text-base text-green2">
                      Total: {formatINR(order.total_amount)}
                    </div>
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Pay modal */}
      <Modal open={!!payModal} onClose={() => setPayModal(null)} title="💳 Collect Payment">
        {payModal && (
          <div className="text-center py-4">
            <p className="text-sm text-muted mb-1">{payModal.order_number}</p>
            <p className="font-display font-black text-4xl text-green2">{formatINR(payModal.total_amount)}</p>
            <p className="text-xs text-muted mt-1">GST included: {formatINR(payModal.gst_amount)}</p>
            {payModal.discount_amount > 0 && (
              <p className="text-xs text-orange mt-0.5">Discount applied: -{formatINR(payModal.discount_amount)}</p>
            )}
            <div className="flex gap-2 justify-center mt-6">
              {[['cash','💵 Cash'],['upi','📱 UPI'],['card','💳 Card']].map(([m, l]) => (
                <Button key={m} variant="secondary" loading={payMut.isPending}
                  onClick={() => payMut.mutate({ id: payModal.id, method: m })}>
                  {l}
                </Button>
              ))}
            </div>
          </div>
        )}
      </Modal>

      {/* Receipt modal */}
      <Modal open={!!receiptModal} onClose={() => setReceiptModal(null)} title="🧾 Receipt">
        {receiptModal && (
          <div>
            <ReceiptView order={receiptModal} profile={profile} />
            <div className="flex gap-2 justify-center mt-4 pt-4 border-t border-border">
              <Button variant="primary" icon={<Printer size={14}/>} onClick={printReceipt}>
                Print Receipt
              </Button>
              <Button variant="secondary" onClick={() => setReceiptModal(null)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}