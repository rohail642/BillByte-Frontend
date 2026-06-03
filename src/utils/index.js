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

// Build a wa.me URL with the bill pre-filled as a WhatsApp message.
// Returns null if no valid phone number is available.
export function buildWhatsAppBillUrl(order, restaurantName, phone) {
  const raw = phone || order?.customer_phone
  if (!raw) return null
  const digits = String(raw).replace(/\D/g, '')
  const normalized = digits.length === 10 ? `91${digits}` : digits
  if (normalized.length < 10) return null

  const items = (order.items || []).filter(i => !i.cancelled_at)
  const lines = [
    `🧾 *Bill — ${restaurantName || 'Restaurant'}*`,
    `Order #${order.order_number}`,
    ``,
    ...items.map(i => `${i.name} ×${i.quantity}  ₹${i.total}`),
    ``,
    `Subtotal:  ₹${order.subtotal}`,
  ]
  if ((order.discount_amount || 0) > 0) lines.push(`Discount:  -₹${order.discount_amount}`)
  lines.push(`GST:       ₹${order.gst_amount}`)
  lines.push(`*Total:    ₹${order.total_amount}*`)
  lines.push(`Payment:   ${(order.payment_method || '').toUpperCase()}`)
  lines.push(``)
  lines.push(`Thank you! 🙏`)

  return `https://wa.me/${normalized}?text=${encodeURIComponent(lines.join('\n'))}`
}

// Electron-only: silent TCP print to configured thermal printers
export function printKOTElectron(kotData) {
  if (window.electronAPI?.printKOT) {
    window.electronAPI.printKOT(kotData)
    return true
  }
  return false
}
