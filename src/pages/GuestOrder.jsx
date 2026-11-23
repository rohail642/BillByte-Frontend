import { useEffect, useMemo, useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { Search, Plus, Minus, ShoppingBag, X, Check, Clock, ChefHat, Bell, CircleX, IndianRupee, Loader2 } from 'lucide-react'
import { clsx } from 'clsx'
import { guestGetMenu, guestPlaceOrder, guestGetStatus } from '../api/tableOrdering'

const inr = n => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })
const FINAL = ['rejected', 'served', 'paid']
const POLL_MS = 15000

// Per-table memory of what this phone has ordered, so a refresh keeps the
// status screen. Storage can be blocked (private mode) — fail soft.
const storeKey = token => `bb_guest_${token.slice(-16)}`
function loadPlaced(token) {
  try {
    const v = JSON.parse(localStorage.getItem(storeKey(token)) || '[]')
    // forget orders older than 12h (next visit to the same table)
    return v.filter(p => Date.now() - p.at < 12 * 3600 * 1000)
  } catch { return [] }
}
function rememberPlaced(token, res) {
  const list = [{ id: res.request_id, key: res.access_key, at: Date.now() }, ...loadPlaced(token)]
  try { localStorage.setItem(storeKey(token), JSON.stringify(list)) } catch { /* ignore */ }
  return list
}

// UPI payment without a gateway. A bare upi:// link lets Android open whatever app
// last claimed UPI (often WhatsApp), so we offer one button per app instead,
// plus the UPI ID to copy as a fallback that always works.
const UPI_APPS = [
  { name: 'GPay', pkg: 'com.google.android.apps.nbu.paisa.user', ios: 'gpay://upi/pay' },
  { name: 'PhonePe', pkg: 'com.phonepe.app', ios: 'phonepe://pay' },
  { name: 'Paytm', pkg: 'net.one97.paytm', ios: 'paytmmp://pay' },
]
function UpiPay({ link, amount }) {
  const [copied, setCopied] = useState(false)
  const query = link.slice(link.indexOf('?') + 1)
  const vpa = new URLSearchParams(query).get('pa') || ''
  const ua = navigator.userAgent || ''
  const android = /Android/i.test(ua)
  const ios = /iPhone|iPad|iPod/i.test(ua)
  const href = app => android
    ? `intent://pay?${query}#Intent;scheme=upi;package=${app.pkg};end`
    : `${app.ios}?${query}`
  const copy = async () => {
    try { await navigator.clipboard.writeText(vpa) } catch {
      const t = document.createElement('textarea'); t.value = vpa; document.body.appendChild(t); t.select()
      try { document.execCommand('copy') } catch { /* ignore */ } t.remove()
    }
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }
  return (
    <div className="mt-4 rounded-2xl border border-border2 bg-bg2 p-3">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-semibold text-text2">Pay by UPI</span>
        <span className="text-lg font-bold tabular-nums">{inr(amount)}</span>
      </div>
      {(android || ios) && (
        <div className="mt-3 grid grid-cols-3 gap-2">
          {UPI_APPS.map(a => (
            <a key={a.name} href={href(a)}
              className="h-11 flex items-center justify-center rounded-xl bg-green text-white text-sm font-bold active:scale-[0.97] transition-transform">
              {a.name}
            </a>
          ))}
        </div>
      )}
      {android && (
        <a href={link} className="mt-2 block text-center text-xs font-semibold text-text3">Pay with another UPI app →</a>
      )}
      <div className="mt-3 flex items-center gap-3 rounded-xl border border-dashed border-border2 px-3 py-2">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-wide text-text3">{android || ios ? 'Or pay to UPI ID' : 'UPI ID'}</p>
          <p className="text-sm font-semibold truncate">{vpa}</p>
        </div>
        <button onClick={copy}
          className={clsx('h-8 px-3 rounded-lg text-xs font-bold border transition-colors',
            copied ? 'bg-green text-white border-green' : 'border-green text-green')}>
          {copied ? 'Copied ✓' : 'Copy'}
        </button>
      </div>
      <p className="mt-2 text-[11px] text-center text-text3">Show the payment screen to staff to close your bill.</p>
    </div>
  )
}

function FoodDot({ type }) {
  const nonVeg = type === 'non_veg' || type === 'egg'
  return (
    <span className={clsx('inline-flex w-3.5 h-3.5 border-[1.5px] items-center justify-center rounded-[3px] flex-shrink-0',
      nonVeg ? 'border-red' : 'border-green')}>
      <span className={clsx('w-1.5 h-1.5 rounded-full', nonVeg ? 'bg-red' : 'bg-green')} />
    </span>
  )
}

