import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getDashboardSummary, getOrders, updateStatus, collectPayment, getActiveTables, collectAllForTable } from '../api/orders'
import { getRevenueTrend, getTopDishes } from '../api/reports'
import { getInventory } from '../api/inventory'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { TrendingUp, ShoppingBag, Receipt, LayoutGrid, CreditCard } from 'lucide-react'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import Spinner from '../components/ui/Spinner'
import { formatINR, statusColor } from '../utils'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'

const TREND_DAYS = { '7D': 7, '30D': 30, '90D': 90 }

function KpiCard({ label, value, icon: Icon, color, delay }) {
  return (
    <Card className="animate-fadeUp" style={{ animationDelay: delay }}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] font-bold uppercase tracking-wide text-muted">{label}</p>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center"
             style={{ background: `var(--${color}-dim)` }}>
          <Icon size={15} style={{ color: `var(--${color})` }} />
        </div>
      </div>
      <p className="font-display font-black text-2xl" style={{ color: `var(--${color})` }}>{value ?? '—'}</p>
    </Card>
  )
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-border rounded-lg p-2.5 shadow-md text-xs">
      <p className="font-semibold text-text mb-0.5">{label}</p>
      <p className="text-green font-bold">{formatINR(payload[0]?.value)}</p>
    </div>
  )
}

