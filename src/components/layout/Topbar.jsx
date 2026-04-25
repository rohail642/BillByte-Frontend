import { useState, useRef, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Menu, Bell, TrendingUp, Plus } from 'lucide-react'
import { useUIStore } from '../../store/ui'
import { useAuthStore } from '../../store/auth'
import { getAlerts } from '../../api/inventory'
import { getOrders, getDashboardSummary } from '../../api/orders'
import { formatINR } from '../../utils'

const titles = {
  '/':              'Dashboard',
  '/billing':       'Billing / POS',
  '/orders':        'Orders',
  '/online-orders': 'Online Orders',
  '/menu':          'Menu',
  '/inventory':     'Inventory',
  '/crm':           'CRM & Loyalty',
  '/staff':         'Staff',
  '/reports':       'Reports',
  '/settings':      'Settings',
}

export default function Topbar() {
  const { toggleSidebar } = useUIStore()
  const { restaurantName, user } = useAuthStore()
  const isCashier = user?.role === 'cashier' || user?.role === 'waiter'
  const location  = useLocation()
  const navigate  = useNavigate()
  const title     = titles[location.pathname] || 'BillByte'
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  // Close on outside click
  useEffect(() => {
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const { data: alerts } = useQuery({
    queryKey: ['alerts'],
    queryFn: getAlerts,
    refetchInterval: 60000,
  })

  const { data: liveOrders } = useQuery({
    queryKey: ['orders', 'live'],
    queryFn: () => getOrders({ limit: 50 }),
    refetchInterval: 10000,
  })

  const { data: summary } = useQuery({
    queryKey: ['summary'],
    queryFn: getDashboardSummary,
    refetchInterval: 30000,
  })

  // Build notifications
  const notifications = []

  // Low stock alerts
  if (alerts?.low_stock_count > 0) {
    notifications.push({
      id: 'low-stock',
      type: 'warning',
      icon: '📦',
      title: `${alerts.low_stock_count} item${alerts.low_stock_count > 1 ? 's' : ''} running low`,
      desc: alerts.low_stock_items.slice(0, 3).map(i => typeof i === 'string' ? i : i.name).join(', ') + (alerts.low_stock_items.length > 3 ? '...' : ''),
      action: () => { navigate('/inventory'); setOpen(false) },
    })
  }

  // Expiring soon
  if (alerts?.expiring_soon_count > 0) {
    notifications.push({
      id: 'expiring',
      type: 'danger',
      icon: '⏰',
      title: `${alerts.expiring_soon_count} item${alerts.expiring_soon_count > 1 ? 's' : ''} expiring soon`,
      desc: alerts.expiring_items.slice(0, 2).map(i => typeof i === 'string' ? i : i.name).join(', '),
      action: () => { navigate('/inventory'); setOpen(false) },
    })
  }

  // Pending orders (KOT sent but not paid)
  const pendingOrders = (liveOrders || []).filter(o =>
    o.status === 'kot_sent' && o.payment_status !== 'paid'
  )
  if (pendingOrders.length > 0) {
    notifications.push({
      id: 'pending-orders',
      type: 'info',
      icon: '🍽️',
      title: `${pendingOrders.length} active order${pendingOrders.length > 1 ? 's' : ''} in kitchen`,
      desc: pendingOrders.map(o => o.order_number).slice(0, 2).join(', '),
      action: () => { navigate('/orders'); setOpen(false) },
    })
  }

  const totalCount = notifications.length

  return (
    <header className="h-[60px] bg-bg2 border-b border-border flex items-center justify-between px-4 flex-shrink-0">
      <div className="flex items-center gap-3">
        <button onClick={toggleSidebar}
          className="lg:hidden p-2 rounded-lg text-text3 hover:text-text hover:bg-surface2 transition-colors">
          <Menu size={18} />
        </button>
        <div>
          <h1 className="font-display font-bold text-[15px] text-text">{title}</h1>
          <p className="text-[11px] text-muted hidden sm:block">
            {restaurantName || 'BillByte'} · {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' })}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="hidden sm:flex items-center gap-1.5 bg-green-dim border border-green/25 text-green rounded-full px-3 py-1 text-[11px] font-bold">
          <span className="w-1.5 h-1.5 rounded-full bg-green animate-pulse" />
          Live
        </div>

        {/* Bell */}
        <div className="relative" ref={ref}>
          <button
            onClick={() => setOpen(v => !v)}
            className="relative p-2 rounded-lg text-text3 hover:text-text hover:bg-surface2 transition-colors">
            <Bell size={17} />
            {totalCount > 0 && (
              <span className="absolute top-1 right-1 min-w-[16px] h-4 rounded-full bg-orange text-white text-[9px] font-bold flex items-center justify-center px-0.5">
                {totalCount}
              </span>
            )}
          </button>

          {/* Dropdown */}
          {open && (
            <div className="absolute right-0 top-full mt-2 w-72 bg-surface border border-border rounded-2xl shadow-lg z-50 overflow-hidden animate-fadeUp">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <p className="font-display font-bold text-sm text-text">Notifications</p>
                {totalCount > 0 && (
                  <span className="text-[10px] text-muted">{totalCount} alert{totalCount > 1 ? 's' : ''}</span>
                )}
              </div>

              {notifications.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <p className="text-2xl mb-2">✅</p>
                  <p className="text-sm font-semibold text-text">All good!</p>
                  <p className="text-xs text-muted">No alerts right now</p>
                </div>
              ) : (
                <div className="divide-y divide-border max-h-80 overflow-y-auto">
                  {notifications.map(n => (
                    <button key={n.id} onClick={n.action}
                      className="w-full flex items-start gap-3 px-4 py-3 hover:bg-surface2 transition-colors text-left">
                      <span className="text-lg flex-shrink-0 mt-0.5">{n.icon}</span>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-text">{n.title}</p>
                        {n.desc && <p className="text-[10px] text-muted mt-0.5 truncate">{n.desc}</p>}
                      </div>
                      <span className={`flex-shrink-0 w-2 h-2 rounded-full mt-1.5 ${
                        n.type === 'danger' ? 'bg-red' : n.type === 'warning' ? 'bg-orange' : 'bg-blue'
                      }`} />
                    </button>
                  ))}
                </div>
              )}

              <div className="px-4 py-2 border-t border-border">
                <button onClick={() => { navigate('/inventory'); setOpen(false) }}
                  className="text-xs text-green2 font-semibold hover:underline">
                  View Inventory Alerts →
                </button>
              </div>
            </div>
          )}
        </div>

        {isCashier ? (
          <button
            onClick={() => navigate('/billing')}
            className="hidden sm:flex items-center gap-1.5 bg-green text-white rounded-full px-3 py-1.5 text-[11px] font-bold hover:opacity-90 transition-opacity">
            <Plus size={12} />
            New Bill
          </button>
        ) : (
          <button
            onClick={() => navigate('/reports')}
            className="hidden sm:flex items-center gap-1.5 bg-surface2 border border-border hover:border-green/40 hover:bg-green-dim text-text2 hover:text-green2 rounded-full px-3 py-1.5 text-[11px] font-bold transition-all">
            <TrendingUp size={12} />
            {summary?.today_revenue != null ? formatINR(summary.today_revenue) : '—'}
            <span className="text-muted font-normal">today</span>
          </button>
        )}
      </div>
    </header>
  )
}