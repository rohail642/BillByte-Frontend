import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { Search, Plus, Minus, ShoppingBag, X, Check, Clock, ChefHat, Bell, BellRing, Receipt, CircleX, Loader2, Users, Banknote, CreditCard } from 'lucide-react'
import { clsx } from 'clsx'
import { guestGetMenu, guestPlaceOrder, guestGetStatus, guestGetTable, guestCall } from '../api/tableOrdering'

// ₹290 for whole rupees, ₹304.50 (never ₹304.5) when there are paise.
const inr = n => {
  const v = Number(n || 0)
  const paise = Math.round(v * 100) % 100 !== 0
  return '₹' + v.toLocaleString('en-IN', { minimumFractionDigits: paise ? 2 : 0, maximumFractionDigits: 2 })
}
const FINAL = ['rejected', 'paid', 'cancelled']  // 'served' isn't final: keep polling until the bill is paid
const POLL_MS = 15000

// Per-table memory of what this phone has ordered, so a refresh keeps the
// status screen. Storage can be blocked (private mode) — fail soft.
const storeKey = token => `bb_guest_${token.slice(-16)}`
function loadPlaced(token) {
  try {
    const v = JSON.parse(localStorage.getItem(storeKey(token)) || '[]')
    // forget orders older than 6h, so a later visit to the same table starts fresh
    return v.filter(p => Date.now() - p.at < 6 * 3600 * 1000)
  } catch { return [] }
}
function rememberPlaced(token, res) {
  const list = [{ id: res.request_id, key: res.access_key, at: Date.now() }, ...loadPlaced(token)]
  try { localStorage.setItem(storeKey(token), JSON.stringify(list)) } catch { /* ignore */ }
  return list
}

// Payment without a gateway. A bare upi:// link lets Android open whatever app
// last claimed UPI (often WhatsApp), so each app gets its own button. Only apps
// whose links work on this phone are shown: Android can target any installed app
// (and offers the system chooser as "Other app"); iPhone only the big three via
// their own link schemes; a computer gets just the UPI ID. Copying the UPI ID
// always works, with any app.
const UPI_APPS = [
  { name: 'GPay', pkg: 'com.google.android.apps.nbu.paisa.user', ios: 'gpay://upi/pay' },
  { name: 'PhonePe', pkg: 'com.phonepe.app', ios: 'phonepe://pay' },
  { name: 'Paytm', pkg: 'net.one97.paytm', ios: 'paytmmp://pay' },
  { name: 'CRED', pkg: 'com.dreamplug.androidapp' },
  { name: 'BHIM', pkg: 'in.org.npci.upiapp' },
]
const UA = typeof navigator !== 'undefined' ? navigator.userAgent || '' : ''
const IS_ANDROID = /Android/i.test(UA)
const IS_IOS = /iPhone|iPad|iPod/i.test(UA) || (/Macintosh/.test(UA) && typeof document !== 'undefined' && 'ontouchend' in document)

