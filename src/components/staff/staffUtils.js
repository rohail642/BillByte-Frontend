// Shared constants and helpers for the Staff screens.

export const JOB_TITLES = ['Head Chef', 'Sous Chef', 'Chef', 'Kitchen', 'Waiter', 'Cashier', 'Manager',
  'Barista', 'Delivery', 'Cleaner', 'Helper', 'Other']

// Records saved before job titles existed used login roles.
const LEGACY = { owner: 'Owner', manager: 'Manager', cashier: 'Cashier', waiter: 'Waiter', kitchen: 'Kitchen' }
export const roleLabel = r => LEGACY[r] || r || ''

export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] // 0 = Mon (server)

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September',
  'October', 'November', 'December']

// Statuses a person can be marked with, in button order.
export const MARKABLE = ['present', 'half_day', 'leave', 'off']

export const STATUS = {
  present:    { label: 'Present',    short: 'P', badge: 'green',  cell: 'bg-green-dim text-green2 border-green/25',   btn: 'bg-green text-white border-green' },
  half_day:   { label: 'Half day',   short: '½', badge: 'amber',  cell: 'bg-amber-dim text-amber border-amber/30',    btn: 'bg-amber text-white border-amber' },
  leave:      { label: 'Leave',      short: 'L', badge: 'orange', cell: 'bg-orange-dim text-orange border-orange/25', btn: 'bg-orange text-white border-orange' },
  off:        { label: 'Off',        short: 'O', badge: 'gray',   cell: 'bg-surface3 text-text3 border-border2',      btn: 'bg-text3 text-white border-text3' },
  weekly_off: { label: 'Weekly off', short: 'W', badge: 'blue',   cell: 'bg-blue-dim text-blue border-blue/20',       btn: '' },
  unmarked:   { label: 'Not marked', short: '',  badge: 'gray',   cell: 'bg-surface2 text-muted border-dashed border-border2', btn: '' },
}

// 'YYYY-MM-DD' for a Date, in the device's local time (India for our users) — never toISOString(), which is UTC.
export function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
// A server timestamp (e.g. joining date) as a local 'YYYY-MM-DD'.
export const localDay = ts => (ts ? ymd(new Date(ts)) : '')

export function parseYmd(s) {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}
export function addDays(s, n) {
  const d = parseYmd(s); d.setDate(d.getDate() + n); return ymd(d)
}
export function prettyDate(s, opts = { weekday: 'short', day: 'numeric', month: 'short' }) {
  return parseYmd(s).toLocaleDateString('en-IN', opts)
}

export const fmtDays = n => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, ''))

// Excel-friendly CSV download (UTF-8 BOM so ₹ and names display correctly).
export function downloadCsv(filename, rows) {
  const esc = v => {
    const s = v == null ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const csv = '﻿' + rows.map(r => r.map(esc).join(',')).join('\r\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
