import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getOrders, createOrder, updateStatus, collectPayment } from '../api/orders'
import { getMenuItems } from '../api/menu'
import toast from 'react-hot-toast'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import Modal from '../components/ui/Modal'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import Spinner from '../components/ui/Spinner'
import EmptyState from '../components/ui/EmptyState'
import { Plus, Phone, RefreshCw, ChevronDown, Bike, X, Trash2 } from 'lucide-react'
import { formatINR, timeAgo } from '../utils'
import { getNotifPrefs } from '../utils/notifPrefs'

function playAlertSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.setValueAtTime(880, ctx.currentTime)
    osc.frequency.setValueAtTime(660, ctx.currentTime + 0.12)
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.24)
    gain.gain.setValueAtTime(0.4, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.45)
  } catch {}
}

const PLATFORMS = [
  { id: 'zomato',   label: 'Zomato',   color: 'red',   emoji: '🔴' },
  { id: 'swiggy',   label: 'Swiggy',   color: 'orange',emoji: '🟠' },
  { id: 'whatsapp', label: 'WhatsApp', color: 'green', emoji: '💬' },
]

const DELIVERY_STATUS = ['pending','kot_sent','preparing','ready','out_for_delivery','delivered','cancelled']
const STATUS_LABELS = {
  pending:           'Pending',
  kot_sent:          'Accepted',
  preparing:         'Preparing',
  ready:             'Ready',
  out_for_delivery:  'Out for Delivery',
  delivered:         'Delivered',
  cancelled:         'Cancelled',
}
const STATUS_COLOR = {
  pending:          'orange',
  kot_sent:         'blue',
  preparing:        'blue',
  ready:            'green',
  out_for_delivery: 'purple',
  delivered:        'green',
  cancelled:        'red',
}

const PAY_ICONS = { cash:'💵', upi:'📱', card:'💳', online:'🌐' }

