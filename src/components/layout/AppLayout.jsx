import Sidebar from './Sidebar'
import Topbar from './Topbar'
import { Outlet } from 'react-router-dom'
import { Clock, Megaphone, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useAuthStore } from '../../store/auth'
import client from '../../api/client'
import { getAnnouncements } from '../../api/announcements'

function ExpiryBanner() {
  const { trialEndsAt, plan, user } = useAuthStore()
  if (user?.role !== 'owner' || !trialEndsAt) return null
  if (plan === 'custom') return null

  const expiry = new Date(trialEndsAt)
  const today  = new Date()
  const expiryUTC = Date.UTC(expiry.getUTCFullYear(), expiry.getUTCMonth(), expiry.getUTCDate())
  const todayUTC  = Date.UTC(today.getUTCFullYear(),  today.getUTCMonth(),  today.getUTCDate())
  const daysLeft  = Math.round((expiryUTC - todayUTC) / (1000 * 60 * 60 * 24))

  // Pro: only show when ≤10 days left. Trial: always show.
  if (plan === 'pro' && daysLeft > 10) return null

  const isCritical = daysLeft <= 0
  const isWarning  = daysLeft <= 7

  const style = isCritical
    ? 'bg-red-dim text-red border-red/20'
    : isWarning
    ? 'bg-amber-dim text-amber border-amber/20'
    : 'bg-blue-dim text-blue border-blue/20'

  const isTrial = !plan || plan === 'trial'
  const msg = daysLeft < 0
    ? (isTrial ? 'Your trial has expired.' : 'Your license has expired.')
    : daysLeft === 0
    ? (isTrial ? 'Your trial expires today!' : 'Your license expires today!')
    : isTrial
    ? `Your trial expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}.`
    : `Your license expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}.`

  return (
    <div className={`flex items-center gap-2 px-5 py-2 text-xs font-semibold border-b ${style}`}>
      <Clock size={13} />
      {msg}
      <span className="font-normal opacity-70 ml-0.5">Contact BillByte support to upgrade your plan.</span>
    </div>
  )
}

function AnnouncementsBanner() {
  const [announcements, setAnnouncements] = useState([])
  const [dismissed, setDismissed] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('dismissed_announcements') || '[]') } catch { return [] }
  })

  useEffect(() => {
    getAnnouncements().then(setAnnouncements).catch(() => {})
  }, [])

  const visible = announcements.filter(a => !dismissed.includes(a.id))
  if (!visible.length) return null

  function dismiss(id) {
    const next = [...dismissed, id]
    setDismissed(next)
    sessionStorage.setItem('dismissed_announcements', JSON.stringify(next))
  }

  return (
    <>
      {visible.map(a => (
        <div key={a.id} className="flex items-start gap-2.5 px-5 py-2.5 text-xs border-b bg-amber-dim text-amber border-amber/20">
          <Megaphone size={13} className="mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="font-semibold">{a.title}</span>
            {a.body && <span className="font-normal opacity-80 ml-1.5">{a.body}</span>}
          </div>
          <button onClick={() => dismiss(a.id)} className="shrink-0 opacity-50 hover:opacity-100 transition-opacity">
            <X size={13} />
          </button>
        </div>
      ))}
    </>
  )
}

export default function AppLayout() {
  const { enabledModules, setAuth, token, user, restaurantId, restaurantName, phone, trialEndsAt } = useAuthStore()

  // Forward auth token to Electron main process for KOT auto-print polling
  useEffect(() => {
    if (!window.electronAPI?.setAuthToken) return
    if (token) window.electronAPI.setAuthToken(token, restaurantName)
    else window.electronAPI.clearAuthToken()
  }, [token, restaurantName])

  // Refresh modules from the server on every mount so admin changes take effect immediately
  useEffect(() => {
    if (!token) return
    client.get('/auth/profile').then((profile) => {
      const update = {}
      if (profile?.enabled_modules) update.enabledModules = profile.enabled_modules
      if (profile?.plan)            update.plan = profile.plan
      if (profile?.trial_ends_at)   update.trialEndsAt = profile.trial_ends_at
      if (Object.keys(update).length) useAuthStore.setState(update)
    }).catch(() => {})
  }, [token])

  return (
    <div className="flex h-screen overflow-hidden bg-bg">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Topbar />
        <ExpiryBanner />
        <AnnouncementsBanner />
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 lg:p-5">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