export default function Dashboard() {
  const [trendRange, setTrendRange] = useState('7D')
  const [payModal,   setPayModal]   = useState(null)
  const [tableModal,  setTableModal]  = useState(null) // table number string
  const [tableOrder,  setTableOrder]  = useState(null) // loaded order for that table
  const [tableLoading, setTableLoading] = useState(false)
  const qc = useQueryClient()
  const navigate = useNavigate()

  const { data: summary }   = useQuery({ queryKey: ['summary'],   queryFn: getDashboardSummary, refetchInterval: 5000 })
  const { data: trend }     = useQuery({ queryKey: ['trend', trendRange], queryFn: () => getRevenueTrend(TREND_DAYS[trendRange]) })
  const { data: topDishes } = useQuery({ queryKey: ['topDishes'], queryFn: () => getTopDishes('today') })
  const { data: liveOrders } = useQuery({ queryKey: ['orders', 'live'], queryFn: () => getOrders({ limit: 50 }), refetchInterval: 5000 })
  const { data: inventory } = useQuery({ queryKey: ['inventory'], queryFn: () => getInventory({}) })

  const payMut = useMutation({
    mutationFn: ({ id, method }) => collectPayment(id, { payment_method: method, discount_percent: 0 }),
    onSuccess: () => {
      toast.success('✅ Payment collected!')
      qc.invalidateQueries({ queryKey: ['orders'] })
      qc.invalidateQueries({ queryKey: ['summary'] })
      setPayModal(null)
    },
    onError: e => toast.error(String(e)),
  })

  const statusMut = useMutation({
    mutationFn: ({ id, status }) => updateStatus(id, status),
    onSuccess: () => {
      toast.success('Order updated!')
      qc.invalidateQueries({ queryKey: ['orders'] })
      qc.invalidateQueries({ queryKey: ['summary'] })
    },
    onError: e => toast.error(String(e)),
  })

  const { data: activeTables } = useQuery({ queryKey: ['activeTables'], queryFn: getActiveTables, refetchInterval: 5000 })

  const loadTableOrder = (tableNum) => {
    const tableData = (activeTables || []).find(t => String(t.table_number) === String(tableNum))
    if (!tableData) { toast.error(`No active order for Table ${tableNum}`); return }
    setTableModal(tableNum)
    setTableOrder(tableData)
  }



  const collectAllMut = useMutation({
    mutationFn: ({ table, method }) => collectAllForTable(table, { payment_method: method, discount_percent: 0 }),
    onSuccess: (data) => {
      toast.success(`✅ ${data.message}`)
      qc.invalidateQueries({ queryKey: ['orders'] })
      qc.invalidateQueries({ queryKey: ['activeTables'] })
      qc.invalidateQueries({ queryKey: ['summary'] })
      setTableModal(null); setTableOrder(null)
    },
    onError: e => toast.error(String(e)),
  })

  const lowStock  = (inventory || []).filter(i => i.is_low_stock)
  const chartData = (trend || []).map(d => ({
    name: new Date(d.date).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit' }),
    revenue: d.revenue,
  }))

  // Build table status from live orders — only today's unpaid dine-in orders
  const today = new Date().toDateString()
  const tableStatusMap = {}
  ;(liveOrders || [])
    .filter(o =>
      o.order_type === 'dine_in' &&
      o.payment_status !== 'paid' &&
      o.status !== 'cancelled' &&
      o.table_number &&
      new Date(o.created_at).toDateString() === today
    )
    .forEach(o => { tableStatusMap[o.table_number] = o })

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Today's Revenue" value={formatINR(summary?.today_revenue)} icon={TrendingUp}  color="green"  delay=".05s" />
        <KpiCard label="Total Orders"    value={summary?.today_orders}             icon={ShoppingBag} color="orange" delay=".1s"  />
        <KpiCard label="Avg Bill"        value={formatINR(summary?.avg_bill)}      icon={Receipt}     color="blue"   delay=".15s" />
        <KpiCard label="Active Tables"   value={Object.keys(tableStatusMap).length || 0} icon={LayoutGrid}  color="amber"  delay=".2s"  />
      </div>

      {/* Mid row */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Chart */}
        <Card className="lg:col-span-3 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-display font-bold text-sm text-text">Revenue Trend</h3>
              <p className="text-xs text-muted">Dine-in + Delivery</p>
            </div>
            <div className="flex gap-1 bg-surface2 p-1 rounded-lg">
              {Object.keys(TREND_DAYS).map(r => (
                <button key={r} onClick={() => setTrendRange(r)}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${trendRange===r ? 'bg-surface text-text shadow-sm' : 'text-muted hover:text-text'}`}>
                  {r}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 min-h-[160px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                barSize={trendRange==='7D'?28:trendRange==='30D'?10:22}
                margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
                barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 0" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis
                  tickFormatter={v => v >= 1000 ? `₹${(v/1000).toFixed(1)}K` : `₹${v}`}
                  tick={{ fill: 'var(--muted)', fontSize: 11 }}
                  axisLine={false} tickLine={false} width={45}
                  domain={[0, dataMax => Math.ceil((dataMax * 1.2) / 100) * 100]}
                  tickCount={4}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--surface2)' }} />
                <Bar dataKey="revenue" fill="var(--green)" radius={[5,5,0,0]} fillOpacity={0.85} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Live orders */}
        <Card className="lg:col-span-2 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display font-bold text-sm text-text">Live Orders</h3>
            <div className="flex items-center gap-2">
              <Badge color="green" dot>Live</Badge>
              <button onClick={() => navigate('/orders')}
                className="text-[11px] text-green2 font-semibold hover:underline">
                View all →
              </button>
            </div>
          </div>
          <div className="space-y-2 overflow-y-auto flex-1">
            {!liveOrders && <div className="flex justify-center py-4"><Spinner /></div>}
            {(liveOrders || []).filter(o => o.status !== 'cancelled').slice(0, 8).map(o => (
              <div key={o.id} className="p-2.5 bg-surface2 rounded-lg hover:bg-surface3 transition-colors">
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-text">{o.order_number}</p>
                    <p className="text-[10px] text-muted">
                      {o.order_type === 'delivery' ? o.platform || 'Delivery' : `Dine-in${o.table_number ? ' · T'+o.table_number : ''}`}
                    </p>
                  </div>
                  <p className="text-xs font-bold text-text flex-shrink-0">{formatINR(o.total_amount)}</p>
                  <Badge color={statusColor(o.status)}>{o.status.replace('_',' ')}</Badge>
                </div>

                {/* Collect payment for unpaid orders */}
                {o.payment_status !== 'paid' && o.status !== 'cancelled' && (
                  <div className="mt-2 pt-2 border-t border-border">
                    <Button variant="primary" size="xs" icon={<CreditCard size={11}/>}
                      className="w-full justify-center"
                      onClick={() => setPayModal(o)}>
                      Collect Payment
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Inventory alerts */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display font-bold text-sm text-text">Inventory Alerts</h3>
            {lowStock.length > 0 && <Badge color="orange">{lowStock.length} low</Badge>}
          </div>
          <div className="space-y-2.5">
            {(inventory || []).slice(0,5).map(item => {
              const pct = Math.min(100, Math.round(item.quantity / Math.max(item.min_quantity*2,1)*100))
              return (
                <div key={item.id}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-text2 font-medium">{item.name}</span>
                    <span className={item.is_low_stock ? 'text-orange font-bold' : 'text-green font-bold'}>
                      {item.quantity} {item.unit}{item.is_low_stock ? ' ⚠' : ''}
                    </span>
                  </div>
                  <div className="h-1.5 bg-surface2 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all"
                      style={{ width: pct+'%', background: item.is_low_stock ? 'var(--orange)' : 'var(--green)' }} />
                  </div>
                </div>
              )
            })}
          </div>
        </Card>

        {/* Top dishes */}
        <Card>
          <h3 className="font-display font-bold text-sm text-text mb-3">Top Dishes Today</h3>
          <div className="space-y-2.5">
            {(topDishes || []).slice(0,6).map((d, i) => {
              const max = topDishes[0]?.quantity || 1
              return (
                <div key={d.name} className="flex items-center gap-2.5">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${i===0 ? 'bg-amber-dim text-amber' : 'bg-surface2 text-muted'}`}>{i+1}</span>
                  <p className="flex-1 text-xs text-text2 font-medium truncate">{d.name}</p>
                  <span className="text-xs font-bold text-text">{d.quantity}x</span>
                  <div className="w-14 h-1.5 bg-surface2 rounded-full overflow-hidden">
                    <div className="h-full bg-green rounded-full" style={{ width: Math.round(d.quantity/max*100)+'%' }} />
                  </div>
                </div>
              )
            })}
          </div>
        </Card>


        {/* Table map */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display font-bold text-sm text-text">Table Map</h3>
            <p className="text-xs text-muted">
              {Object.keys(tableStatusMap).length} occupied
            </p>
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {Array.from({length:16},(_,i) => {
              const tNum = String(i + 1)
              const order = tableStatusMap[tNum]
              const s = !order ? 'free'
                : order.payment_status === 'paid' ? 'free'
                : order.status === 'pending' ? 'pending'
                : order.status === 'kot_sent' || order.status === 'preparing' ? 'occ'
                : order.status === 'ready' || order.status === 'served' ? 'bill'
                : 'free'
              return (
                <div key={i}
                  title={order ? `${order.order_number} · ₹${order.total_amount}` : `Table ${tNum} — Free`}
                  onClick={() => order && loadTableOrder(tNum)}
                  className={`aspect-square rounded-lg flex flex-col items-center justify-center text-[10px] font-bold transition-all hover:scale-105 ${order ? 'cursor-pointer' : 'cursor-default'} ${
                    s==='occ'     ? 'bg-red-dim text-red border border-red/20' :
                    s==='bill'    ? 'bg-orange-dim text-orange border border-orange/20' :
                    s==='pending' ? 'bg-red-dim text-red border border-red/20' :
                    'bg-green-dim text-green2 border border-green/20'
                  }`}>
                  <span>T{i+1}</span>
                  <span className="text-[8px] mt-0.5">
                    {s==='occ'?'Active':s==='bill'?'Ready':s==='pending'?'KOT':'Free'}
                  </span>
                </div>
              )
            })}
          </div>
          <div className="flex gap-3 mt-3 pt-3 border-t border-border flex-wrap">
            {[['bg-green-dim text-green2 border-green/20','Free'],['bg-red-dim text-red border-red/20','Active'],['bg-orange-dim text-orange border-orange/20','Ready']].map(([cls,lbl]) => (
              <div key={lbl} className="flex items-center gap-1.5">
                <div className={`w-3 h-3 rounded border ${cls}`} />
                <span className="text-[10px] text-muted">{lbl}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Table modal */}
      <Modal open={!!tableModal} onClose={() => { setTableModal(null); setTableOrder(null) }}
        title={`🪑 Table ${tableModal}`} size="lg">
        {tableOrder ? (
          <div className="space-y-4">
            {tableOrder.customer_name && (
              <p className="text-xs text-muted">👤 {tableOrder.customer_name}</p>
            )}

            {/* All items across all orders for this table */}
            <div className="space-y-1">
              {tableOrder.orders?.map(o => (
                <div key={o.id}>
                  <p className="text-[10px] text-muted uppercase font-bold tracking-wide py-1">{o.order_number} · {o.status.replace('_',' ')}</p>
                  {(() => {
                    // Group same items together
                    const grouped = []
                    o.items.forEach(item => {
                      const ex = grouped.find(g => g.name === item.name && g.price === item.price)
                      if (ex) { ex.quantity += item.quantity; ex.total += item.total; ex.ids.push(item.id) }
                      else grouped.push({ ...item, ids: [item.id] })
                    })
                    return grouped.map((item, i) => (
                      <div key={i} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-text">{item.name}</p>
                          <p className="text-xs text-muted">₹{item.price} × {item.quantity}</p>
                        </div>
                        <p className="font-bold text-sm text-green2">{formatINR(item.total)}</p>
                      </div>
                    ))
                  })()}
                </div>
              ))}
            </div>

            {/* Actions */}
            <Button variant="primary" className="w-full justify-center"
              onClick={() => { setTableModal(null); setTableOrder(null); navigate('/orders') }}>
              View in Orders →
            </Button>
          </div>
        ) : (
          <p className="text-center text-muted py-8">No active order found</p>
        )}
      </Modal>

      {/* Pay modal */}
      <Modal open={!!payModal} onClose={() => setPayModal(null)} title="💳 Collect Payment">
        {payModal && (
          <div className="text-center py-4">
            <p className="text-sm text-muted mb-1">{payModal.order_number}</p>
            <p className="font-display font-black text-4xl text-green2">{formatINR(payModal.total_amount)}</p>
            <p className="text-sm text-muted mt-1">Including GST</p>
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
    </div>
  )
}