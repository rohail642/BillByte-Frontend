import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { LogOut, Clock, UtensilsCrossed, ShoppingBag, Bike } from 'lucide-react'
import { clsx } from 'clsx'
import toast from 'react-hot-toast'
import { getOrders, updateKotStatus } from '../api/orders'
import { useAuthStore } from '../store/auth'
import Spinner from '../components/ui/Spinner'
import { timeAgo } from '../utils'

const KITCHEN_STATUSES = ['kot_sent', 'preparing', 'ready']

const STATUS_CONFIG = {
  kot_sent:  { label: 'New Order', next: 'preparing', action: 'Start Cooking', border: 'border-orange', bg: 'bg-orange-dim', text: 'text-orange', btn: 'bg-orange text-white hover:bg-orange/90'  },
  preparing: { label: 'Cooking',   next: 'ready',     action: 'Mark Ready',    border: 'border-blue',   bg: 'bg-blue-dim',   text: 'text-blue',   btn: 'bg-blue text-white hover:bg-blue/90'      },
  ready:     { label: 'Ready',     next: 'served',    action: 'Mark Served',   border: 'border-green',  bg: 'bg-green-dim',  text: 'text-green2', btn: 'bg-green text-white hover:bg-green/90'    },
}

const TYPE_ICON  = { dine_in: UtensilsCrossed, takeaway: ShoppingBag, delivery: Bike }
const TYPE_LABEL = { dine_in: 'Dine-in', takeaway: 'Takeaway', delivery: 'Delivery' }

// Get per-KOT status, falling back to order.status for legacy orders
function kotStatus(order, kotNumber) {
  if (order.kot_statuses && order.kot_statuses[String(kotNumber)]) {
    return order.kot_statuses[String(kotNumber)]
  }
  return order.status
}

// Build one card per active KOT (skip served KOTs)
function buildKotCards(orders) {
  const cards = []
  for (const order of orders) {
    const allItems = order.items || []
    const kotNums  = [...new Set(allItems.map(i => i.kot_number ?? 1))].sort((a, b) => a - b)

    for (const k of kotNums) {
      const status = kotStatus(order, k)
      if (status === 'served') continue  // already done, hide it
      const items = allItems.filter(i => (i.kot_number ?? 1) === k)
      if (!items.length) continue
      // Hide KOT card if every item in it was cancelled
      if (items.every(i => i.cancelled_at)) continue
      cards.push({ key: `${order.id}-kot${k}`, order, kotNumber: k, kotSt: status, items })
    }
  }
  return cards
}

