// ESC/POS receipt builders for the Android (Capacitor) app.
// Ported 1:1 from electron/main.cjs so KOTs and bills print identically on
// desktop and mobile. Produces raw bytes (Uint8Array) for a network thermal
// printer; the native EscPosPrinter plugin writes them to ip:9100.

const ESC = 0x1b
const GS = 0x1d

const enc = (str) => new TextEncoder().encode(String(str))

const INIT = Uint8Array.from([ESC, 0x40])
const BOLD_ON = Uint8Array.from([ESC, 0x45, 0x01])
const BOLD_OFF = Uint8Array.from([ESC, 0x45, 0x00])
const CENTER = Uint8Array.from([ESC, 0x61, 0x01])
const LEFT = Uint8Array.from([ESC, 0x61, 0x00])
const DBL_SIZE = Uint8Array.from([ESC, 0x21, 0x30])
const DBL_HEIGHT = Uint8Array.from([ESC, 0x21, 0x10])
const NORMAL_SIZE = Uint8Array.from([ESC, 0x21, 0x00])
const CUT = Uint8Array.from([GS, 0x56, 0x00])

function concatBytes(parts) {
  let len = 0
  for (const p of parts) len += p.length
  const out = new Uint8Array(len)
  let off = 0
  for (const p of parts) { out.set(p, off); off += p.length }
  return out
}

// Uint8Array -> base64 (chunked to avoid call-stack limits on large buffers)
export function bytesToBase64(bytes) {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

// ── KOT ────────────────────────────────────────────────────────────────────
export function buildKOTBuffer(kotData) {
  const { restaurantName, orderNumber, tableNumber, customerName, items, notes } = kotData

  const LINE = enc('--------------------------------\n')
  const now = new Date()
  const dateStr = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })

  const tableLabel = tableNumber ? `Table: ${tableNumber}` : 'Takeaway / Delivery'
  const orderLabel = orderNumber ? `  #${orderNumber}` : ''

  const parts = [
    INIT,
    CENTER,
    BOLD_ON, DBL_SIZE,
    enc('KOT\n'),
    NORMAL_SIZE,
    enc(`${restaurantName || 'Restaurant'}\n`),
    BOLD_OFF,
    LINE,
    enc(`${tableLabel}${orderLabel}\n`),
    ...(customerName && customerName.trim()
      ? [BOLD_ON, enc(`Name: ${customerName.trim()}\n`), BOLD_OFF]
      : []),
    enc(`${dateStr}   ${timeStr}\n`),
    LINE,
    LEFT,
    BOLD_ON,
    enc(' QTY   ITEM\n'),
    BOLD_OFF,
    LINE,
  ]

  // 80mm thermal = 48 chars/line. Prefix ` QTY   ` is 7 chars, so names get 41.
  const NAME_W = 41
  const wrapName = (str) => {
    const words = String(str).split(/\s+/).filter(Boolean)
    const lines = []
    let cur = ''
    for (const w of words) {
      if (w.length > NAME_W) {
        if (cur) { lines.push(cur); cur = '' }
        let rest = w
        while (rest.length > NAME_W) { lines.push(rest.slice(0, NAME_W)); rest = rest.slice(NAME_W) }
        cur = rest
        continue
      }
      if (!cur) cur = w
      else if (cur.length + 1 + w.length <= NAME_W) cur += ' ' + w
      else { lines.push(cur); cur = w }
    }
    if (cur) lines.push(cur)
    return lines.length ? lines : ['']
  }

  for (const item of (items || [])) {
    const qty = String(item.quantity || 1).padStart(3)
    const lines = wrapName(item.name || '')
    parts.push(enc(` ${qty}   ${lines[0]}\n`))
    for (let i = 1; i < lines.length; i++) parts.push(enc(`       ${lines[i]}\n`))
  }

  parts.push(LINE)

  if (notes && notes.trim()) {
    parts.push(BOLD_ON)
    parts.push(enc('Notes:\n'))
    parts.push(BOLD_OFF)
    parts.push(enc(`${notes.trim()}\n`))
    parts.push(LINE)
  }

  parts.push(enc('\n\n\n\n\n\n'))
  parts.push(CUT)

  return concatBytes(parts)
}

