import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuthStore } from './store/auth'
import AppLayout from './components/layout/AppLayout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Billing from './pages/Billing'
import Orders from './pages/Orders'
import OnlineOrders from './pages/OnlineOrders'
import Menu from './pages/Menu'
import Inventory from './pages/Inventory'
import CRM from './pages/CRM'
import Staff from './pages/Staff'
import Reports from './pages/Reports'
import Settings from './pages/Settings'
import WaiterView from './pages/WaiterView'
import CashierTables from './pages/CashierTables'
import POSTerminal from './pages/POSTerminal'
import KitchenDisplay from './pages/KitchenDisplay'
import Terms from './pages/Terms'
import Privacy from './pages/Privacy'

function HydrationGate({ children }) {
  const [hydrated, setHydrated] = useState(useAuthStore.persist.hasHydrated())
  useEffect(() => {
    const unsub = useAuthStore.persist.onFinishHydration(() => setHydrated(true))
    return unsub
  }, [])

  // Impersonate: admin passes ?impersonate=TOKEN in the URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token = params.get('impersonate')
    const restaurantId = params.get('restaurant_id')
    const restaurantName = params.get('restaurant_name')
    if (token) {
      useAuthStore.setState({
        token,
        user: { id: 0, name: 'Admin (impersonating)', role: 'owner' },
        restaurantId: restaurantId ? Number(restaurantId) : null,
        restaurantName: restaurantName ? decodeURIComponent(restaurantName) : null,
      })
      // Clean URL without triggering a reload
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  if (!hydrated) return <div className="min-h-screen bg-bg" />
  return children
}

function OfflineBanner() {
  const [offline, setOffline] = useState(!navigator.onLine)
  useEffect(() => {
    const on  = () => setOffline(false)
    const off = () => setOffline(true)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])
  if (!offline) return null
  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] bg-red text-white text-xs font-semibold text-center py-2 px-4">
      No internet connection — changes will not be saved until you reconnect
    </div>
  )
}

function useRole() {
  return useAuthStore(s => s.user?.role) || 'owner'
}

// Handles ?impersonate=<token> URL param set by admin panel
function ImpersonateHandler() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token = params.get('impersonate')
    if (!token) return
    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      useAuthStore.setState({
        token,
        user: { id: parseInt(payload.sub), role: 'owner', name: 'Owner' },
        restaurantId: payload.restaurant_id,
        restaurantName: null,
      })
      window.history.replaceState({}, '', window.location.pathname + window.location.hash)
    } catch (e) {
      console.error('Impersonate failed', e)
    }
  }, [])
  return null
}

function homeFor(role) {
  if (role === 'waiter')  return '/waiter'
  if (role === 'cashier') return '/pos'
  if (role === 'kitchen') return '/kitchen'
  return '/'
}

function ProtectedRoute({ children }) {
  const token = useAuthStore(s => s.token)
  if (!token) return <Navigate to="/login" replace />
  return children
}

function PublicRoute({ children }) {
  const token = useAuthStore(s => s.token)
  const role  = useRole()
  return !token ? children : <Navigate to={homeFor(role)} replace />
}

// Redirects to role home if current role not in allowed list
function RoleRoute({ allowed, children }) {
  const role = useRole()
  if (!allowed.includes(role)) return <Navigate to={homeFor(role)} replace />
  return children
}

// Index route: sends each role to their proper home page
function HomeRedirect() {
  const role = useRole()
  if (role === 'cashier') return <Navigate to="/pos"     replace />
  if (role === 'waiter')  return <Navigate to="/waiter"  replace />
  if (role === 'kitchen') return <Navigate to="/kitchen" replace />
  return <Dashboard />
}

export default function App() {
  return (
    <HashRouter>
      <OfflineBanner />
      <HydrationGate>
      <ImpersonateHandler />
      <Routes>
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/privacy" element={<Privacy />} />

        {/* Waiter — full-screen, no sidebar */}
        <Route path="/waiter" element={
          <ProtectedRoute>
            <RoleRoute allowed={['waiter']}>
              <WaiterView />
            </RoleRoute>
          </ProtectedRoute>
        } />

        {/* Kitchen — full-screen, no sidebar */}
        <Route path="/kitchen" element={
          <ProtectedRoute>
            <RoleRoute allowed={['kitchen']}>
              <KitchenDisplay />
            </RoleRoute>
          </ProtectedRoute>
        } />

        {/* Owner + Cashier — standard layout with sidebar */}
        <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
          <Route index element={<HomeRedirect />} />

          <Route path="pos" element={
            <RoleRoute allowed={['cashier', 'owner', 'manager']}><POSTerminal /></RoleRoute>
          } />
          <Route path="billing" element={
            <RoleRoute allowed={['cashier', 'manager']}><Billing /></RoleRoute>
          } />
          <Route path="tables" element={
            <RoleRoute allowed={['cashier', 'manager']}><CashierTables /></RoleRoute>
          } />
          <Route path="orders" element={
            <RoleRoute allowed={['owner', 'cashier', 'manager']}><Orders /></RoleRoute>
          } />
          <Route path="online-orders" element={
            <RoleRoute allowed={['owner', 'cashier', 'manager']}><OnlineOrders /></RoleRoute>
          } />
          <Route path="menu" element={
            <RoleRoute allowed={['owner', 'manager']}><Menu /></RoleRoute>
          } />
          <Route path="inventory" element={
            <RoleRoute allowed={['owner', 'cashier', 'manager']}><Inventory /></RoleRoute>
          } />
          <Route path="crm" element={
            <RoleRoute allowed={['owner', 'cashier', 'manager']}><CRM /></RoleRoute>
          } />
          <Route path="staff" element={
            <RoleRoute allowed={['owner', 'manager']}><Staff /></RoleRoute>
          } />
          <Route path="reports" element={
            <RoleRoute allowed={['owner', 'manager']}><Reports /></RoleRoute>
          } />
          <Route path="settings" element={
            <RoleRoute allowed={['owner']}><Settings /></RoleRoute>
          } />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </HydrationGate>
    </HashRouter>
  )
}