function PaySheet({ bill, busy, onClose, onUpi, onCounter }) {
  const [copied, setCopied] = useState(false)
  const link = bill.upi_link
  const query = link ? link.slice(link.indexOf('?') + 1) : ''
  const vpa = link ? new URLSearchParams(query).get('pa') || '' : ''
  const apps = IS_ANDROID ? UPI_APPS : IS_IOS ? UPI_APPS.filter(a => a.ios) : []
  const href = a => (IS_ANDROID ? `intent://pay?${query}#Intent;scheme=upi;package=${a.pkg};end` : `${a.ios}?${query}`)

  const openApp = (e, url) => {
    e.preventDefault()
    onUpi()                            // tell staff (fire-and-forget) before leaving the page
    window.location.assign(url)
  }
  const copy = async () => {
    try { await navigator.clipboard.writeText(vpa) } catch {
      const t = document.createElement('textarea'); t.value = vpa; document.body.appendChild(t); t.select()
      try { document.execCommand('copy') } catch { /* ignore */ } t.remove()
    }
    setCopied(true); setTimeout(() => setCopied(false), 2000)
    onUpi(true)
  }

  return (
    <div className="fixed inset-0 z-40 bg-black/40 flex items-end justify-center" onClick={onClose}>
      <div className="w-full max-w-2xl bg-bg2 rounded-t-2xl max-h-[90vh] overflow-y-auto p-4 pb-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="font-display font-bold text-lg">Pay <span className="tabular-nums">{inr(bill.total_amount)}</span></h2>
          <button aria-label="Close" onClick={onClose} className="p-1.5 text-text3"><X size={18} /></button>
        </div>

        {link ? (
          <>
            <p className="mt-3 mb-2 text-[11px] font-bold uppercase tracking-wide text-text3">Pay by UPI</p>
            {apps.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {apps.map(a => (
                  <a key={a.name} href={href(a)} onClick={e => openApp(e, href(a))}
                    className="h-12 flex items-center justify-center rounded-xl border border-border2 bg-bg text-sm font-bold text-text active:scale-[0.97] transition-transform">
                    {a.name}
                  </a>
                ))}
                {IS_ANDROID && (
                  <a href={link} onClick={e => openApp(e, link)}
                    className="h-12 flex items-center justify-center rounded-xl border border-dashed border-border2 bg-bg text-sm font-semibold text-text2 active:scale-[0.97] transition-transform">
                    Other app
                  </a>
                )}
              </div>
            )}
            <div className={clsx('flex items-center gap-3 rounded-xl border border-border2 bg-bg px-3 py-2.5', apps.length > 0 && 'mt-2')}>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] uppercase tracking-wide text-text3">UPI ID · works with any UPI app</p>
                <p className="text-sm font-semibold truncate">{vpa}</p>
              </div>
              <button onClick={copy}
                className={clsx('h-8 px-3 rounded-lg text-xs font-bold border transition-colors flex-shrink-0',
                  copied ? 'bg-green text-white border-green' : 'border-green text-green')}>
                {copied ? 'Copied ✓' : 'Copy'}
              </button>
            </div>
            <p className="mt-2 text-[11px] text-text3">After paying, show the payment screen to staff. This page turns to “Paid” once they confirm.</p>
            <p className="mt-4 mb-2 text-[11px] font-bold uppercase tracking-wide text-text3">Or pay at the table</p>
          </>
        ) : (
          <p className="mt-3 mb-2 text-[11px] font-bold uppercase tracking-wide text-text3">Pay at the table</p>
        )}

        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => onCounter('cash')} disabled={busy}
            className="h-12 rounded-xl border border-border2 bg-bg text-sm font-bold flex items-center justify-center gap-2 active:scale-[0.97] disabled:opacity-60">
            <Banknote size={16} /> Cash
          </button>
          <button onClick={() => onCounter('card')} disabled={busy}
            className="h-12 rounded-xl border border-border2 bg-bg text-sm font-bold flex items-center justify-center gap-2 active:scale-[0.97] disabled:opacity-60">
            <CreditCard size={16} /> Card
          </button>
        </div>
        <p className="mt-2 text-[11px] text-center text-text3">Staff will come to your table with the bill.</p>
      </div>
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

// Which bills this phone watched while unpaid, and which "Paid" moments it has
// already celebrated — so the animation plays once, only for a payment the
// guest was actually waiting on (not an old bill seen on a later visit).
const BILLS_KEY = 'bb_guest_bills'
function billMarks() {
  try { return JSON.parse(localStorage.getItem(BILLS_KEY) || '{}') } catch { return {} }
}
function markBill(no, state) {
  try {
    const m = billMarks()
    if (m[no] === state) return
    m[no] = state
    const keys = Object.keys(m)
    keys.slice(0, Math.max(0, keys.length - 30)).forEach(k => delete m[k])  // keep the last 30
    localStorage.setItem(BILLS_KEY, JSON.stringify(m))
  } catch { /* storage blocked — no animation, the Paid card still shows */ }
}

