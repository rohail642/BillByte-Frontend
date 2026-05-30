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

export function printKOT({ restaurantName, orderNumber, tableNumber, items = [], notes = '' }) {
  // Electron: silent TCP print to all configured thermal printers
  if (window.electronAPI?.printKOT) {
    window.electronAPI.printKOT({ restaurantName, orderNumber, tableNumber, items, notes })
    return
  }

  // Web fallback: styled print window
  const now = new Date()
  const dateStr = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
  const tableLabel = tableNumber ? `Table: ${tableNumber}` : 'Takeaway / Delivery'
  const orderLabel = orderNumber ? `  #${orderNumber}` : ''

  const rows = items.map(i =>
    `<tr><td style="padding:3px 8px 3px 0;width:36px;font-weight:700;">${i.quantity}x</td><td style="padding:3px 0">${i.name}</td></tr>`
  ).join('')

  const notesHtml = notes?.trim()
    ? `<div style="margin-top:8px;padding-top:8px;border-top:1px dashed #000"><b>Notes:</b> ${notes.trim()}</div>`
    : ''

  const html = `
    <html><head><title>KOT</title>
    <style>
      * { box-sizing: border-box; }
      body { margin: 0; padding: 12px; font-family: 'Courier New', Courier, monospace; font-size: 13px; width: 280px; }
      @media print { body { margin: 0; } }
      h1 { font-size: 22px; text-align: center; margin: 0 0 2px; letter-spacing: 2px; }
      .rname { text-align: center; font-size: 12px; margin-bottom: 6px; }
      .divider { border: none; border-top: 1px dashed #000; margin: 6px 0; }
      .meta { font-size: 12px; margin-bottom: 2px; }
      table { width: 100%; border-collapse: collapse; margin: 4px 0; }
      th { text-align: left; font-size: 11px; border-bottom: 1px dashed #000; padding-bottom: 3px; }
    </style>
    </head><body>
      <h1>KOT</h1>
      <div class="rname">${restaurantName || ''}</div>
      <hr class="divider"/>
      <div class="meta"><b>${tableLabel}${orderLabel}</b></div>
      <div class="meta">${dateStr} &nbsp; ${timeStr}</div>
      <hr class="divider"/>
      <table><thead><tr><th>QTY</th><th>ITEM</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <hr class="divider"/>
      ${notesHtml}
    </body></html>`

  const win = window.open('', '_blank', 'width=320,height=500')
  win.document.write(html)
  win.document.close()
  win.focus()
  setTimeout(() => { win.print(); win.close() }, 300)
}