export default function OnlineOrders() {
  const qc = useQueryClient()
  const [platformFilter, setPlatformFilter] = useState('')
  const [statusFilter,   setStatusFilter]   = useState('')
  const [newOrderModal,  setNewOrderModal]  = useState(false)
  const [expandedId,     setExpandedId]     = useState(null)
  const [collectModal,   setCollectModal]   = useState(null)

  // New order form state
  const [platform,       setPlatform]       = useState('whatsapp')
  const [customerName,   setCustomerName]   = useState('')
  const [customerPhone,  setCustomerPhone]  = useState('')
  const [address,        setAddress]        = useState('')
  const [cartItems,      setCartItems]      = useState([]) // [{id,name,price,qty}]
  const [itemSearch,     setItemSearch]     = useState('')
  const [payMethod,      setPayMethod]      = useState('online')

  const refetchAll = () => {
    qc.invalidateQueries({ queryKey: ['onlineOrders'] })
    qc.invalidateQueries({ queryKey: ['summary'] })
    qc.invalidateQueries({ queryKey: ['orders'] })
  }

  const { data: orders, isLoading, refetch } = useQuery({
    queryKey: ['onlineOrders', platformFilter, statusFilter],
    queryFn: () => getOrders({ order_type: 'delivery', limit: 100 }),
    refetchInterval: 15000,
  })

  const { data: menuItems } = useQuery({
    queryKey: ['menuItems'],
    queryFn: () => getMenuItems({ active_only: true }),
  })

  // Detect new pending orders and play alert sound
  const knownPendingIds = useRef(null)
  useEffect(() => {
    if (!orders) return
    const pendingIds = new Set(orders.filter(o => o.status === 'pending').map(o => o.id))
    if (knownPendingIds.current === null) { knownPendingIds.current = pendingIds; return }
    let hasNew = false
    pendingIds.forEach(id => { if (!knownPendingIds.current.has(id)) hasNew = true })
    if (hasNew && getNotifPrefs().orderAlert) {
      playAlertSound()
      toast('🛵 New order received!', { icon: '🔔', duration: 6000 })
    }
    knownPendingIds.current = pendingIds
  }, [orders])

  // Filter client-side
  const filtered = (orders || []).filter(o => {
    if (platformFilter && o.platform !== platformFilter) return false
    if (statusFilter   && o.status   !== statusFilter)   return false
    return true
  })

  // Counts
  const counts = {
    pending:   (orders||[]).filter(o => o.status === 'pending').length,
    active:    (orders||[]).filter(o => ['kot_sent','preparing'].includes(o.status)).length,
    delivery:  (orders||[]).filter(o => o.status === 'out_for_delivery').length,
  }

  const statusMut = useMutation({
    mutationFn: ({ id, status }) => updateStatus(id, status),
    onSuccess: () => { toast.success('Updated!'); refetchAll() },
    onError: e => toast.error(String(e)),
  })

  const collectMut = useMutation({
    mutationFn: ({ id, method }) => collectPayment(id, { payment_method: method, discount_percent: 0 }),
    onSuccess: () => { toast.success('✅ Payment collected!'); refetchAll(); setCollectModal(null) },
    onError: e => toast.error(String(e)),
  })

  const createMut = useMutation({
    mutationFn: async () => {
      if (!cartItems.length) throw new Error('Add at least one item')
      if (!customerName)    throw new Error('Customer name required')
      if (!customerPhone)   throw new Error('Customer phone required')

      const order = await createOrder({
        order_type:    'delivery',
        platform:      platform,
        customer_name: customerName,
        customer_phone: customerPhone,
        notes:         address ? `Delivery to: ${address}` : null,
        discount_percent: 0,
        items: cartItems.map(i => ({ menu_item_id: i.id, name: i.name, price: i.price, quantity: i.qty })),
      })
      // Auto-accept
      await updateStatus(order.id, 'kot_sent')
      return order
    },
    onSuccess: (order) => {
      toast.success(`✅ Order created — #${order.order_number}`)
      refetchAll()
      setNewOrderModal(false)
      resetForm()
    },
    onError: e => toast.error(String(e)),
  })

  const resetForm = () => {
    setPlatform('phone'); setCustomerName(''); setCustomerPhone('')
    setAddress(''); setCartItems([]); setItemSearch(''); setPayMethod('online')
  }

  const addToCart = (item) => {
    setCartItems(prev => {
      const ex = prev.find(i => i.id === item.id)
      if (ex) return prev.map(i => i.id === item.id ? { ...i, qty: i.qty + 1 } : i)
      return [...prev, { id: item.id, name: item.name, price: item.price, qty: 1 }]
    })
  }

  const removeFromCart = (id) => setCartItems(prev => prev.filter(i => i.id !== id))

  const cartTotal = cartItems.reduce((s, i) => s + i.price * i.qty, 0)
  const cartGst   = Math.round(cartTotal * 0.05)

  const filteredMenu = (menuItems || []).filter(m =>
    !itemSearch || m.name.toLowerCase().includes(itemSearch.toLowerCase())
  )

  return (
    <div className="space-y-4">
      {/* Header KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted mb-1">New Orders</p>
          <p className="font-display font-black text-2xl text-orange">{counts.pending}</p>
        </Card>
        <Card>
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted mb-1">In Kitchen</p>
          <p className="font-display font-black text-2xl text-blue">{counts.active}</p>
        </Card>
        <Card>
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted mb-1">Out for Delivery</p>
          <p className="font-display font-black text-2xl text-purple">{counts.delivery}</p>
        </Card>
      </div>

      {/* Filters + New Order */}
      <div className="flex flex-wrap gap-2 items-center">
        {/* Platform filters */}
        <div className="flex gap-1.5 flex-wrap">
          <button onClick={() => setPlatformFilter('')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
              !platformFilter ? 'bg-green-dim border-green/30 text-green2' : 'border-border2 bg-surface2 text-text2 hover:border-green'}`}>
            All Platforms
          </button>
          {PLATFORMS.map(p => (
            <button key={p.id} onClick={() => setPlatformFilter(platformFilter === p.id ? '' : p.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                platformFilter === p.id ? 'bg-green-dim border-green/30 text-green2' : 'border-border2 bg-surface2 text-text2 hover:border-green'}`}>
              {p.emoji} {p.label}
            </button>
          ))}
        </div>

        <div className="flex gap-2 ml-auto">
          <select className="bg-surface border border-border rounded-lg px-3 py-1.5 text-sm outline-none focus:border-green cursor-pointer"
            value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">All Status</option>
            {DELIVERY_STATUS.filter(s => s !== 'cancelled').map(s => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
          <Button variant="secondary" size="sm" icon={<RefreshCw size={13}/>} onClick={() => refetch()}>Refresh</Button>
          <Button variant="primary" size="sm" icon={<Plus size={13}/>} onClick={() => { resetForm(); setNewOrderModal(true) }}>
            New Order
          </Button>
        </div>
      </div>

      {/* Orders list */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Spinner size="lg"/></div>
      ) : filtered.length === 0 ? (
        <EmptyState icon="🛵" title="No delivery orders yet"
          description="Orders from Zomato, Swiggy, WhatsApp and phone calls will appear here" />
      ) : (
        <div className="space-y-2">
          {filtered.map(order => {
            const platform = PLATFORMS.find(p => p.id === order.platform)
            const isNew    = order.status === 'pending'
            return (
              <Card key={order.id} className={`overflow-hidden transition-all ${isNew ? 'border-orange/40 shadow-sm' : ''}`}>
                <div className="flex items-center gap-3 flex-wrap">
                  {/* Platform badge */}
                  <div className="flex-shrink-0 text-xl">{platform?.emoji || '📦'}</div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-display font-bold text-sm text-text">{order.order_number}</p>
                      <Badge color={STATUS_COLOR[order.status] || 'gray'}>
                        {STATUS_LABELS[order.status] || order.status}
                      </Badge>
                      {platform && <Badge color={platform.color}>{platform.label}</Badge>}
                      {order.payment_status === 'paid' && (
                        <Badge color="green">
                          {PAY_ICONS[order.payment_method]} {order.payment_method?.toUpperCase()}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted mt-0.5">
                      {order.customer_name && `👤 ${order.customer_name}`}
                      {order.customer_phone && ` · 📞 ${order.customer_phone}`}
                      {' · '}{timeAgo(order.created_at)}
                      {order.notes && ` · ${order.notes}`}
                    </p>
                  </div>

                  <p className="font-display font-black text-base text-text">{formatINR(order.total_amount)}</p>

                  {/* Actions */}
                  <div className="flex gap-1.5 flex-shrink-0">
                    {/* New order — Accept/Reject */}
                    {order.status === 'pending' && (
                      <>
                        <Button variant="primary" size="xs"
                          onClick={() => statusMut.mutate({ id: order.id, status: 'kot_sent' })}>
                          ✓ Accept
                        </Button>
                        <Button variant="danger" size="xs"
                          onClick={() => { if(confirm('Reject this order?')) statusMut.mutate({ id: order.id, status: 'cancelled' }) }}>
                          ✕ Reject
                        </Button>
                      </>
                    )}

                    {/* Active — status dropdown */}
                    {!['pending','cancelled','delivered'].includes(order.status) && (
                      <select
                        className="bg-surface2 border border-border2 rounded-lg px-2 py-1 text-xs outline-none focus:border-green cursor-pointer"
                        value={order.status}
                        onChange={e => statusMut.mutate({ id: order.id, status: e.target.value })}>
                        {DELIVERY_STATUS.filter(s => !['pending','cancelled'].includes(s)).map(s => (
                          <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                        ))}
                      </select>
                    )}

                    {/* Collect payment */}
                    {order.payment_status !== 'paid' && order.status !== 'cancelled' && order.status !== 'pending' && (
                      <Button variant="primary" size="xs"
                        onClick={() => setCollectModal(order)}>
                        Collect
                      </Button>
                    )}

                    {/* Expand */}
                    <button onClick={() => setExpandedId(expandedId === order.id ? null : order.id)}
                      className="p-1.5 rounded-lg hover:bg-surface2 text-muted hover:text-text transition-colors">
                      <ChevronDown size={14} className={`transition-transform ${expandedId === order.id ? 'rotate-180' : ''}`}/>
                    </button>
                  </div>
                </div>

                {/* Expanded items */}
                {expandedId === order.id && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <table className="w-full text-xs">
                      <tbody>
                        {(order.items || []).map(item => (
                          <tr key={item.id} className="border-b border-border last:border-0">
                            <td className="py-1.5 text-text2 font-medium">{item.name}</td>
                            <td className="py-1.5 text-center text-muted">×{item.quantity}</td>
                            <td className="py-1.5 text-right font-bold text-text">{formatINR(item.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="flex justify-between text-xs text-muted mt-2 pt-2 border-t border-border">
                      <span>GST: {formatINR(order.gst_amount)}</span>
                      <span className="font-bold text-green2">Total: {formatINR(order.total_amount)}</span>
                    </div>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {/* ── NEW ORDER MODAL ───────────────────────────────────────────────── */}
      <Modal open={newOrderModal} onClose={() => setNewOrderModal(false)} title="🛵 New Delivery Order" size="xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Left — customer + platform */}
          <div className="space-y-3">
            <div>
              <p className="text-xs font-bold text-text2 mb-2">Order Source</p>
              <div className="grid grid-cols-3 gap-1.5">
                {PLATFORMS.map(p => (
                  <button key={p.id} onClick={() => setPlatform(p.id)}
                    className={`py-2 px-1 rounded-lg text-xs font-semibold border transition-all text-center ${
                      platform === p.id
                        ? 'bg-green-dim border-green/30 text-green2'
                        : 'bg-surface2 border-border text-text2 hover:border-green'
                    }`}>
                    {p.emoji} {p.label}
                  </button>
                ))}
              </div>
            </div>

            <Input label="Customer Name *" placeholder="e.g. Priya Sharma"
              value={customerName} onChange={e => setCustomerName(e.target.value)} />
            <Input label="Phone Number *" placeholder="+91 98765 43210"
              value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} />
            <Input label="Delivery Address" placeholder="Full address"
              value={address} onChange={e => setAddress(e.target.value)} />

            <Select label="Payment Method" value={payMethod} onChange={e => setPayMethod(e.target.value)}>
              <option value="online">🌐 Online / Prepaid</option>
              <option value="cash">💵 Cash on Delivery</option>
              <option value="upi">📱 UPI on Delivery</option>
            </Select>

            {/* Cart summary */}
            {cartItems.length > 0 && (
              <div className="bg-surface2 rounded-xl p-3 space-y-2">
                <p className="text-xs font-bold text-text2">Order Items</p>
                {cartItems.map(item => (
                  <div key={item.id} className="flex items-center gap-2">
                    <p className="flex-1 text-xs text-text">{item.name} ×{item.qty}</p>
                    <p className="text-xs font-bold text-green2">{formatINR(item.price * item.qty)}</p>
                    <button onClick={() => removeFromCart(item.id)}
                      className="text-muted hover:text-red transition-colors"><X size={12}/></button>
                  </div>
                ))}
                <div className="border-t border-border pt-2 flex justify-between text-xs font-bold">
                  <span>Total (incl. GST)</span>
                  <span className="text-green2">{formatINR(cartTotal + cartGst)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Right — menu search */}
          <div className="space-y-2">
            <p className="text-xs font-bold text-text2">Add Items</p>
            <input
              className="w-full bg-surface2 border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-green"
              placeholder="🔍 Search menu..."
              value={itemSearch} onChange={e => setItemSearch(e.target.value)}
            />
            <div className="overflow-y-auto space-y-1" style={{ maxHeight: 320 }}>
              {filteredMenu.map(item => (
                <button key={item.id} onClick={() => addToCart(item)}
                  className="w-full flex items-center gap-2.5 p-2 rounded-lg hover:bg-green-dim hover:border-green/30 border border-transparent transition-all text-left">
                  <span className="text-base flex-shrink-0">{item.emoji}</span>
                  <span className="flex-1 text-sm text-text font-medium">{item.name}</span>
                  <span className="text-xs font-bold text-green2 flex-shrink-0">{formatINR(item.price)}</span>
                  <Plus size={14} className="text-muted flex-shrink-0"/>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-2 mt-4 pt-4 border-t border-border">
          <Button variant="secondary" className="flex-1 justify-center" onClick={() => setNewOrderModal(false)}>Cancel</Button>
          <Button variant="primary" className="flex-1 justify-center" loading={createMut.isPending}
            onClick={() => createMut.mutate()}>
            Create & Accept Order
          </Button>
        </div>
      </Modal>

      {/* ── COLLECT PAYMENT MODAL ─────────────────────────────────────────── */}
      <Modal open={!!collectModal} onClose={() => setCollectModal(null)} title="💳 Collect Payment">
        {collectModal && (
          <div className="text-center py-4">
            <p className="text-sm text-muted mb-1">{collectModal.order_number}</p>
            <p className="font-display font-black text-4xl text-green2">{formatINR(collectModal.total_amount)}</p>
            <p className="text-sm text-muted mt-1">Including GST</p>
            <div className="flex gap-2 justify-center mt-6">
              {[['cash','💵 Cash'],['upi','📱 UPI'],['card','💳 Card'],['online','🌐 Online']].map(([m, l]) => (
                <Button key={m} variant="secondary" loading={collectMut.isPending}
                  onClick={() => collectMut.mutate({ id: collectModal.id, method: m })}>
                  {l}
                </Button>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}