function PaidCelebration({ amount, restaurant, onDone }) {
  // Keep the latest callback without restarting the timer on every re-render (polls).
  const done = useRef(onDone)
  useEffect(() => { done.current = onDone })
  useEffect(() => {
    const t = setTimeout(() => done.current(), 3200)
    return () => clearTimeout(t)
  }, [])
  return (
    <div role="status" aria-live="polite" onClick={() => done.current()}
      className="bb-paid fixed inset-0 z-50 flex flex-col items-center justify-center bg-bg px-6 text-center cursor-pointer">
      <style>{`
        .bb-paid { animation: bbFade .25s ease-out both; }
        .bb-paid .ring { animation: bbRing 1.6s ease-out .35s both; }
        .bb-paid .disc { animation: bbPop .55s cubic-bezier(.2,1.4,.4,1) .05s both; }
        .bb-paid .tick { stroke-dasharray: 60; stroke-dashoffset: 60; animation: bbDraw .45s ease-out .5s forwards; }
        .bb-paid .txt  { animation: bbUp .45s ease-out both; }
        @keyframes bbFade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes bbPop  { 0% { transform: scale(0) } 100% { transform: scale(1) } }
        @keyframes bbDraw { to { stroke-dashoffset: 0 } }
        @keyframes bbRing { 0% { transform: scale(.8); opacity: .55 } 100% { transform: scale(1.9); opacity: 0 } }
        @keyframes bbUp   { from { opacity: 0; transform: translateY(10px) } to { opacity: 1; transform: none } }
        @media (prefers-reduced-motion: reduce) {
          .bb-paid, .bb-paid .ring, .bb-paid .disc, .bb-paid .txt { animation: none }
          .bb-paid .tick { animation: none; stroke-dashoffset: 0 }
        }
      `}</style>
      <div className="relative w-28 h-28 mb-6">
        <span className="ring absolute inset-0 rounded-full bg-green" />
        <span className="disc absolute inset-0 rounded-full bg-green flex items-center justify-center shadow-lg">
          <svg viewBox="0 0 52 52" className="w-14 h-14" fill="none" stroke="white" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
            <path className="tick" d="M14 27 l8 8 l16 -18" />
          </svg>
        </span>
      </div>
      <p className="txt text-2xl font-display font-bold text-text" style={{ animationDelay: '.7s' }}>Payment received</p>
      <p className="txt mt-1 text-3xl font-bold tabular-nums text-green" style={{ animationDelay: '.8s' }}>{inr(amount)}</p>
      <p className="txt mt-3 text-sm text-text3" style={{ animationDelay: '.95s' }}>Thank you for dining at {restaurant}!</p>
      <p className="txt absolute bottom-8 text-xs text-muted" style={{ animationDelay: '1.6s' }}>Tap to continue</p>
    </div>
  )
}

function stepOf(s) {
  if (s.status === 'pending') return { label: 'Waiting for staff to confirm', icon: Clock, tone: 'amber' }
  if (s.status === 'rejected') return { label: 'Not accepted', icon: CircleX, tone: 'red' }
  const k = s.kitchen_status
  if (k === 'paid') return { label: 'Paid — thank you!', icon: Check, tone: 'green' }
  if (k === 'cancelled') return { label: 'Cancelled — please ask staff', icon: CircleX, tone: 'red' }
  if (k === 'served') return { label: 'Served — enjoy!', icon: Check, tone: 'green' }
  if (k === 'ready') return { label: 'Ready — coming to your table', icon: Bell, tone: 'green' }
  if (k === 'preparing') return { label: 'Being prepared', icon: ChefHat, tone: 'blue' }
  return { label: 'Sent to the kitchen', icon: ChefHat, tone: 'blue' }
}

const TONE = {
  amber: 'bg-amber-dim text-amber', red: 'bg-red-dim text-red',
  green: 'bg-green-dim text-green', blue: 'bg-blue-dim text-blue',
}

// Scanning another table's QR while this page is open only changes the URL
// hash — React would keep the old table's state (orders, "Paid", tab). Keying
// by token gives every table a completely fresh page.
export default function GuestOrder() {
  const { token } = useParams()
  return <GuestOrderPage key={token} token={token} />
}

