import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
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

function useRole() {
  return useAuthStore(s => s.user?.role) || 'owner'
}

function homeFor(role) {
  if (role === 'waiter')  return '/waiter'
  if (role === 'cashier') return '/pos'
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
  if (role === 'cashier') return <Navigate to="/pos"    replace />
  if (role === 'waiter')  return <Navigate to="/waiter" replace />
  return <Dashboard />
}

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />

        {/* Waiter — full-screen, no sidebar */}
        <Route path="/waiter" element={
          <ProtectedRoute>
            <RoleRoute allowed={['waiter']}>
              <WaiterView />
            </RoleRoute>
          </ProtectedRoute>
        } />

        {/* Owner + Cashier — standard layout with sidebar */}
        <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
          <Route index element={<HomeRedirect />} />

          <Route path="pos" element={
            <RoleRoute allowed={['cashier', 'owner']}><POSTerminal /></RoleRoute>
          } />
          <Route path="billing" element={
            <RoleRoute allowed={['cashier']}><Billing /></RoleRoute>
          } />
          <Route path="tables" element={
            <RoleRoute allowed={['cashier']}><CashierTables /></RoleRoute>
          } />
          <Route path="orders" element={
            <RoleRoute allowed={['owner', 'cashier']}><Orders /></RoleRoute>
          } />
          <Route path="online-orders" element={
            <RoleRoute allowed={['owner', 'cashier']}><OnlineOrders /></RoleRoute>
          } />
          <Route path="menu" element={
            <RoleRoute allowed={['owner']}><Menu /></RoleRoute>
          } />
          <Route path="inventory" element={
            <RoleRoute allowed={['owner', 'cashier']}><Inventory /></RoleRoute>
          } />
          <Route path="crm" element={
            <RoleRoute allowed={['owner', 'cashier']}><CRM /></RoleRoute>
          } />
          <Route path="staff" element={
            <RoleRoute allowed={['owner']}><Staff /></RoleRoute>
          } />
          <Route path="reports" element={
            <RoleRoute allowed={['owner']}><Reports /></RoleRoute>
          } />
          <Route path="settings" element={
            <RoleRoute allowed={['owner']}><Settings /></RoleRoute>
          } />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  )
}