function stepOf(s) {
  if (s.status === 'pending') return { label: 'Waiting for staff to confirm', icon: Clock, tone: 'amber' }
  if (s.status === 'rejected') return { label: 'Not accepted', icon: CircleX, tone: 'red' }
  const k = s.kitchen_status
  if (k === 'paid') return { label: 'Paid — thank you!', icon: Check, tone: 'green' }
  if (k === 'served') return { label: 'Served — enjoy!', icon: Check, tone: 'green' }
  if (k === 'ready') return { label: 'Ready — coming to your table', icon: Bell, tone: 'green' }
  if (k === 'preparing') return { label: 'Being prepared', icon: ChefHat, tone: 'blue' }
  return { label: 'Sent to the kitchen', icon: ChefHat, tone: 'blue' }
}

const TONE = {
  amber: 'bg-amber-dim text-amber', red: 'bg-red-dim text-red',
  green: 'bg-green-dim text-green', blue: 'bg-blue-dim text-blue',
}

export default function GuestOrder() {
  const { token } = useParams()
  const [menu, setMenu] = useState(null)
  const [error, setError] = useState(null)
  const [cat, setCat] = useState('all')
  const [q, setQ] = useState('')
  const [cart, setCart] = useState({})          // id -> qty
  const [cartOpen, setCartOpen] = useState(false)
  const [name, setName] = useState('')
  const [note, setNote] = useState('')
  const [placing, setPlacing] = useState(false)
  const [placeErr, setPlaceErr] = useState(null)
  const [placed, setPlaced] = useState(() => loadPlaced(token))
  const [statuses, setStatuses] = useState({})  // request id -> status payload
  const [view, setView] = useState(() => (loadPlaced(token).length ? 'status' : 'menu'))

  useEffect(() => {
    guestGetMenu(token).then(setMenu).catch(e => setError(e.message))
  }, [token])

  const refreshStatuses = useCallback(async () => {
    const list = loadPlaced(token)
    const results = await Promise.allSettled(list.map(p => guestGetStatus(token, p.id, p.key)))
    setStatuses(prev => {
      const next = { ...prev }
      results.forEach((r, i) => { if (r.status === 'fulfilled') next[list[i].id] = r.value })
      return next
    })
  }, [token])

  // Poll slowly, only while something is still in progress and the tab is visible.
  const anyOpen = placed.some(p => {
    const s = statuses[p.id]
    if (!s) return true
    const k = s.status === 'accepted' ? s.kitchen_status : s.status
    return !FINAL.includes(k)
  })
  useEffect(() => {
    if (!placed.length) return
    refreshStatuses()
    if (!anyOpen) return
    const t = setInterval(() => { if (!document.hidden) refreshStatuses() }, POLL_MS)
    return () => clearInterval(t)
  }, [placed.length, anyOpen, refreshStatuses])

  const items = useMemo(() => menu?.items || [], [menu])
  const byId = useMemo(() => Object.fromEntries(items.map(i => [i.id, i])), [items])
  const visible = useMemo(() => {
    const term = q.trim().toLowerCase()
    // In "All", keep the restaurant's category order (Starters → Mains → …)
    const catRank = Object.fromEntries((menu?.categories || []).map((c, i) => [c.id, i]))
    const rank = i => catRank[i.category_id] ?? 999
    return items
      .filter(i =>
        (cat === 'all' || i.category_id === cat) &&
        (!term || i.name.toLowerCase().includes(term) || (i.description || '').toLowerCase().includes(term)))
      .sort((a, b) => rank(a) - rank(b))
  }, [items, menu, cat, q])

  const lines = Object.entries(cart).filter(([, n]) => n > 0).map(([id, n]) => ({ item: byId[id], qty: n })).filter(l => l.item)
  const count = lines.reduce((s, l) => s + l.qty, 0)
  const subtotal = lines.reduce((s, l) => s + l.qty * l.item.price, 0)

  const setQty = (id, n) => setCart(c => ({ ...c, [id]: Math.max(0, Math.min(20, n)) }))

  async function placeOrder() {
    setPlacing(true); setPlaceErr(null)
    try {
      const res = await guestPlaceOrder(token, {
        items: lines.map(l => ({ menu_item_id: l.item.id, quantity: l.qty })),
        guest_name: name.trim() || null,
        notes: note.trim() || null,
      })
      setPlaced(rememberPlaced(token, res))
      setCart({}); setNote(''); setCartOpen(false); setView('status')
      window.scrollTo(0, 0)
    } catch (e) {
      setPlaceErr(e.message)
    } finally {
      setPlacing(false)
    }
  }

  // ── error / loading ────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center p-6">
        <div className="max-w-sm text-center">
          <div className="w-12 h-12 mx-auto rounded-full bg-red-dim text-red flex items-center justify-center mb-3"><CircleX size={24} /></div>
          <h1 className="font-display font-bold text-lg text-text mb-1">Can't open the menu</h1>
          <p className="text-sm text-text3">{error}</p>
        </div>
      </div>
    )
  }
  if (!menu) {
    return <div className="min-h-screen bg-bg flex items-center justify-center"><Loader2 className="animate-spin text-green" /></div>
  }

  const latestBill = placed.map(p => statuses[p.id]?.bill).find(Boolean)

  return (
    <div className="min-h-screen bg-bg text-text pb-28">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-bg2/95 backdrop-blur border-b border-border">
        <div className="max-w-2xl mx-auto px-4 pt-3 pb-2">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="font-display font-bold text-[17px] truncate">{menu.restaurant_name}</h1>
              <p className="text-xs text-text3">Table {menu.table_number}</p>
            </div>
            {placed.length > 0 && (
              <div className="flex bg-surface2 rounded-lg p-0.5 text-xs font-semibold flex-shrink-0">
                {['menu', 'status'].map(v => (
                  <button key={v} onClick={() => setView(v)}
                    className={clsx('px-3 py-1.5 rounded-md', view === v ? 'bg-bg2 text-text shadow-sm' : 'text-text3')}>
                    {v === 'menu' ? 'Menu' : 'My orders'}
                  </button>
                ))}
              </div>
            )}
          </div>
          {view === 'menu' && (
            <>
              <div className="relative mt-3">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search dishes"
                  className="w-full bg-surface2 border border-border rounded-lg pl-9 pr-3 py-2 text-sm outline-none focus:border-green" />
              </div>
              <div className="flex gap-2 overflow-x-auto mt-2 -mx-4 px-4 pb-1 no-scrollbar">
                {[{ id: 'all', name: 'All' }, ...menu.categories].map(c => (
                  <button key={c.id} onClick={() => setCat(c.id)}
                    className={clsx('px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border',
                      cat === c.id ? 'bg-green text-white border-green' : 'bg-bg2 text-text2 border-border')}>
                    {c.name}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4">
        {view === 'menu' ? (
          <ul className="divide-y divide-border">
            {visible.length === 0 && <li className="py-12 text-center text-sm text-text3">No dishes found</li>}
            {visible.map(i => {
              const n = cart[i.id] || 0
              return (
                <li key={i.id} className="py-3.5 flex gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2"><FoodDot type={i.food_type} /><h3 className="font-semibold text-[15px] leading-tight">{i.name}</h3></div>
                    <p className="text-sm font-semibold mt-1 tabular-nums">{inr(i.price)}</p>
                    {i.description && <p className="text-xs text-text3 mt-1 line-clamp-2">{i.description}</p>}
                  </div>
                  <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
                    <div className="text-3xl leading-none">{i.emoji}</div>
                    {n === 0 ? (
                      <button onClick={() => setQty(i.id, 1)}
                        className="w-20 py-1.5 rounded-lg border border-green text-green text-xs font-bold bg-green-dim">ADD</button>
                    ) : (
                      <div className="w-20 flex items-center justify-between rounded-lg bg-green text-white text-sm font-bold">
                        <button aria-label="Remove one" onClick={() => setQty(i.id, n - 1)} className="p-1.5"><Minus size={14} /></button>
                        <span className="tabular-nums">{n}</span>
                        <button aria-label="Add one" onClick={() => setQty(i.id, n + 1)} className="p-1.5"><Plus size={14} /></button>
                      </div>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        ) : (
          <div className="py-4 space-y-3">
            {placed.map((p, idx) => {
              const s = statuses[p.id]
              if (!s) return <div key={p.id} className="p-4 rounded-xl bg-bg2 border border-border text-sm text-text3">Loading…</div>
              const st = stepOf(s); const Icon = st.icon
              return (
                <section key={p.id} className="rounded-xl bg-bg2 border border-border overflow-hidden">
                  <div className={clsx('flex items-center gap-2 px-4 py-3 text-sm font-semibold', TONE[st.tone])}>
                    <Icon size={16} /> {st.label}
                    <span className="ml-auto text-[11px] font-medium opacity-70">Order {placed.length - idx}</span>
                  </div>
                  <ul className="px-4 py-2 text-sm">
                    {s.items.map((it, j) => (
                      <li key={j} className="flex justify-between py-1"><span>{it.quantity} × {it.name}</span><span className="tabular-nums text-text2">{inr(it.price * it.quantity)}</span></li>
                    ))}
                  </ul>
                  {s.status === 'rejected' && s.reject_reason && <p className="px-4 pb-3 text-xs text-red">Reason: {s.reject_reason}</p>}
                </section>
              )
            })}

            {latestBill && (
              <section className="rounded-xl bg-bg2 border border-border p-4">
                <h2 className="font-display font-bold mb-2">Table bill</h2>
                <ul className="text-sm space-y-1">
                  {latestBill.items.map((it, j) => (
                    <li key={j} className="flex justify-between"><span>{it.quantity} × {it.name}</span><span className="tabular-nums">{inr(it.total)}</span></li>
                  ))}
                </ul>
                <div className="border-t border-border mt-3 pt-2 text-sm space-y-1">
                  <div className="flex justify-between text-text3"><span>Subtotal</span><span className="tabular-nums">{inr(latestBill.subtotal)}</span></div>
                  {latestBill.discount_amount > 0 && <div className="flex justify-between text-text3"><span>Discount</span><span className="tabular-nums">−{inr(latestBill.discount_amount)}</span></div>}
                  <div className="flex justify-between text-text3"><span>GST</span><span className="tabular-nums">{inr(latestBill.gst_amount)}</span></div>
                  <div className="flex justify-between font-bold text-base pt-1"><span>Total</span><span className="tabular-nums">{inr(latestBill.total_amount)}</span></div>
                </div>
                {latestBill.payment_status === 'paid' ? (
                  <p className="mt-3 text-center text-sm font-semibold text-green">Paid ✓</p>
                ) : latestBill.upi_link ? (
                  <UpiPay link={latestBill.upi_link} amount={latestBill.total_amount} />
                ) : (
                  <p className="mt-3 text-center text-xs text-text3">Please pay at the counter.</p>
                )}
              </section>
            )}

            <button onClick={() => setView('menu')} className="w-full py-3 rounded-xl border border-border2 text-sm font-semibold text-text2 bg-bg2">
              + Order more
            </button>
          </div>
        )}
      </main>

      {/* Cart bar */}
      {view === 'menu' && count > 0 && (
        <div className="fixed bottom-0 inset-x-0 z-30 p-3 bg-gradient-to-t from-bg via-bg to-transparent">
          <button onClick={() => setCartOpen(true)}
            className="max-w-2xl mx-auto w-full flex items-center justify-between px-4 py-3.5 rounded-xl bg-green text-white font-bold shadow-lg">
            <span className="flex items-center gap-2"><ShoppingBag size={18} /> {count} item{count > 1 ? 's' : ''} · {inr(subtotal)}</span>
            <span>View order →</span>
          </button>
        </div>
      )}

      {/* Cart sheet */}
      {cartOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-end justify-center" onClick={() => setCartOpen(false)}>
          <div className="w-full max-w-2xl bg-bg2 rounded-t-2xl max-h-[88vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-border sticky top-0 bg-bg2">
              <h2 className="font-display font-bold">Your order · Table {menu.table_number}</h2>
              <button aria-label="Close" onClick={() => setCartOpen(false)} className="p-1.5 text-text3"><X size={18} /></button>
            </div>
            <ul className="px-4 divide-y divide-border">
              {lines.map(({ item, qty }) => (
                <li key={item.id} className="py-3 flex items-center gap-3">
                  <FoodDot type={item.food_type} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{item.name}</p>
                    <p className="text-xs text-text3 tabular-nums">{inr(item.price)}</p>
                  </div>
                  <div className="flex items-center rounded-lg border border-green text-green text-sm font-bold">
                    <button aria-label="Remove one" onClick={() => setQty(item.id, qty - 1)} className="p-1.5"><Minus size={14} /></button>
                    <span className="w-6 text-center tabular-nums">{qty}</span>
                    <button aria-label="Add one" onClick={() => setQty(item.id, qty + 1)} className="p-1.5"><Plus size={14} /></button>
                  </div>
                  <span className="w-16 text-right text-sm tabular-nums">{inr(item.price * qty)}</span>
                </li>
              ))}
            </ul>
            <div className="px-4 py-3 space-y-2">
              <input value={name} onChange={e => setName(e.target.value)} maxLength={60} placeholder="Your name (optional)"
                className="w-full bg-surface2 border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-green" />
              <textarea value={note} onChange={e => setNote(e.target.value)} maxLength={300} rows={2} placeholder="Cooking instructions (e.g. less spicy)"
                className="w-full bg-surface2 border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-green resize-none" />
              <div className="flex justify-between text-sm pt-1">
                <span className="text-text3">Item total <span className="text-[11px]">(+ GST {menu.gst_rate}%)</span></span>
                <span className="font-bold tabular-nums">{inr(subtotal)}</span>
              </div>
              {placeErr && <p className="text-sm text-red bg-red-dim rounded-lg px-3 py-2">{placeErr}</p>}
              <button onClick={placeOrder} disabled={placing || !count}
                className="w-full py-3.5 rounded-xl bg-green text-white font-bold disabled:opacity-60 flex items-center justify-center gap-2">
                {placing && <Loader2 size={16} className="animate-spin" />} Place order
              </button>
              <p className="text-[11px] text-center text-text3 pb-2">
                {menu?.auto_accept ? 'Your order goes straight to the kitchen.' : 'Staff will confirm your order before it goes to the kitchen.'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
