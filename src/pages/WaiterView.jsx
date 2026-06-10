import { useState, useMemo, useCallback, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getActiveTables, getTableOrder, createOrder, addItemsToOrder, updateStatus } from '../api/orders'
import { getMenuItems, getCategories } from '../api/menu'
import { getProfile } from '../api/auth'
import { useAuthStore } from '../store/auth'
import toast from 'react-hot-toast'
import { LogOut, X, Plus, Minus, Search, ChefHat, UtensilsCrossed, ArrowLeft } from 'lucide-react'

const SECTION_COLORS = {
  blue:   '#3b82f6',
  orange: '#ea580c',
  green:  '#16a34a',
  purple: '#9333ea',
  teal:   '#0d9488',
  red:    '#dc2626',
  gray:   '#78716c',
}
import { clsx } from 'clsx'
import { formatINR, printKOTElectron, isNativeApp } from '../utils'
import { KOTModal } from '../components/ui/KOTView'

export default function WaiterView() {
  const { user, restaurantName, clearAuth, token } = useAuthStore()
  const qc = useQueryClient()

  useEffect(() => {
    if (!window.electronAPI?.setAuthToken) return
    if (token) window.electronAPI.setAuthToken(token, restaurantName)
    return () => { window.electronAPI.clearAuthToken?.() }
  }, [token, restaurantName])

  const [selectedTable, setSelectedTable] = useState(null)
  const [cart, setCart] = useState([])
  const [note, setNote] = useState('')
  const [kotModal, setKotModal] = useState(null)
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('all')
  const [mobileTab, setMobileTab] = useState('menu')

  const { data: profile, isLoading: profileLoading } = useQuery({ queryKey: ['profile'], queryFn: getProfile })
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
    queryFn: () => getTableOrder(selectedTable),
    enabled: !!selectedTable,
    retry: false,
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

  const sendMut = useMutation({
    mutationFn: async () => {
      if (cart.length === 0) throw new Error('Add at least one item')
      const items = cart.map(c => ({ menu_item_id: c.id, name: c.name, price: c.price, quantity: c.qty }))
      let orderId = tableOrder?.id

      if (orderId) {
        await addItemsToOrder(orderId, { items, notes: note || null })
      } else {
        const newOrder = await createOrder({ order_type: 'dine_in', table_number: String(selectedTable), items, notes: note || null })
        orderId = newOrder.id
      }
      await updateStatus(orderId, 'kot_sent')
      return orderId
    },
    onSuccess: (orderId) => {
      toast.success(`Order sent to kitchen — Table ${selectedTable}`)
      const kotData = {
        restaurantName: profile?.restaurant_name || restaurantName || '',
        tableNumber:    selectedTable,
        items:          cart.map(c => ({ name: c.name, quantity: c.qty })),
        notes:          note || '',
        orderId,
      }
      if (!printKOTElectron(kotData) && !isNativeApp()) setKotModal(kotData)
      setCart([])
      setNote('')
      setSelectedTable(null)
      qc.invalidateQueries({ queryKey: ['activeTables'] })
      qc.invalidateQueries({ queryKey: ['tableOrder', selectedTable] })
    },
    onError: e => {
      const msg = e?.response?.data?.detail
      if (Array.isArray(msg)) toast.error(msg.map(m => m.msg).join(', '))
      else toast.error(String(msg || e?.message || 'Something went wrong'))
    },
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
  const existingItems = tableOrder?.items || []

  // Each section owns custom-named tables (strings). Legacy fallback: numeric 1..table_count.
  const rawSections = profile?.table_sections || []
  const sections = rawSections.length
    ? rawSections.map(s => ({ ...s, tables: (s.tables || []).map(String) }))
    : [{ id: '_all', name: 'Tables', color: 'gray', tables: Array.from({ length: tableCount }, (_, i) => String(i + 1)) }]

  const TableBtn = useCallback(({ n }) => {
    const active = activeTableNums.has(String(n))
    return (
      <button
        onClick={() => { setSelectedTable(n); setCart([]) }}
        className={clsx(
          'aspect-square rounded-xl flex flex-col items-center justify-center gap-1 border-2 transition-all font-semibold text-sm',
          active
            ? 'border-green bg-green-dim text-green'
            : 'border-border bg-bg2 text-text2 hover:border-green/40 hover:bg-surface2'
        )}
      >
        <UtensilsCrossed size={20} className={active ? 'text-green' : 'text-muted'} />
        <span>{n}</span>
        {active && <span className="text-[10px] font-normal text-green/70">Active</span>}
      </button>
    )
  }, [activeTableNums])

  return (
    <div className="h-screen flex flex-col bg-bg overflow-hidden">
      {/* Header */}
      <div className="h-[60px] bg-bg2 border-b border-border flex items-center px-4 gap-3 flex-shrink-0">
        {selectedTable ? (
          <button
            onClick={() => { setSelectedTable(null); setCart([]) }}
            className="flex items-center gap-1.5 text-sm font-semibold text-text2 hover:text-green transition-colors"
          >
            <ArrowLeft size={18} />
            <span>Tables</span>
          </button>
        ) : (
          <>
            <div className="font-display font-black text-xl text-green tracking-tight">
              Bill<span className="text-orange">Byte</span>
            </div>
            <div className="text-xs text-muted font-medium ml-1">{restaurantName}</div>
          </>
        )}
        {selectedTable && (
          <div className="flex items-center gap-2 ml-1">
            <span className="w-1.5 h-1.5 rounded-full bg-border2" />
            <span className="text-sm font-bold text-text">Table {selectedTable}</span>
          </div>
        )}
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-green text-white flex items-center justify-center text-[11px] font-bold">
            {(user?.name || 'W').slice(0, 1).toUpperCase()}
          </div>
          <span className="text-sm font-medium text-text hidden sm:block">{user?.name}</span>
          <button
            onClick={() => { clearAuth(); window.location.hash = '/login' }}
            className="text-muted hover:text-red transition-colors p-1.5 rounded ml-1"
            title="Logout"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>

      {/* Table Grid */}
      {!selectedTable ? (
        <div className="flex-1 overflow-y-auto p-4 lg:p-6">
          <h1 className="text-lg font-bold text-text mb-4">Select a Table</h1>
          {profileLoading ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="aspect-square rounded-xl bg-surface2 animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-6">
              {sections.map(section => {
                const color = SECTION_COLORS[section.color] || '#78716c'
                return (
                  <div key={section.id}>
                    {(sections.length > 1 || section.name) && (
                      <div className="flex items-center gap-2 mb-3">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }} />
                        <h2 className="text-sm font-bold text-text">{section.name || 'Tables'}</h2>
                        <span className="text-xs text-muted">{section.tables.length} tables</span>
                      </div>
                    )}
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
                      {section.tables.map(n => <TableBtn key={n} n={n} />)}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      ) : (
        /* Table Detail Panel */
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
              <h2 className="font-bold text-text flex-1">Order Summary</h2>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-4">
              {/* Existing order items */}
              {existingItems.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-2">Current Order</p>
                  <div className="space-y-1">
                    {existingItems.map((item, i) => (
                      <div key={i} className="flex items-center justify-between text-sm py-1">
                        <span className="text-text2 flex-1 truncate">{item.name}</span>
                        <span className="text-muted mx-2">×{item.quantity}</span>
                        <span className="text-text font-medium">{formatINR(item.price * item.quantity)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* New cart items */}
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

              {/* KOT note — e.g. "less spicy". Sent with the next Send to Kitchen. */}
              {(existingItems.length > 0 || cart.length > 0) && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-1.5">Note for kitchen</p>
                  <textarea
                    rows={2}
                    className="w-full bg-bg border border-border2 rounded-lg px-3 py-2 text-sm text-text outline-none transition-all placeholder-muted focus:border-green resize-none"
                    placeholder="e.g. less spicy, no onion"
                    value={note}
                    onChange={e => setNote(e.target.value)}
                  />
                </div>
              )}
            </div>

            {/* Send to kitchen */}
            <div className="p-3 border-t border-border space-y-2">
              {cart.length > 0 && (
                <div className="flex justify-between text-sm font-semibold px-1">
                  <span className="text-text2">New items total</span>
                  <span className="text-text">{formatINR(cartTotal)}</span>
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
            </div>
          </div>

          {/* Right — Menu */}
          <div className={clsx('flex-1 flex-col overflow-hidden', mobileTab === 'menu' ? 'flex' : 'hidden md:flex')}>
            {/* Search + Categories */}
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

            {/* Menu Items Grid */}
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
        </div>
      )}

      <KOTModal data={kotModal} onClose={() => setKotModal(null)} />
    </div>
  )
}