function GuestOrderPage({ token }) {
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
  const [table, setTable] = useState(null)       // shared: running bill, pending orders, open calls
  const [calling, setCalling] = useState(null)   // 'waiter' | 'bill' while sending
  const [paySheet, setPaySheet] = useState(false)
  const [callMsg, setCallMsg] = useState(null)

  // The open bill's number we've seen: lets this phone (only) see it turn "Paid".
  const seenBill = useRef(null)
  const refreshTable = useCallback(() => guestGetTable(token, seenBill.current).then(t => {
    if (t?.bill?.order_number) seenBill.current = t.bill.order_number
    setTable(t)
  }).catch(() => {}), [token])
  // Everyone at the table sees the same bill, so poll it while the page is open.
  useEffect(() => {
    refreshTable()
    const t = setInterval(() => { if (!document.hidden) refreshTable() }, POLL_MS)
    const onVis = () => { if (!document.hidden) refreshTable() }
    document.addEventListener('visibilitychange', onVis)
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVis) }
  }, [refreshTable])

  // Remember bills this phone saw while unpaid (see billMarks).
  const watchedBill = (table?.bill || placed.map(p => statuses[p.id]?.bill).find(Boolean)) || null
  const watchedNo = watchedBill?.payment_status === 'unpaid' ? watchedBill.order_number : null
  useEffect(() => { if (watchedNo && !billMarks()[watchedNo]) markBill(watchedNo, 'open') }, [watchedNo])
  const [, setCelebrated] = useState(0)
  const finishPaid = useCallback(no => {
    markBill(no, 'celebrated'); setView('status'); setCelebrated(n => n + 1)
  }, [])

  async function callStaff(kind, payBy) {
    setCalling(kind); setCallMsg(null)
    try {
      await guestCall(token, { kind, pay_by: payBy || null })
      setCallMsg(kind === 'bill'
        ? `Staff will bring the bill${payBy ? ` — paying by ${payBy}` : ''}.`
        : 'Waiter called — someone will be with you shortly.')
      setPaySheet(false)
      refreshTable()
    } catch (e) {
      setCallMsg(e.message)
    } finally {
      setCalling(null)
    }
  }
  // Guest tapped a UPI app (or copied the UPI ID): let staff know to check for
  // the payment. Fire-and-forget with keepalive — the page may be leaving.
  function startUpi(stay) {
    guestCall(token, { kind: 'bill', pay_by: 'upi' }, { keepalive: true }).then(refreshTable).catch(() => {})
    setCallMsg('Paying by UPI — show the payment screen to staff. This page updates once they confirm.')
    if (!stay) setTimeout(() => setPaySheet(false), 300)
  }


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
      refreshTable()
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

  const bill = table?.bill || placed.map(p => statuses[p.id]?.bill).find(Boolean)
  const billNo = bill?.order_number
  const billPaid = bill?.payment_status === 'paid'
  const showPaid = billPaid && billMarks()[billNo] === 'open'
  const mine = new Set(placed.map(p => p.id))
  const othersPending = (table?.pending || []).filter(r => !mine.has(r.id))
  const calls = new Set(table?.calls || [])
  const unpaidBill = bill && bill.payment_status !== 'paid'
  const tableBusy = !!unpaidBill || othersPending.length > 0  // a paid bill doesn't block the next guests
  const tableItemCount = (unpaidBill ? bill.items : []).reduce((n, i) => n + i.quantity, 0)
    + othersPending.reduce((n, r) => n + r.items.reduce((m, i) => m + i.quantity, 0), 0)

  return (
    <div className="min-h-screen bg-bg text-text pb-28">
      {showPaid && (
        <PaidCelebration amount={bill.total_amount} restaurant={menu.restaurant_name} onDone={() => finishPaid(billNo)} />
      )}
      {/* Header */}
      <header className="sticky top-0 z-20 bg-bg2/95 backdrop-blur border-b border-border">
        <div className="max-w-2xl mx-auto px-4 pt-3 pb-2">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="font-display font-bold text-[17px] truncate">{menu.restaurant_name}</h1>
              <p className="text-xs text-text3">Table {menu.table_number}</p>
            </div>
            {(
              <div className="flex bg-surface2 rounded-lg p-0.5 text-xs font-semibold flex-shrink-0">
                {['menu', 'status'].map(v => (
                  <button key={v} onClick={() => setView(v)}
                    className={clsx('px-3 py-1.5 rounded-md', view === v ? 'bg-bg2 text-text shadow-sm' : 'text-text3')}>
                    {v === 'menu' ? 'Menu' : 'Table'}
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
        {view === 'menu' && tableBusy && (
          <button onClick={() => setView('status')}
            className="mt-3 w-full flex items-center gap-2 rounded-xl bg-blue-dim text-blue px-3 py-2.5 text-xs font-semibold text-left">
            <Users size={15} className="flex-shrink-0" />
            <span className="flex-1">{tableItemCount} item{tableItemCount === 1 ? '' : 's'} already ordered at this table. Check before ordering again.</span>
            <span className="font-bold">View →</span>
          </button>
        )}
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
            <div className="flex gap-2">
              <button onClick={() => callStaff('waiter')} disabled={!!calling || calls.has('waiter')}
                className={clsx('flex-1 h-12 rounded-xl border text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-100',
                  calls.has('waiter') ? 'bg-blue-dim border-blue/30 text-blue' : 'bg-bg2 border-border2 text-text')}>
                {calling === 'waiter' ? <Loader2 size={16} className="animate-spin" /> : calls.has('waiter') ? <Check size={16} /> : <BellRing size={16} />}
                {calls.has('waiter') ? 'Waiter called' : 'Call waiter'}
              </button>
              {calls.has('bill') && unpaidBill && (
                <div className="flex-1 h-12 rounded-xl border bg-green-dim border-green/30 text-green text-sm font-bold flex items-center justify-center gap-2">
                  <Check size={16} /> Staff notified
                </div>
              )}
            </div>
            {billPaid
              ? <p className="text-xs text-center text-text3">Any questions about the bill? Call a waiter.</p>
              : callMsg && <p className="text-xs text-center text-text3">{callMsg}</p>}

            {othersPending.length > 0 && (
              <section className="rounded-xl bg-bg2 border border-border overflow-hidden">
                <div className={clsx('flex items-center gap-2 px-4 py-3 text-sm font-semibold', TONE.amber)}>
                  <Users size={16} /> Ordered by others at this table
                </div>
                {othersPending.map(r => (
                  <div key={r.id} className="px-4 py-2 text-sm border-t border-border first:border-t-0">
                    <p className="text-[11px] text-text3 mb-0.5">{r.guest_name || 'Someone'} · waiting for staff</p>
                    {r.items.map((it, j) => <p key={j}>{it.quantity} × {it.name}</p>)}
                  </div>
                ))}
              </section>
            )}

            {!bill && !othersPending.length && !placed.length && (
              <p className="py-8 text-center text-sm text-text3">Nothing ordered at this table yet.</p>
            )}

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

            {bill && (
              <section className="rounded-xl bg-bg2 border border-border p-4">
                <h2 className="font-display font-bold mb-0.5">Table bill</h2>
                <p className="text-[11px] text-text3 mb-2">Everything ordered at this table, by anyone</p>
                <ul className="text-sm space-y-1">
                  {bill.items.map((it, j) => (
                    <li key={j} className="flex justify-between"><span>{it.quantity} × {it.name}</span><span className="tabular-nums">{inr(it.total)}</span></li>
                  ))}
                </ul>
                <div className="border-t border-border mt-3 pt-2 text-sm space-y-1">
                  <div className="flex justify-between text-text3"><span>Subtotal</span><span className="tabular-nums">{inr(bill.subtotal)}</span></div>
                  {bill.discount_amount > 0 && <div className="flex justify-between text-text3"><span>Discount</span><span className="tabular-nums">−{inr(bill.discount_amount)}</span></div>}
                  <div className="flex justify-between text-text3"><span>GST</span><span className="tabular-nums">{inr(bill.gst_amount)}</span></div>
                  <div className="flex justify-between font-bold text-base pt-1"><span>Total</span><span className="tabular-nums">{inr(bill.total_amount)}</span></div>
                </div>
                {bill.payment_status === 'paid' ? (
                  <div className="mt-3 rounded-xl bg-green-dim text-green py-3 text-center">
                    <p className="text-base font-bold flex items-center justify-center gap-1.5"><Check size={18} /> Paid</p>
                    <p className="text-xs">Thank you! Visit again.</p>
                  </div>
                ) : null}
              </section>
            )}

            {/* After paying, the visit is done — no "Order more" (the Menu tab is still there). */}
            {!billPaid && (
              <button onClick={() => setView('menu')} className="w-full py-3 rounded-xl border border-border2 text-sm font-semibold text-text2 bg-bg2">
                {placed.length || bill || othersPending.length ? '+ Order more' : 'See the menu'}
              </button>
            )}
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

      {/* Pay bar — always in reach on the Table view while the bill is open */}
      {view === 'status' && unpaidBill && !paySheet && (
        <div className="fixed bottom-0 inset-x-0 z-30 p-3 bg-gradient-to-t from-bg via-bg to-transparent">
          <button onClick={() => setPaySheet(true)}
            className="max-w-2xl mx-auto w-full flex items-center justify-between px-4 py-3.5 rounded-xl bg-green text-white font-bold shadow-lg">
            <span className="flex items-center gap-2"><Receipt size={18} /> Pay bill</span>
            <span className="tabular-nums">{inr(bill.total_amount)} →</span>
          </button>
        </div>
      )}

      {paySheet && unpaidBill && (
        <PaySheet bill={bill} busy={!!calling} onClose={() => setPaySheet(false)}
          onUpi={startUpi} onCounter={method => callStaff('bill', method)} />
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
