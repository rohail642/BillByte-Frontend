export const formatINR = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0)

export const timeAgo = (dateStr) => {
  const secs = Math.floor((Date.now() - new Date(dateStr)) / 1000)
  if (secs < 60)   return `${secs}s ago`
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
  return `${Math.floor(secs / 3600)}h ago`
}

export const initials = (name = '') =>
  name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)

export const statusColor = (status) => ({
  pending:    'orange',
  kot_sent:   'blue',
  preparing:  'amber',
  ready:      'purple',
  served:     'green',
  paid:       'green',
  cancelled:  'red',
  present:    'green',
  leave:      'orange',
  off:        'red',
  ordered:    'blue',
  delivered:  'green',
}[status] || 'gray')

export const AVATAR_COLORS = [
  '#16a34a','#2563eb','#7c3aed','#ea580c','#d97706','#db2777','#0891b2'
]
export const avatarColor = (i) => AVATAR_COLORS[i % AVATAR_COLORS.length]

// True inside the Capacitor Android app — phones are order terminals,
// the PC gateway prints, so KOT preview modals are skipped on native.
export const isNativeApp = () =>
  typeof window !== 'undefined' && !!window.Capacitor?.isNativePlatform?.()

// Electron-only: silent TCP print to configured thermal printers
export function printKOTElectron(kotData) {
  if (window.electronAPI?.printKOT) {
    window.electronAPI.printKOT(kotData)
    return true
  }
  return false
}
