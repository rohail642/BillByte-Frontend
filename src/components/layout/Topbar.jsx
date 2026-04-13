import { useAuthStore } from '../../store/auth'
import { useLocation } from 'react-router-dom'
import { Menu, Bell, Plus } from 'lucide-react'
import { useUIStore } from '../../store/ui'
import { useNavigate } from 'react-router-dom'
import Button from '../ui/Button'

const titles = {
  '/':              'Dashboard',
  '/billing':       'Billing / POS',
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
  const restaurantName = useAuthStore(s => s.restaurantName)
  const location = useLocation()
  const navigate = useNavigate()
  const title = titles[location.pathname] || 'BillByte'

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
           {restaurantName || 'My Restaurant'} · {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' })}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="hidden sm:flex items-center gap-1.5 bg-green-dim border border-green/25 text-green rounded-full px-3 py-1 text-[11px] font-bold">
          <span className="w-1.5 h-1.5 rounded-full bg-green animate-pulse" />
          Live
        </div>
        <button className="relative p-2 rounded-lg text-text3 hover:text-text hover:bg-surface2 transition-colors">
          <Bell size={17} />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-orange" />
        </button>
        <Button variant="primary" size="sm" icon={<Plus size={14} />}
          onClick={() => navigate('/billing')}>
          New Bill
        </Button>
      </div>
    </header>
  )
}