// ── Bill ───────────────────────────────────────────────────────────────────
export function buildBillBuffer(billData) {
  const { restaurant: r = {}, order: o = {} } = billData

  const W = 42
  const LINE = enc('-'.repeat(W) + '\n')
  const lpad = (s, n) => String(s).substring(0, n).padEnd(n)
  const rpad = (s, n) => String(s).substring(0, n).padStart(n)

  const orderTypeLabel = { dine_in: 'Dine-In', takeaway: 'Takeaway', delivery: 'Delivery', zomato: 'Zomato', swiggy: 'Swiggy' }[o.order_type] || ''
  const payLabel = { cash: 'Cash', upi: 'UPI', card: 'Card' }[o.payment_method] || o.payment_method || ''
  const gstRate = r.gst_rate ?? 5
  const halfRate = (gstRate / 2).toFixed(1)
  const halfAmt = ((o.gst_amount || 0) / 2).toFixed(2)

  const dt = o.created_at ? new Date(o.created_at) : new Date()
  const dateStr = dt.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: '2-digit' })
  const timeStr = dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })

  const parts = [
    INIT,
    CENTER, BOLD_ON, DBL_HEIGHT,
    enc(`${r.name || 'Restaurant'}\n`),
    NORMAL_SIZE, BOLD_OFF,
  ]

  if (r.phone) parts.push(enc(`PH: ${r.phone}\n`))
  if (r.address) parts.push(enc(`${r.address}\n`))
  if (r.city) parts.push(enc(`${r.city}\n`))
  if (r.fssai) parts.push(enc(`FSSAI: ${r.fssai}\n`))
  if (r.gstin) parts.push(enc(`GSTIN: ${r.gstin}\n`))

  parts.push(LINE, LEFT)
  parts.push(enc(`Date: ${dateStr} ${timeStr}   ${orderTypeLabel}\n`))
  parts.push(enc(`Bill: #${o.order_number}${o.table_number ? `   Table: ${o.table_number}` : ''}\n`))
  if (payLabel) parts.push(enc(`Payment: ${payLabel}\n`))

  parts.push(LINE, BOLD_ON)
  parts.push(enc(`${lpad('#', 3)}${lpad('Item', 19)}${rpad('Qty', 4)}${rpad('Rate', 8)}${rpad('Amt', 8)}\n`))
  parts.push(BOLD_OFF, LINE)

  const items = (o.items || []).filter(i => !i.cancelled_at)
  items.forEach((item, idx) => {
    const amt = (item.total || item.price * item.quantity)
    parts.push(enc(
      `${lpad(idx + 1, 3)}${lpad(item.name, 19)}${rpad(item.quantity, 4)}${rpad(Number(item.price).toFixed(2), 8)}${rpad(Number(amt).toFixed(2), 8)}\n`
    ))
  })

  const totalQty = items.reduce((s, i) => s + i.quantity, 0)
  const fmtRow = (label, value) => enc(`${lpad(label, W - 10)}${rpad(value, 10)}\n`)

  parts.push(LINE)
  parts.push(fmtRow(`Total Qty: ${totalQty}`, `Sub: ${Number(o.subtotal || 0).toFixed(2)}`))
  if (r.show_gst_breakup !== false) {
    parts.push(fmtRow(`CGST (${halfRate}%)`, halfAmt))
    parts.push(fmtRow(`SGST (${halfRate}%)`, halfAmt))
  }
  if (o.discount_amount > 0) parts.push(fmtRow('Discount', `-${Number(o.discount_amount).toFixed(2)}`))

  parts.push(LINE, BOLD_ON)
  parts.push(fmtRow('Grand Total', `Rs.${Number(o.total_amount || 0).toFixed(2)}`))
  parts.push(BOLD_OFF, LINE, CENTER)
  parts.push(enc('Prices are inclusive of GST\n'))
  parts.push(enc('Thank You, Visit Again!\n'))
  parts.push(enc('Powered by BillByte\n'))
  parts.push(enc('\n\n\n\n\n\n'))
  parts.push(CUT)

  return concatBytes(parts)
}
