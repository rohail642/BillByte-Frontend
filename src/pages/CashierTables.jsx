import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getActiveTables, getTableOrder, createOrder, addItemsToOrder, updateStatus, removeOrderItem, collectPayment } from '../api/orders'
import { getMenuItems, getCategories } from '../api/menu'
import { getProfile } from '../api/auth'
import toast from 'react-hot-toast'
import { X, Plus, Minus, Search, ChefHat, UtensilsCrossed, Receipt, Printer } from 'lucide-react'
import { clsx } from 'clsx'
import { formatINR } from '../utils'
import ReceiptView, { printReceipt } from '../components/ui/ReceiptView'
import Modal from '../components/ui/Modal'

const SECTION_COLORS = {
  blue:   '#3b82f6',
  orange: '#ea580c',
  green:  '#16a34a',
  purple: '#9333ea',
  teal:   '#0d9488',
  red:    '#dc2626',
  gray:   '#78716c',
}

export default function CashierTables() {
  const qc = useQueryClient()

  const [selectedTable, setSelectedTable] = useState(null)
  const [cart, setCart] = useState([])
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('all')
  const [mobileTab, setMobileTab] = useState('menu')
  const [payModal, setPayModal] = useState(false)
  const [receiptModal, setReceiptModal] = useState(null)
  const [discountPercent, setDiscountPercent] = useState('')

  const { data: profile } = useQuery({ queryKey: ['profile'], queryFn: getProfile })
  const tableCount = profile?.table_count ?? 10

  const { data: activeTables = [] } = useQuery({
    queryKey: ['activeTables'],
    queryFn: getActiveTables,
    refetchInterval: 15000,
  })

  const activeTableNums = useMemo(
    () => new Set((activeTables || []).map(t => String(t.table_number))),
    [activeTables]
  )

  const { data: tableOrder } = useQuery({
    queryKey: ['tableOrder', selectedTable],
    queryFn: () => getTableOrder(selectedTable).catch(err => {
      if (err?.response?.status === 404) return null
      throw err
    }),
    enabled: !!selectedTable,
    retry: false,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchInterval: 8000,
  })

  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: getCategories })
  const { data: menuData } = useQuery({ queryKey: ['menuItems'], queryFn: () => getMenuItems({ limit: 200 }) })
  const menuItems = useMemo(() => (menuData?.items || menuData || []).filter(i => i.is_available !== false), [menuData])

  const filteredItems = useMemo(() => {
    let items = menuItems
    if (activeCategory !== 'all') items = items.filter(i => i.category_id === activeCategory || i.category === activeCategory)
    if (search) items = items.filter(i => i.name.toLowerCase().includes(search.toLowerCase()))
    return items
  }, [menuItems, activeCategory, search])

  const cancelItemMut = useMutation({
    mutationFn: ({ orderId, itemId }) => removeOrderItem(orderId, itemId),
    onSuccess: () => {
      toast.success('Item cancelled — kitchen notified')
      qc.invalidateQueries({ queryKey: ['tableOrder', selectedTable] })
      qc.invalidateQueries({ queryKey: ['activeTables'] })
    },
    onError: e => toast.error(String(e?.response?.data?.detail || e?.message || 'Failed to cancel item')),
  })

  const sendMut = useMutation({
    mutationFn: async () => {
      if (cart.length === 0) throw new Error('Add at least one item')
      const items = cart.map(c => ({ menu_item_id: c.id, name: c.name, price: c.price, quantity: c.qty }))
      let orderId = activeTableOrder?.id

      if (orderId) {
        await addItemsToOrder(orderId, { items })
      } else {
        const newOrder = await createOrder({ order_type: 'dine_in', table_number: String(selectedTable), items })
        orderId = newOrder.id
      }
      await updateStatus(orderId, 'kot_sent')
      return orderId
    },
    onSuccess: () => {
      toast.success(`Order sent to kitchen — Table ${selectedTable}`)
      setCart([])
      qc.removeQueries({ queryKey: ['tableOrder', selectedTable] })
      qc.invalidateQueries({ queryKey: ['activeTables'] })
      setSelectedTable(null)
    },
    onError: e => {
      const msg = e?.response?.data?.detail
      if (Array.isArray(msg)) toast.error(msg.map(m => m.msg).join(', '))
      else toast.error(String(msg || e?.message || 'Something went wrong'))
    },
  })

  const payMut = useMutation({
    mutationFn: async (payMethod) => {
      const gstRate = profile?.gst_rate ?? 5
      const disc = parseFloat(discountPercent) || 0
      const order = await collectPayment(activeTableOrder.id, {
        payment_method: payMethod,
        discount_percent: disc,
      })
      order.payment_method = payMethod
      // compute totals for receipt
      const activeItems = (activeTableOrder.items || []).filter(i => !i.cancelled_at)
      const subtotal = activeItems.reduce((s, i) => s + i.price * i.quantity, 0)
      const discAmt  = Math.floor(subtotal * disc / 100)
      const gstAmt   = Math.round((subtotal - discAmt) * gstRate / 100)
      return { ...order, items: activeItems, subtotal, discount_amount: discAmt, gst_amount: gstAmt, total_amount: subtotal - discAmt + gstAmt }
    },
    onSuccess: (order) => {
      setPayModal(false)
      setReceiptModal(order)
      setDiscountPercent('')
      qc.removeQueries({ queryKey: ['tableOrder', selectedTable] })
      qc.invalidateQueries({ queryKey: ['activeTables'] })
      setSelectedTable(null)
      setCart([])
      toast.success(`Table ${selectedTable} billed successfully`)
    },
    onError: (e) => toast.error(e?.response?.data?.detail || 'Payment failed'),
  })

  function addToCart(item) {
    setCart(prev => {
      const existing = prev.find(c => c.id === item.id)
      if (existing) return prev.map(c => c.id === item.id ? { ...c, qty: c.qty + 1 } : c)
      return [...prev, { id: item.id, name: item.name, price: item.price, qty: 1 }]
    })
  }

  function updateQty(id, delta) {
    setCart(prev => prev
      .map(c => c.id === id ? { ...c, qty: c.qty + delta } : c)
      .filter(c => c.qty > 0)
    )
  }

  const cartTotal = cart.reduce((sum, c) => sum + c.price * c.qty, 0)
  // Never show items from a paid/cancelled order even if the cache is stale
  const activeTableOrder = (tableOrder && !['paid', 'cancelled'].includes(tableOrder.status)) ? tableOrder : null
  const existingItems = activeTableOrder?.items || []

  const sections = profile?.table_sections || []
  const assignedNums = new Set(sections.flatMap(s => s.tables))
  const unassigned = Array.from({ length: tableCount }, (_, i) => i + 1).filter(n => !assignedNums.has(n))

  function TableButton({ n }) {
    const active = activeTableNums.has(String(n))
    return (
      <button
        onClick={() => {
          qc.removeQueries({ queryKey: ['tableOrder', n] })
          setSelectedTable(n)
          setCart([])
        }}
        className={clsx(
          'aspect-square rounded-xl flex flex-col items-center justify-center gap-1 border-2 transition-all font-semibold text-sm',
          active
            ? 'border-green bg-green-dim text-green'
            : 'border-border bg-surface2 text-text2 hover:border-green/40 hover:bg-bg2'
        )}
      >
        <UtensilsCrossed size={20} className={active ? 'text-green' : 'text-muted'} />
        <span>T{n}</span>
        {active && <span className="text-[10px] font-normal text-green/70">Active</span>}
      </button>
    )
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Table Grid */}
      {!selectedTable ? (
        <div className="flex-1 overflow-y-auto p-4 lg:p-6">
          <h1 className="text-lg font-bold text-text mb-1">Tables</h1>
          <p className="text-sm text-muted mb-4">Select a table to view its order or add new items</p>

          {sections.length > 0 ? (
            <div className="space-y-6">
              {sections.map(section => {
                const color = SECTION_COLORS[section.color] || '#78716c'
                return (
                  <div key={section.id}>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }} />
                      <h2 className="text-sm font-bold text-text">{section.name}</h2>
                      <span className="text-xs text-muted">{section.tables.length} tables</span>
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
                      {section.tables.map(n => <TableButton key={n} n={n} />)}
                    </div>
                  </div>
                )
              })}
              {unassigned.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-2.5 h-2.5 rounded-full bg-muted flex-shrink-0" />
                    <h2 className="text-sm font-bold text-text">General</h2>
                    <span className="text-xs text-muted">{unassigned.length} tables</span>
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
                    {unassigned.map(n => <TableButton key={n} n={n} />)}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
              {Array.from({ length: tableCount }, (_, i) => i + 1).map(n => <TableButton key={n} n={n} />)}
            </div>
          )}
        </div>
      ) : (
        /* Split panel: order summary + menu */
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Mobile tab bar */}
          <div className="flex md:hidden flex-shrink-0 bg-surface border-b border-border p-1 gap-1">
            <button onClick={() => setMobileTab('menu')}
              className={clsx('flex-1 py-2 rounded-lg text-xs font-bold transition-all',
                mobileTab === 'menu' ? 'bg-green text-white' : 'text-text2')}>
              🍽️ Menu
            </button>
            <button onClick={() => setMobileTab('order')}
              className={clsx('flex-1 py-2 rounded-lg text-xs font-bold transition-all',
                mobileTab === 'order' ? 'bg-green text-white' : 'text-text2')}>
              🧾 Order {cart.length > 0 && (
                <span className="ml-1 bg-red text-white text-[9px] rounded-full w-4 h-4 inline-flex items-center justify-center">{cart.length}</span>
              )}
            </button>
          </div>
          <div className="flex-1 flex md:flex-row overflow-hidden">
          {/* Left — Order Summary */}
          <div className={clsx('w-full md:w-72 lg:w-80 flex-shrink-0 border-r border-border flex-col bg-bg2', mobileTab === 'order' ? 'flex' : 'hidden md:flex')}>
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
              <h2 className="font-bold text-text flex-1">Table {selectedTable}</h2>
              <button onClick={() => { qc.removeQueries({ queryKey: ['tableOrder', selectedTable] }); setSelectedTable(null); setCart([]) }} className="text-muted hover:text-text p-1 rounded">
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-4">
              {existingItems.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-2">Current Order</p>
                  <div className="space-y-1">
                    {existingItems.map((item) => {
                      const isCancelled = !!item.cancelled_at
                      const isCancelling = cancelItemMut.isPending && cancelItemMut.variables?.itemId === item.id
                      return (
                        <div key={item.id} className={clsx('flex items-center gap-1 text-sm py-1', isCancelled && 'opacity-40')}>
                          <span className={clsx('text-text2 flex-1 truncate', isCancelled && 'line-through')}>{item.name}</span>
                          <span className="text-muted">×{item.quantity}</span>
                          <span className="text-text font-medium w-16 text-right">{formatINR(item.price * item.quantity)}</span>
                          {!isCancelled && activeTableOrder?.id && (
                            <button
                              onClick={() => {
                                if (window.confirm(`Cancel "${item.name}"? Kitchen will be notified.`)) {
                                  cancelItemMut.mutate({ orderId: activeTableOrder.id, itemId: item.id })
                                }
                              }}
                              disabled={isCancelling}
                              className="ml-1 w-5 h-5 rounded flex items-center justify-center text-muted hover:text-red hover:bg-red-dim transition-colors flex-shrink-0"
                              title="Cancel item"
                            >
                              <X size={12} />
                            </button>
                          )}
                          {isCancelled && (
                            <span className="ml-1 text-[9px] font-bold uppercase text-red flex-shrink-0">Void</span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {cart.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-2">Adding Now</p>
                  <div className="space-y-2">
                    {cart.map(item => (
                      <div key={item.id} className="flex items-center gap-2 text-sm">
                        <span className="flex-1 text-text truncate">{item.name}</span>
                        <div className="flex items-center gap-1">
                          <button onClick={() => updateQty(item.id, -1)} className="w-6 h-6 rounded bg-surface2 flex items-center justify-center hover:bg-border text-text">
                            <Minus size={12} />
                          </button>
                          <span className="w-5 text-center font-semibold text-text">{item.qty}</span>
                          <button onClick={() => updateQty(item.id, 1)} className="w-6 h-6 rounded bg-surface2 flex items-center justify-center hover:bg-border text-text">
                            <Plus size={12} />
                          </button>
                        </div>
                        <span className="w-16 text-right font-medium text-text">{formatINR(item.price * item.qty)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {existingItems.length === 0 && cart.length === 0 && (
                <p className="text-sm text-muted text-center py-6">No items yet — add from the menu</p>
              )}
            </div>

            <div className="p-3 border-t border-border space-y-2">
              {cart.length > 0 && (
                <div className="flex justify-between text-sm font-semibold px-1">
                  <span className="text-text2">New items total</span>
                  <span className="text-text">{formatINR(cartTotal)}</span>
                </div>
              )}
              {activeTableOrder && existingItems.filter(i => !i.cancelled_at).length > 0 && (
                <div className="flex justify-between text-sm font-semibold px-1 text-green">
                  <span>Order total</span>
                  <span>{formatINR(existingItems.filter(i => !i.cancelled_at).reduce((s, i) => s + i.price * i.quantity, 0))}</span>
                </div>
              )}
              <button
                onClick={() => sendMut.mutate()}
                disabled={cart.length === 0 || sendMut.isPending}
                className={clsx(
                  'w-full py-2.5 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition-all',
                  cart.length === 0
                    ? 'bg-surface2 text-muted cursor-not-allowed'
                    : 'bg-green text-white hover:bg-green/90'
                )}
              >
                <ChefHat size={16} />
                {sendMut.isPending ? 'Sending…' : 'Send to Kitchen'}
              </button>
              {activeTableOrder && existingItems.filter(i => !i.cancelled_at).length > 0 && (
                <button
                  onClick={() => setPayModal(true)}
                  className="w-full py-2.5 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 bg-orange text-white hover:bg-orange/90 transition-all"
                >
                  <Receipt size={16} />
                  Collect Payment & Bill
                </button>
              )}
            </div>
          </div>

          {/* Right — Menu */}
          <div className={clsx('flex-1 flex-col overflow-hidden', mobileTab === 'menu' ? 'flex' : 'hidden md:flex')}>
            <div className="px-4 py-3 border-b border-border space-y-2 flex-shrink-0">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  type="text"
                  placeholder="Search menu…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 bg-bg2 border border-border rounded-lg text-sm text-text placeholder-muted focus:outline-none focus:border-green"
                />
              </div>
              <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
                <button
                  onClick={() => setActiveCategory('all')}
                  className={clsx(
                    'px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap flex-shrink-0 transition-all',
                    activeCategory === 'all' ? 'bg-green text-white' : 'bg-surface2 text-text2 hover:bg-border'
                  )}
                >
                  All
                </button>
                {categories.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className={clsx(
                      'px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap flex-shrink-0 transition-all',
                      activeCategory === cat.id ? 'bg-green text-white' : 'bg-surface2 text-text2 hover:bg-border'
                    )}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3">
              {filteredItems.length === 0 ? (
                <p className="text-sm text-muted text-center py-10">No items found</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                  {filteredItems.map(item => {
                    const inCart = cart.find(c => c.id === item.id)
                    return (
                      <button
                        key={item.id}
                        onClick={() => addToCart(item)}
                        className={clsx(
                          'p-3 rounded-xl border-2 text-left transition-all',
                          inCart
                            ? 'border-green bg-green-dim'
                            : 'border-border bg-bg2 hover:border-green/40 hover:bg-surface2'
                        )}
                      >
                        <p className="text-sm font-semibold text-text leading-tight line-clamp-2">{item.name}</p>
                        <p className="text-xs text-muted mt-0.5">{item.category_name || item.category || ''}</p>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-sm font-bold text-green">{formatINR(item.price)}</span>
                          {inCart && (
                            <span className="w-5 h-5 bg-green text-white rounded-full text-[10px] font-bold flex items-center justify-center">
                              {inCart.qty}
                            </span>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

          </div>
        </div>
      {/* Payment Modal */}
      <Modal open={payModal} onClose={() => setPayModal(false)} title="Collect Payment">
        {activeTableOrder && (() => {
          const gstRate  = profile?.gst_rate ?? 5
          const disc     = parseFloat(discountPercent) || 0
          const activeItems = existingItems.filter(i => !i.cancelled_at)
          const subtotal = activeItems.reduce((s, i) => s + i.price * i.quantity, 0)
          const discAmt  = Math.floor(subtotal * disc / 100)
          const taxable  = subtotal - discAmt
          const gstAmt   = Math.round(taxable * gstRate / 100)
          const total    = taxable + gstAmt
          return (
            <div className="space-y-4">
              <div className="bg-bg2 rounded-xl p-4 space-y-2 text-sm">
                <div className="flex justify-between text-text2"><span>Table {selectedTable}</span><span>{activeItems.length} item(s)</span></div>
                <div className="flex justify-between text-text2"><span>Subtotal</span><span>{formatINR(subtotal)}</span></div>
                {discAmt > 0 && <div className="flex justify-between text-orange"><span>Discount ({disc}%)</span><span>-{formatINR(discAmt)}</span></div>}
                <div className="flex justify-between text-text2"><span>GST ({gstRate}%)</span><span>{formatINR(gstAmt)}</span></div>
                <div className="flex justify-between font-bold text-text text-base pt-1 border-t border-border">
                  <span>Total</span><span>{formatINR(total)}</span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-text2 mb-1">Discount %</label>
                <input
                  type="number" min={0} max={100} value={discountPercent}
                  onChange={e => setDiscountPercent(e.target.value)}
                  placeholder="0"
                  className="w-full bg-bg border border-border2 rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-green"
                />
              </div>
              <div>
                <p className="text-xs font-semibold text-text2 mb-2">Payment Method</p>
                <div className="grid grid-cols-3 gap-2">
                  {['cash', 'upi', 'card'].map(m => (
                    <button
                      key={m}
                      onClick={() => payMut.mutate(m)}
                      disabled={payMut.isPending}
                      className="py-3 rounded-xl border-2 border-border text-sm font-bold uppercase tracking-wide text-text2 hover:border-green hover:bg-green-dim hover:text-green transition-all disabled:opacity-50"
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )
        })()}
      </Modal>

      {/* Receipt Modal */}
      <Modal open={!!receiptModal} onClose={() => setReceiptModal(null)} title="Receipt">
        {receiptModal && (
          <div>
            <ReceiptView order={receiptModal} profile={profile} />
            <button
              onClick={() => { printReceipt(receiptModal, profile); setReceiptModal(null) }}
              className="mt-4 w-full py-2.5 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 bg-green text-white hover:bg-green/90 transition-all"
            >
              <Printer size={16} /> Print Receipt
            </button>
          </div>
        )}
      </Modal>
    </div>
  )
}
