import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getMenuItems, getCategories } from '../api/menu'
import { createOrder, addItemsToOrder, collectPayment, updateStatus, getActiveTables } from '../api/orders'
import { getProfile } from '../api/auth'
import { lookupCustomer, createCustomer } from '../api/customers'
import { useCartStore } from '../store/cart'
import toast from 'react-hot-toast'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import Modal from '../components/ui/Modal'
import { Plus, Minus, Trash2, UtensilsCrossed, Send, Printer } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { formatINR } from '../utils'
import { clsx } from 'clsx'

const PAY_ICONS = { cash: '💵', upi: '📱', card: '💳' }

// ── Receipt (thermal-style) ────────────────────────────────────────────────────
function ReceiptView({ order, profile }) {
  const r = profile || {}
  return (
    <div id="billing-receipt" style={{ fontFamily: 'monospace', fontSize: 13, maxWidth: 320, margin: '0 auto', padding: 16 }}>
      <div style={{ textAlign: 'center', marginBottom: 12 }}>
        <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 900, fontSize: 22, color: '#16a34a' }}>
          {r.restaurant_name || 'BillByte Restaurant'}
        </div>
        {r.address && <div style={{ fontSize: 11, color: '#78716c', marginTop: 2 }}>{r.address}</div>}
        {r.city    && <div style={{ fontSize: 11, color: '#78716c' }}>{r.city}</div>}
        {r.phone   && <div style={{ fontSize: 11, color: '#78716c' }}>{r.phone}</div>}
        {r.gstin   && <div style={{ fontSize: 11, color: '#78716c', marginTop: 2 }}>GSTIN: {r.gstin}</div>}
        {r.fssai   && <div style={{ fontSize: 11, color: '#78716c' }}>FSSAI: {r.fssai}</div>}
      </div>

      <div style={{ borderTop: '1px dashed #d4cec6', margin: '8px 0' }} />

      <div style={{ fontSize: 11, color: '#78716c', marginBottom: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Order #</span><span style={{ color: '#1c1917', fontWeight: 700 }}>{order.order_number}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Date</span>
          <span>{new Date(order.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Time</span>
          <span>{new Date(order.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
        {order.table_number && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Table</span><span>{order.table_number}</span>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Type</span><span style={{ textTransform: 'capitalize' }}>{order.order_type?.replace('_', ' ')}</span>
        </div>
        {order.customer_name && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Customer</span><span>{order.customer_name}</span>
          </div>
        )}
        {order.payment_method && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Payment</span>
            <span style={{ textTransform: 'uppercase', fontWeight: 700, color: '#16a34a' }}>
              {PAY_ICONS[order.payment_method]} {order.payment_method}
            </span>
          </div>
        )}
      </div>

      <div style={{ borderTop: '1px dashed #d4cec6', margin: '8px 0' }} />

      <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ color: '#78716c', fontSize: 10 }}>
            <th style={{ textAlign: 'left', paddingBottom: 4 }}>Item</th>
            <th style={{ textAlign: 'center', paddingBottom: 4 }}>Qty</th>
            <th style={{ textAlign: 'right', paddingBottom: 4 }}>Price</th>
            <th style={{ textAlign: 'right', paddingBottom: 4 }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {(() => {
            const grouped = []
            ;(order.items || []).forEach(item => {
              const ex = grouped.find(g => g.name === item.name && g.price === item.price)
              if (ex) { ex.quantity += item.quantity; ex.total += item.total }
              else grouped.push({ ...item })
            })
            return grouped.map((item, i) => (
              <tr key={i}>
                <td style={{ paddingBottom: 3, color: '#1c1917' }}>{item.name}</td>
                <td style={{ textAlign: 'center', color: '#78716c' }}>×{item.quantity}</td>
                <td style={{ textAlign: 'right', color: '#78716c' }}>₹{item.price}</td>
                <td style={{ textAlign: 'right', fontWeight: 600, color: '#1c1917' }}>₹{item.total}</td>
              </tr>
            ))
          })()}
        </tbody>
      </table>

      <div style={{ borderTop: '1px dashed #d4cec6', margin: '8px 0' }} />

      <div style={{ fontSize: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#78716c', marginBottom: 2 }}>
          <span>Subtotal</span><span>₹{order.subtotal}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#78716c', marginBottom: 2 }}>
          <span>GST ({r.gst_rate || 5}%)</span><span>₹{order.gst_amount}</span>
        </div>
        {order.discount_amount > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#ea580c', marginBottom: 2 }}>
            <span>Discount</span><span>-₹{order.discount_amount}</span>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: 15, marginTop: 6, color: '#16a34a' }}>
          <span>TOTAL</span><span>₹{order.total_amount}</span>
        </div>
      </div>

      <div style={{ borderTop: '1px dashed #d4cec6', margin: '12px 0' }} />

      <div style={{ textAlign: 'center', color: '#78716c', fontSize: 11 }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: '#1c1917', marginBottom: 4 }}>Thank you! 🙏</div>
        <div>We hope to see you again soon.</div>
        {r.phone && <div style={{ marginTop: 4 }}>📞 {r.phone}</div>}
        <div style={{ marginTop: 8, fontSize: 10, color: '#a8a29e' }}>Powered by BillByte</div>
      </div>
    </div>
  )
}

function printReceipt() {
  const content = document.getElementById('billing-receipt')
  if (!content) return
  const win = window.open('', '_blank', 'width=400,height=700')
  win.document.write(`<html><head><title>Receipt</title>
    <style>body{margin:0;padding:16px;font-family:monospace;}@media print{body{margin:0}}</style>
    </head><body>${content.innerHTML}</body></html>`)
  win.document.close()
  win.focus()
  setTimeout(() => { win.print(); win.close() }, 300)
}

// ── POS Terminal — full-screen wrapper around the same billing UI ──────────────
export default function POSTerminal() {
  const [search, setSearch]             = useState('')
  const [catFilter, setCatFilter]       = useState('')
  const [payModal, setPayModal]         = useState(false)
  const [receiptModal, setReceiptModal] = useState(null)
  const [foundCustomer, setFoundCustomer] = useState(null)
  const [lookingUp, setLookingUp]       = useState(false)
  const [notFound, setNotFound]         = useState(false)
  const [addCustModal, setAddCustModal] = useState(false)
  const [custName, setCustName]         = useState('')
  const [addingCust, setAddingCust]     = useState(false)
  const [pointsApplied, setPointsApplied] = useState(false)
  const [activeTableView, setActiveTableView] = useState(false)
  const [selectedTable, setSelectedTable]     = useState(null)
  const cart     = useCartStore()
  const qc       = useQueryClient()
  const navigate = useNavigate()
  const subtotal = cart.getSubtotal()
  const gst      = cart.getGst()

  // Clear discount when points are removed
  useEffect(() => {
    if (!pointsApplied) cart.setDiscount(0)
  }, [pointsApplied])

  // Clear points when cart items change
  useEffect(() => {
    if (pointsApplied) { cart.setDiscount(0); setPointsApplied(false) }
  }, [cart.items.length])

  const discount = cart.getDiscount()
  const total    = cart.getTotal()

  const { data: categories }    = useQuery({ queryKey: ['categories'],   queryFn: getCategories })
  const { data: menuItems }     = useQuery({ queryKey: ['menuItems'],    queryFn: () => getMenuItems({ active_only: true }) })
  const { data: profile }       = useQuery({ queryKey: ['profile'],      queryFn: getProfile })
  const { data: activeTables }  = useQuery({ queryKey: ['activeTables'], queryFn: getActiveTables, refetchInterval: 10000 })

  // Sync restaurant GST rate into cart store when profile loads
  useEffect(() => {
    if (profile?.gst_rate) cart.setGstRate(profile.gst_rate)
  }, [profile?.gst_rate])

  const filtered = (menuItems || []).filter(m =>
    (!catFilter || m.category_id === catFilter) &&
    (!search || m.name.toLowerCase().includes(search.toLowerCase()))
  )

  // Auto-lookup customer by phone as cashier types
  useEffect(() => {
    const phone = cart.customerName
    if (!phone || phone.length < 10) { setFoundCustomer(null); setNotFound(false); return }
    const timer = setTimeout(async () => {
      try {
        setLookingUp(true)
        const res = await lookupCustomer(phone)
        setFoundCustomer(res || null)
        setNotFound(!res)
        if (res) cart.setCustomerName(res.phone)
      } catch { setFoundCustomer(null); setNotFound(false) }
      finally { setLookingUp(false) }
    }, 600)
    return () => clearTimeout(timer)
  }, [cart.customerName])

  const submitOrder = useMutation({
    mutationFn: async ({ payMethod, showReceipt }) => {
      const itemsPayload = cart.items.map(i => ({ menu_item_id: i.id, name: i.name, price: i.price, quantity: i.qty }))

      let order
      if (cart.activeOrderId && payMethod === 'kot') {
        order = await addItemsToOrder(cart.activeOrderId, {
          order_type:       cart.orderType,
          table_number:     cart.tableNumber || null,
          discount_percent: 0,
          items:            itemsPayload,
        })
        await updateStatus(order.id, 'kot_sent')
      } else {
        order = await createOrder({
          order_type:       cart.orderType,
          table_number:     cart.tableNumber || null,
          customer_name:    cart.customerName || null,
          discount_percent: cart.discountPercent,
          items:            itemsPayload,
          customer_id:      foundCustomer?.id || null,
        })

        if (payMethod === 'kot') {
          await updateStatus(order.id, 'kot_sent')
        } else {
          await updateStatus(order.id, 'kot_sent')
          const ptsToRedeem = (pointsApplied && foundCustomer?.id)
            ? Math.min(foundCustomer.loyalty_points, Math.floor((order.subtotal || 0) * 10))
            : 0
          await collectPayment(order.id, {
            payment_method:   payMethod,
            discount_percent: cart.discountPercent,
            points_to_redeem: ptsToRedeem,
          })
          order.payment_method = payMethod
        }
      }

      return { order, showReceipt }
    },
    onSuccess: ({ order, showReceipt }) => {
      toast.success(
        order.payment_method
          ? `✅ Payment done — #${order.order_number}`
          : `📋 KOT sent — #${order.order_number}`
      )
      cart.clearCart()
      setFoundCustomer(null)
      setNotFound(false)
      setPointsApplied(false)
      setPayModal(false)
      qc.invalidateQueries({ queryKey: ['orders'] })
      qc.invalidateQueries({ queryKey: ['orders', 'live'] })
      qc.invalidateQueries({ queryKey: ['summary'] })
      qc.invalidateQueries({ queryKey: ['inventory'] })
      qc.invalidateQueries({ queryKey: ['alerts'] })
      qc.invalidateQueries({ queryKey: ['customers'] })
      if (showReceipt) {
        setReceiptModal(order)
      }
      // KOT sent — stay on POS terminal (no redirect)
    },
    onError: (e) => toast.error(String(e)),
  })

  return (
    <div className="h-full flex gap-4 overflow-hidden">

          {/* ACTIVE TABLES SIDEBAR */}
          {activeTableView && (
            <div className="w-60 flex-shrink-0 flex flex-col gap-2 overflow-hidden">
              <div className="flex items-center justify-between flex-shrink-0">
                <h3 className="font-display font-bold text-sm text-text">Active Tables</h3>
                <button onClick={() => { setActiveTableView(false); setSelectedTable(null) }}
                  className="text-xs text-muted hover:text-text transition-colors">✕</button>
              </div>
              <div className="flex-1 overflow-y-auto space-y-2">
                {(activeTables || []).length === 0 ? (
                  <div className="text-center py-8 text-sm text-muted">No active tables</div>
                ) : (activeTables || []).map(table => (
                  <div key={table.table_number}
                    onClick={() => setSelectedTable(selectedTable?.table_number === table.table_number ? null : table)}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      selectedTable?.table_number === table.table_number
                        ? 'bg-green-dim border-green/30'
                        : 'bg-surface2 border-border hover:border-green/30'
                    }`}>
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-display font-bold text-sm text-text">Table {table.table_number}</p>
                      <p className="font-bold text-xs text-green2">{formatINR(table.total_amount)}</p>
                    </div>
                    {table.customer_name && <p className="text-[10px] text-muted mb-1">👤 {table.customer_name}</p>}
                    <p className="text-[10px] text-muted">{table.items_count} items · {table.orders.length} KOT</p>

                    {selectedTable?.table_number === table.table_number && (
                      <div className="mt-2 pt-2 border-t border-border space-y-1">
                        {table.orders.flatMap(o => o.items).map((item, i) => (
                          <div key={i} className="flex justify-between text-[10px] text-text2">
                            <span>{item.name} ×{item.quantity}</span>
                            <span>{formatINR(item.total)}</span>
                          </div>
                        ))}
                        <button
                          onClick={e => {
                            e.stopPropagation()
                            cart.setOrderType('dine_in')
                            cart.setTableNumber(String(table.table_number))
                            const latestOrder = table.orders[0]
                            cart.setActiveOrderId(latestOrder?.id || null)
                            setActiveTableView(false)
                            setSelectedTable(null)
                            toast.success(`Table ${table.table_number} selected — add items and Send KOT`)
                          }}
                          className="w-full mt-2 py-1.5 bg-green text-white text-xs font-bold rounded-lg hover:opacity-90 transition-opacity">
                          + Add More Items
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* LEFT: Menu */}
          <div className="flex-1 flex flex-col gap-3 overflow-hidden min-w-0">
            <Card className="flex-shrink-0">
              <div className="flex gap-2">
                <input
                  className="flex-1 bg-surface2 border border-border rounded-lg px-3 py-2 text-sm outline-none placeholder:text-muted focus:border-green transition-colors"
                  placeholder="🔍  Search menu..."
                  value={search} onChange={e => setSearch(e.target.value)}
                />
                <button
                  onClick={() => { setActiveTableView(v => !v); setSelectedTable(null) }}
                  className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold border transition-all ${
                    activeTableView
                      ? 'bg-green-dim border-green/30 text-green2'
                      : 'bg-surface2 border-border text-text2 hover:border-green hover:text-green'
                  }`}>
                  🪑 Tables
                  {(activeTables || []).length > 0 && (
                    <span className="bg-red text-white text-[9px] rounded-full w-4 h-4 flex items-center justify-center">
                      {(activeTables || []).length}
                    </span>
                  )}
                </button>
              </div>
              <div className="flex gap-1.5 flex-wrap mt-3">
                <button onClick={() => setCatFilter('')}
                  className={clsx('px-3 py-1.5 rounded-full text-xs font-semibold border transition-all',
                    !catFilter ? 'bg-green-dim border-green/30 text-green2' : 'border-border2 bg-surface2 text-text2 hover:border-green hover:text-green')}>
                  All
                </button>
                {(categories || []).map(c => (
                  <button key={c.id} onClick={() => setCatFilter(c.id === catFilter ? '' : c.id)}
                    className={clsx('px-3 py-1.5 rounded-full text-xs font-semibold border transition-all',
                      catFilter === c.id ? 'bg-green-dim border-green/30 text-green2' : 'border-border2 bg-surface2 text-text2 hover:border-green hover:text-green')}>
                    {c.name}
                  </button>
                ))}
              </div>
            </Card>

            <div className="flex-1 overflow-y-auto">
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5">
                {filtered.map(item => (
                  <button key={item.id}
                    onClick={() => cart.addItem({ id: item.id, name: item.name, price: item.price, emoji: item.emoji, cat: item.category_id })}
                    className="bg-surface2 border border-border rounded-xl p-3 text-center hover:border-green/40 hover:bg-green-dim hover:shadow-sm transition-all active:scale-95 cursor-pointer">
                    <div className="text-2xl mb-1.5">{item.emoji}</div>
                    <p className="text-xs font-semibold text-text leading-tight mb-0.5">{item.name}</p>
                    <p className="text-xs font-bold text-green2">₹{item.price}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT: Bill */}
          <div className="w-72 xl:w-80 flex-shrink-0 flex flex-col gap-3 overflow-hidden">
            {/* Order meta */}
            <Card className="flex-shrink-0 space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="font-display font-bold text-sm text-text flex items-center gap-1.5">
                  <UtensilsCrossed size={14} />
                  {cart.activeOrderId ? `Adding to Table ${cart.tableNumber}` : 'Current Bill'}
                </h3>
                <button onClick={() => cart.clearCart()} className="text-xs text-muted hover:text-red transition-colors">Clear</button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Select value={cart.orderType} onChange={e => { cart.setOrderType(e.target.value); cart.setTableNumber('') }}>
                  <option value="dine_in">Dine-in</option>
                  <option value="takeaway">Takeaway</option>
                  <option value="delivery">Delivery</option>
                </Select>
                {cart.orderType === 'dine_in' && (
                  <Select value={cart.tableNumber} onChange={e => cart.setTableNumber(e.target.value)}>
                    <option value="">Table *</option>
                    {Array.from({length:16},(_,i) => <option key={i} value={String(i+1)}>Table {i+1}</option>)}
                  </Select>
                )}
              </div>
              <div className="relative">
                <input
                  className={`w-full bg-bg border rounded-lg px-3 py-1.5 text-sm outline-none transition-all placeholder:text-muted ${
                    foundCustomer ? 'border-green focus:border-green' : 'border-border2 focus:border-green'
                  }`}
                  placeholder="Phone number to link customer"
                  value={cart.customerName}
                  onChange={e => {
                    cart.setCustomerName(e.target.value)
                    setFoundCustomer(null)
                    setNotFound(false)
                    if (pointsApplied) { cart.setDiscount(0); setPointsApplied(false) }
                  }}
                />
                {lookingUp && <p className="text-[10px] text-muted mt-1 animate-pulse">🔍 Looking up customer...</p>}
                {notFound && !lookingUp && cart.customerName.length >= 10 && (
                  <div className="mt-1.5 bg-orange-dim border border-orange/20 rounded-lg px-3 py-2 flex items-center justify-between">
                    <p className="text-xs text-orange font-semibold">No customer found</p>
                    <button
                      className="text-[10px] bg-orange text-white rounded-lg px-2 py-1 font-semibold hover:opacity-90 transition-opacity"
                      onClick={() => { setCustName(''); setAddCustModal(true) }}>
                      + Add New
                    </button>
                  </div>
                )}
                {foundCustomer && (
                  <div className="mt-1.5 bg-green-dim border border-green/20 rounded-lg px-3 py-2 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-green2">✅ {foundCustomer.name}</p>
                      <p className="text-[10px] text-green2">{foundCustomer.loyalty_points} pts available (= ₹{Math.floor(foundCustomer.loyalty_points / 10)} off)</p>
                    </div>
                    {foundCustomer.loyalty_points >= 100 && (
                      pointsApplied ? (
                        <button
                          className="text-[10px] bg-red text-white rounded-lg px-2 py-1 font-semibold hover:opacity-90 transition-colors"
                          onClick={() => { cart.setDiscount(0); setPointsApplied(false) }}>
                          Remove Points
                        </button>
                      ) : (
                        <button
                          className="text-[10px] bg-green text-white rounded-lg px-2 py-1 font-semibold hover:opacity-90 transition-colors"
                          onClick={() => {
                            const sub = cart.getSubtotal()
                            if (sub === 0) { toast.error('Add items first'); return }
                            const ptsToUse = Math.min(foundCustomer.loyalty_points, Math.floor(sub * 10))
                            const discountRupees = Math.floor(ptsToUse / 10)
                            const discPct = Math.floor((discountRupees / sub) * 100)
                            cart.setDiscount(discPct)
                            setPointsApplied(true)
                            toast.success(`🎁 ${ptsToUse} points applied = ₹${discountRupees} off!`)
                          }}>
                          Apply Points
                        </button>
                      )
                    )}
                  </div>
                )}
              </div>
            </Card>

            {/* Cart items */}
            <Card className="flex-1 overflow-y-auto flex flex-col gap-2">
              {cart.items.length === 0 ? (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-sm text-muted text-center py-8">Add items from the menu</p>
                </div>
              ) : (
                cart.items.map(item => (
                  <div key={item.id} className="flex items-center gap-2 p-2.5 bg-surface2 rounded-lg">
                    <span className="text-base">{item.emoji}</span>
                    <p className="flex-1 text-xs font-semibold text-text min-w-0 truncate">{item.name}</p>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => cart.removeItem(item.id)} className="w-5 h-5 rounded-full bg-surface3 flex items-center justify-center hover:bg-border2 transition-colors">
                        <Minus size={10}/>
                      </button>
                      <span className="text-xs font-bold w-4 text-center">{item.qty}</span>
                      <button onClick={() => cart.addItem(item)} className="w-5 h-5 rounded-full bg-surface3 flex items-center justify-center hover:bg-border2 transition-colors">
                        <Plus size={10}/>
                      </button>
                    </div>
                    <p className="text-xs font-bold text-green2 w-12 text-right">{formatINR(item.price * item.qty)}</p>
                    <button onClick={() => cart.deleteItem(item.id)} className="text-muted hover:text-red transition-colors">
                      <Trash2 size={12}/>
                    </button>
                  </div>
                ))
              )}
            </Card>

            {/* Summary + Actions */}
            {cart.items.length > 0 && (
              <Card className="flex-shrink-0 space-y-3">
                <div className="space-y-1.5">
                  {[
                    ['Subtotal', formatINR(subtotal)],
                    [`GST (${cart.gstRate}%)`, formatINR(gst)],
                    ['Discount', `-${formatINR(discount)}`],
                  ].map(([l, v]) => (
                    <div key={l} className="flex justify-between text-xs text-text3">
                      <span>{l}</span><span>{v}</span>
                    </div>
                  ))}
                  <div className="flex justify-between font-display font-black text-sm pt-2 border-t border-border">
                    <span>Total</span>
                    <span className="text-green2">{formatINR(total)}</span>
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <div className="relative">
                    <input type="number" min="0" max="100" placeholder="Disc %"
                      className={`w-20 bg-bg border rounded-lg px-2 py-1.5 text-xs outline-none transition-all ${
                        pointsApplied ? 'border-green bg-green-dim text-green2 cursor-not-allowed' : 'border-border2 focus:border-green'
                      }`}
                      value={cart.discountPercent || ''}
                      readOnly={pointsApplied}
                      onChange={e => !pointsApplied && cart.setDiscount(Number(e.target.value))} />
                    {pointsApplied && (
                      <span className="absolute -top-4 left-0 text-[9px] text-green2 font-bold whitespace-nowrap">🎁 Points applied</span>
                    )}
                  </div>
                  <input placeholder="Coupon"
                    className="flex-1 bg-bg border border-border2 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-green" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Button variant="primary" size="sm" icon={<Printer size={13}/>} className="justify-center w-full"
                    onClick={() => setPayModal('receipt')} loading={submitOrder.isPending}>
                    Collect & Print
                  </Button>
                  <Button variant="secondary" size="sm" icon={<Send size={13}/>} className="justify-center w-full"
                    onClick={() => {
                      if (cart.orderType === 'dine_in' && !cart.tableNumber) {
                        toast.error('Please select a table for dine-in orders')
                        return
                      }
                      submitOrder.mutate({ payMethod: 'kot', showReceipt: false })
                    }}>
                    Send KOT
                  </Button>
                </div>
              </Card>
            )}
          </div>

          {/* Add Customer Modal */}
          <Modal open={addCustModal} onClose={() => setAddCustModal(false)} title="➕ New Customer">
            <div className="space-y-3">
              <div className="bg-surface2 rounded-lg px-3 py-2 text-sm text-text2">
                📱 Phone: <strong>{cart.customerName}</strong>
              </div>
              <Input label="Customer Name" placeholder="e.g. Priya Sharma"
                value={custName} onChange={e => setCustName(e.target.value)} />
              <div className="flex gap-2">
                <Button variant="secondary" className="flex-1 justify-center" onClick={() => setAddCustModal(false)}>Cancel</Button>
                <Button variant="primary" className="flex-1 justify-center" loading={addingCust}
                  onClick={async () => {
                    if (!custName.trim()) { toast.error('Enter customer name'); return }
                    try {
                      setAddingCust(true)
                      const res = await createCustomer({ name: custName.trim(), phone: cart.customerName })
                      setFoundCustomer({ ...res, loyalty_points: 0 })
                      setNotFound(false)
                      setAddCustModal(false)
                      toast.success(`✅ ${custName} added!`)
                    } catch (e) { toast.error(String(e)) }
                    finally { setAddingCust(false) }
                  }}>
                  Save & Link
                </Button>
              </div>
            </div>
          </Modal>

          {/* Pay modal */}
          <Modal
            open={!!payModal}
            onClose={() => setPayModal(false)}
            title={payModal === 'receipt' ? '🧾 Pay & Get Receipt' : '💳 Collect Payment'}>
            <div className="text-center py-4">
              <p className="font-display font-black text-4xl text-green2">{formatINR(total)}</p>
              <p className="text-sm text-muted mt-1">Including {cart.gstRate}% GST</p>
              {discount > 0 && <p className="text-xs text-orange mt-0.5">Discount: -{formatINR(discount)}</p>}
              <p className="text-xs text-muted mt-3 mb-1">Select payment method</p>
              <div className="flex gap-2 justify-center mt-2">
                {[['cash','💵 Cash'],['upi','📱 UPI'],['card','💳 Card']].map(([m, l]) => (
                  <Button key={m} variant="secondary"
                    loading={submitOrder.isPending}
                    onClick={() => submitOrder.mutate({ payMethod: m, showReceipt: payModal === 'receipt' })}>
                    {l}
                  </Button>
                ))}
              </div>
            </div>
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