export default function KitchenDisplay() {
  const { user, restaurantName, clearAuth } = useAuthStore()
  const qc = useQueryClient()

  const { data: allOrders = [], isLoading } = useQuery({
    queryKey: ['kitchenOrders'],
    queryFn:  () => getOrders({ limit: 100 }),
    refetchInterval: 5000,
  })

  const advanceMut = useMutation({
    mutationFn: ({ id, kotNum, status }) => updateKotStatus(id, kotNum, status),
    onSuccess: (_, { status }) => {
      const label = STATUS_CONFIG[status]?.label || status
      toast.success(`KOT updated — ${label}`)
      qc.invalidateQueries({ queryKey: ['kitchenOrders'] })
    },
    onError: e => toast.error(String(e)),
  })

  const orders = allOrders.filter(o => KITCHEN_STATUSES.includes(o.status))

  const sorted = [...orders].sort((a, b) => {
    const si = KITCHEN_STATUSES.indexOf(a.status) - KITCHEN_STATUSES.indexOf(b.status)
    if (si !== 0) return si
    return new Date(a.created_at) - new Date(b.created_at)
  })

  const cards = buildKotCards(sorted)

  return (
    <div className="h-screen flex flex-col bg-bg overflow-hidden">

      {/* ── Header ── */}
      <div className="h-[60px] bg-bg2 border-b border-border flex items-center px-4 gap-3 flex-shrink-0">
        <div className="font-display font-black text-xl tracking-tight">
          <span className="text-text2">Bill</span><span className="text-green">Byte</span>
        </div>
        <span className="text-xs font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-orange-dim text-orange">
          Kitchen
        </span>
        {restaurantName && (
          <span className="text-xs text-muted hidden sm:block">{restaurantName}</span>
        )}

        <div className="flex-1" />

        <div className="flex items-center gap-1.5 text-xs text-muted">
          <span className="w-2 h-2 rounded-full bg-green animate-pulse inline-block" />
          <span className="hidden sm:block">Live</span>
        </div>

        {orders.length > 0 && (
          <span className="bg-orange text-white text-xs font-bold px-2.5 py-1 rounded-full">
            {orders.length} {orders.length === 1 ? 'order' : 'orders'}
          </span>
        )}

        <div className="flex items-center gap-2 ml-1">
          <div className="w-7 h-7 rounded-full bg-orange text-white flex items-center justify-center text-[11px] font-bold">
            {(user?.name || 'K').slice(0, 1).toUpperCase()}
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

      {/* ── Body ── */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex justify-center items-center h-full">
            <Spinner size="lg" />
          </div>
        ) : cards.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
            <span className="text-6xl opacity-20">👨‍🍳</span>
            <p className="font-display font-bold text-text2 text-lg">All clear</p>
            <p className="text-sm text-muted">No active orders right now</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {cards.map(card => (
              <KotCard
                key={card.key}
                card={card}
                onAdvance={(id, kotNum, status) => advanceMut.mutate({ id, kotNum, status })}
                isLoading={
                  advanceMut.isPending &&
                  advanceMut.variables?.id === card.order.id &&
                  advanceMut.variables?.kotNum === card.kotNumber
                }
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}


function KotCard({ card, onAdvance, isLoading }) {
  const { order, kotNumber, kotSt, items } = card
  const cfg      = STATUS_CONFIG[kotSt] ?? STATUS_CONFIG.kot_sent
  const TypeIcon = TYPE_ICON[order.order_type] || UtensilsCrossed

  // Use the earliest item created_at for this KOT so KOT 2 shows its actual send time
  const kotTimestamp = items
    .map(i => i.created_at)
    .filter(Boolean)
    .sort()[0] || order.created_at

  const ageMinutes = Math.floor((Date.now() - new Date(kotTimestamp)) / 60000)
  const isOld      = ageMinutes >= 15

  // Check if this order has multiple KOT batches so we can show the KOT number
  const allKotNums = [...new Set((order.items || []).map(i => i.kot_number ?? 1))]
  const isMultiKot = allKotNums.length > 1

  return (
    <div className={clsx(
      'bg-surface rounded-xl border-l-4 border border-border flex flex-col overflow-hidden',
      cfg.border
    )}>
      {/* Header */}
      <div className={clsx('px-4 py-2.5 flex items-center justify-between gap-2', cfg.bg)}>
        <div className="flex items-center gap-1.5">
          <span className={clsx('text-xs font-bold uppercase tracking-wide', cfg.text)}>
            {cfg.label}
          </span>
          {isMultiKot && (
            <span className={clsx(
              'text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full text-white',
              kotSt === 'preparing' ? 'bg-blue' : kotSt === 'ready' ? 'bg-green' : 'bg-orange'
            )}>
              KOT {kotNumber}
            </span>
          )}
        </div>
        <div className={clsx(
          'flex items-center gap-1 text-xs font-semibold',
          isOld ? 'text-red' : 'text-muted'
        )}>
          <Clock size={11} />
          <span>{timeAgo(kotTimestamp)}</span>
          {isOld && <span className="text-red">⚠</span>}
        </div>
      </div>

      {/* Order info */}
      <div className="px-4 pt-3 pb-2 flex items-center justify-between gap-2">
        <span className="font-display font-black text-lg text-text">{order.order_number}</span>
        <div className="flex items-center gap-1.5 text-xs text-muted">
          <TypeIcon size={13} />
          <span>{TYPE_LABEL[order.order_type] || order.order_type}</span>
          {order.table_number && (
            <span className="font-bold text-text bg-surface2 px-1.5 py-0.5 rounded">
              T{order.table_number}
            </span>
          )}
        </div>
      </div>

      {/* Items */}
      <ul className="px-4 pb-3 space-y-2 flex-1 border-t border-border pt-3">
        {items.map(item => {
          const voided = !!item.cancelled_at
          return (
            <li key={item.id} className="flex items-baseline justify-between gap-2">
              <span className={clsx(
                'text-sm font-semibold leading-snug flex items-center gap-1.5',
                voided ? 'line-through text-red opacity-60' : 'text-text'
              )}>
                {item.name}
                {voided && (
                  <span className="text-[9px] font-bold uppercase text-red not-italic opacity-100 bg-red-dim px-1 py-0.5 rounded">
                    Cancelled
                  </span>
                )}
              </span>
              <span className={clsx(
                'text-base font-black flex-shrink-0',
                voided ? 'text-red opacity-60' : 'text-text'
              )}>
                ×{item.quantity}
              </span>
            </li>
          )
        })}
      </ul>

      {order.notes && (
        <p className="mx-4 mb-3 text-xs text-muted bg-surface2 rounded-lg px-3 py-2">
          📝 {order.notes}
        </p>
      )}

      {/* Action button — every KOT gets its own */}
      {cfg.next && (
        <div className="px-3 pb-3">
          <button
            onClick={() => onAdvance(order.id, kotNumber, cfg.next)}
            disabled={isLoading}
            className={clsx(
              'w-full py-2.5 rounded-lg text-sm font-bold transition-all',
              isLoading ? 'opacity-50 cursor-not-allowed bg-surface2 text-muted' : cfg.btn
            )}
          >
            {isLoading ? 'Updating…' : cfg.action}
          </button>
        </div>
      )}
    </div>
  )
}
