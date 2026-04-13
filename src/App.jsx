import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/auth'
import { useEffect, useState } from 'react'
import AppLayout from './components/layout/AppLayout'
import AIAssistant from './components/layout/AIAssistant'
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

function ProtectedRoute({ children }) {
  const token = useAuthStore(s => s.token)
  const [ready, setReady] = useState(false)

  useEffect(() => { setReady(true) }, [])

  if (!ready) return (
    <div style={{ height:'100vh', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontFamily:'Outfit', fontWeight:900, fontSize:'2rem', color:'#16a34a' }}>
          Bill<span style={{ color:'#ea580c' }}>Byte</span>
        </div>
      </div>
    </div>
  )

  if (!token) return <Navigate to="/login" replace />
  return children
}

function PublicRoute({ children }) {
  const token = useAuthStore(s => s.token)
  return !token ? children : <Navigate to="/" replace />
}

export default function App() {
  const token = useAuthStore(s => s.token)

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
        <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
          <Route index                element={<Dashboard />} />
          <Route path="billing"       element={<Billing />} />
          <Route path="orders"        element={<Orders />} />
          <Route path="online-orders" element={<OnlineOrders />} />
          <Route path="menu"          element={<Menu />} />
          <Route path="inventory"     element={<Inventory />} />
          <Route path="crm"           element={<CRM />} />
          <Route path="staff"         element={<Staff />} />
          <Route path="reports"       element={<Reports />} />
          <Route path="settings"      element={<Settings />} />
          <Route path="*"             element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
      {token && <AIAssistant />}
    </BrowserRouter>
  )
}