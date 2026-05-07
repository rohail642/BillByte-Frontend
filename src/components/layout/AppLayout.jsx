import Sidebar from './Sidebar'
import Topbar from './Topbar'
import { Outlet } from 'react-router-dom'
import { Clock } from 'lucide-react'
import { useEffect } from 'react'
import { useAuthStore } from '../../store/auth'
import client from '../../api/client'

function ExpiryBanner() {
  const { trialEndsAt, user } = useAuthStore()
  if (user?.role !== 'owner' || !trialEndsAt) return null

  const expiry = new Date(trialEndsAt)
  const today  = new Date()
  // Compare calendar dates in UTC to avoid timezone shifting
  const expiryUTC = Date.UTC(expiry.getUTCFullYear(), expiry.getUTCMonth(), expiry.getUTCDate())
  const todayUTC  = Date.UTC(today.getUTCFullYear(),  today.getUTCMonth(),  today.getUTCDate())
  const daysLeft  = Math.round((expiryUTC - todayUTC) / (1000 * 60 * 60 * 24))
  if (daysLeft > 30) return null

  const isCritical = daysLeft <= 1
  const isWarning  = daysLeft <= 7

  const style = isCritical
    ? 'bg-red-dim text-red border-red/20'
    : isWarning
    ? 'bg-amber-dim text-amber border-amber/20'
    : 'bg-blue-dim text-blue border-blue/20'

  const msg = isCritical
    ? (daysLeft < 0 ? 'Your trial has expired.' : 'Your trial expires today!')
    : `Your trial expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}.`

  return (
    <div className={`flex items-center gap-2 px-5 py-2 text-xs font-semibold border-b ${style}`}>
      <Clock size={13} />
      {msg}
      <span className="font-normal opacity-70 ml-0.5">Contact BillBite support to upgrade your plan.</span>
    </div>
  )
}

export default function AppLayout() {
  const { enabledModules, setAuth, token, user, restaurantId, restaurantName, phone, trialEndsAt } = useAuthStore()

  // Refresh modules from the server on every mount so admin changes take effect immediately
  useEffect(() => {
    if (!token) return
    client.get('/auth/profile').then((profile) => {
      if (profile?.enabled_modules) {
        useAuthStore.setState({ enabledModules: profile.enabled_modules })
      }
    }).catch(() => {})
  }, [token])

  return (
    <div className="flex h-screen overflow-hidden bg-bg">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Topbar />
        <ExpiryBanner />
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 lg:p-5">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
