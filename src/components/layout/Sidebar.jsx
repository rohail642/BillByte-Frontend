import { NavLink, useNavigate } from 'react-router-dom'
import { useUIStore } from '../../store/ui'
import { useAuthStore } from '../../store/auth'
import { useQuery } from '@tanstack/react-query'
import { getAlerts } from '../../api/inventory'
import {
  Receipt, ShoppingBag, UtensilsCrossed, Package,
  Users, ChefHat, BarChart2, Settings, LogOut, ClipboardList, Bike, LayoutDashboard, Headphones, Mail, Phone
} from 'lucide-react'
import { clsx } from 'clsx'

const NAV_CONFIG = [
  {
    label: 'Main',
    items: [
      { to: '/',              icon: LayoutDashboard, label: 'Dashboard',      roles: ['owner', 'manager'] },
      { to: '/billing',       icon: Receipt,          label: 'Billing / POS', roles: ['cashier', 'manager'] },
      { to: '/tables',        icon: UtensilsCrossed,  label: 'Tables',        roles: ['cashier', 'manager'] },
      { to: '/orders',        icon: ClipboardList,    label: 'Orders',        roles: ['owner', 'cashier', 'manager'] },
      { to: '/online-orders', icon: Bike,             label: 'Online Orders',    roles: ['owner', 'cashier', 'manager'] },
      { to: '/kitchen',       icon: ChefHat,          label: 'Kitchen Display',  roles: ['kitchen'] },
      { to: '/menu',          icon: UtensilsCrossed,  label: 'Menu',          roles: ['owner', 'manager'] },
    ],
  },
  {
    label: 'Management',
    items: [
      { to: '/inventory', icon: Package,   label: 'Inventory', roles: ['owner', 'cashier', 'manager'], badge: true, module: 'inventory' },
      { to: '/crm',       icon: Users,     label: 'CRM',       roles: ['owner', 'cashier', 'manager'], module: 'crm' },
      { to: '/staff',     icon: ChefHat,   label: 'Staff',     roles: ['owner', 'manager'],             module: 'staff' },
      { to: '/reports',   icon: BarChart2, label: 'Reports',   roles: ['owner', 'manager'],             module: 'reports' },
    ],
  },
  {
    label: 'System',
    items: [
      { to: '/settings', icon: Settings, label: 'Settings', roles: ['owner'] },
    ],
  },
]

export default function Sidebar() {
  const { sidebarOpen, closeSidebar } = useUIStore()
  const { user, restaurantName, clearAuth, enabledModules } = useAuthStore()
  const navigate = useNavigate()
  const role = user?.role || 'owner'

  const { data: alerts } = useQuery({
    queryKey: ['invAlerts'],
    queryFn: getAlerts,
    refetchInterval: 60000,
    staleTime: 30000,
  })
  const alertCount = (alerts?.low_stock_count || 0) + (alerts?.expiring_soon_count || 0) + (alerts?.expired_count || 0)

  const visibleGroups = NAV_CONFIG
    .map(group => ({
      ...group,
      items: group.items.filter(item =>
        item.roles.includes(role) &&
        (!item.module || (enabledModules ? enabledModules[item.module] !== false : true))
      ),
    }))
    .filter(group => group.items.length > 0)

  const logout = () => { clearAuth(); navigate('/login') }

  return (
    <>
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 lg:hidden" onClick={closeSidebar} />
      )}
      <aside className={clsx(
        'fixed lg:static inset-y-0 left-0 z-50 lg:z-auto',
        'w-56 bg-bg2 border-r border-border flex flex-col flex-shrink-0',
        'transition-transform duration-300 lg:translate-x-0',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        {/* Logo */}
        <div className="flex items-center gap-2 px-4 h-[60px] border-b border-border flex-shrink-0">
          <div className="font-display font-black text-xl text-text2 tracking-tight">
            Bill<span className="text-green">Byte</span>
          </div>
          <span className={clsx(
            'text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full flex-shrink-0',
            role === 'owner'   && 'bg-purple-dim text-purple',
            role === 'manager' && 'bg-amber-dim text-amber',
            role === 'cashier' && 'bg-blue-dim text-blue',
            role === 'waiter'  && 'bg-surface3 text-muted',
            role === 'kitchen' && 'bg-orange-dim text-orange',
          )}>
            {role}
          </span>
          <div className="ml-auto w-2 h-2 rounded-full bg-green animate-pulse" />
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2">
          {visibleGroups.map(group => (
            <div key={group.label} className="mb-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted px-2 mb-1.5">{group.label}</p>
              {group.items.map(item => {
                const badge = item.badge && alertCount > 0 ? alertCount : null
                return (
                  <NavLink key={item.to} to={item.to} end={item.to === '/'}
                    onClick={() => window.innerWidth < 1024 && closeSidebar()}
                    className={({ isActive }) => clsx(
                      'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 mb-0.5 relative',
                      isActive ? 'bg-green-dim text-green font-semibold' : 'text-text2 hover:bg-surface2 hover:text-text'
                    )}>
                    {({ isActive }) => (
                      <>
                        {isActive && <span className="absolute -left-2 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-green rounded-r" />}
                        <item.icon size={16} />
                        <span className="flex-1">{item.label}</span>
                        {badge && (
                          <span className="w-5 h-5 bg-orange text-white rounded-full text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                            {badge > 9 ? '9+' : badge}
                          </span>
                        )}
                      </>
                    )}
                  </NavLink>
                )
              })}
            </div>
          ))}

        </nav>

        {/* Support */}
        <div className="px-3 pb-2">
          <div className="rounded-lg bg-surface2 px-3 py-2.5 space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted flex items-center gap-1.5">
              <Headphones size={10} /> Support
            </p>
            <a href="mailto:rohail230@gmail.com" className="flex items-center gap-2 text-[11px] text-text2 hover:text-green transition-colors group">
              <Mail size={11} className="text-muted group-hover:text-green flex-shrink-0" />
              <span className="truncate">rohail230@gmail.com</span>
            </a>
            <a href="https://wa.me/917892718642" target="_blank" rel="noreferrer" className="flex items-center gap-2 text-[11px] text-text2 hover:text-green transition-colors group">
              <Phone size={11} className="text-muted group-hover:text-green flex-shrink-0" />
              <span>+91 78927 18642</span>
            </a>
            <a href="https://wa.me/919986180523" target="_blank" rel="noreferrer" className="flex items-center gap-2 text-[11px] text-text2 hover:text-green transition-colors group">
              <Phone size={11} className="text-muted group-hover:text-green flex-shrink-0" />
              <span>+91 99861 80523</span>
            </a>
          </div>
        </div>

        {/* User */}
        <div className="border-t border-border p-3">
          <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg">
            <div className="w-7 h-7 rounded-full bg-green text-white flex items-center justify-center text-[11px] font-bold flex-shrink-0">
              {(user?.name || 'R').slice(0, 1).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-text truncate">{user?.name || 'User'}</p>
              <p className="text-[10px] text-muted truncate">{restaurantName || 'My Restaurant'}</p>
            </div>
            <button onClick={logout} title="Logout" className="text-muted hover:text-red transition-colors p-1 rounded flex-shrink-0">
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
