const { app, BrowserWindow, shell, session, dialog, ipcMain } = require('electron')
const path = require('path')
const fs   = require('fs')
const net  = require('net')
const os   = require('os')
const { autoUpdater } = require('electron-updater')

const isDev = !app.isPackaged

// ── Printer config helpers ────────────────────────────────────────────────────

function printerConfigPath() {
  return path.join(app.getPath('userData'), 'printer-config.json')
}

function readPrinterConfig() {
  try {
    return JSON.parse(fs.readFileSync(printerConfigPath(), 'utf8'))
  } catch {
    return { printers: [] }
  }
}

function writePrinterConfig(config) {
  fs.writeFileSync(printerConfigPath(), JSON.stringify(config, null, 2), 'utf8')
}

// ── ESC/POS builder ──────────────────────────────────────────────────────────

function buildKOTBuffer(kotData) {
  const { restaurantName, orderNumber, tableNumber, customerName, items, notes } = kotData
  const ESC = 0x1b, GS = 0x1d

  const init      = Buffer.from([ESC, 0x40])
  const boldOn    = Buffer.from([ESC, 0x45, 0x01])
  const boldOff   = Buffer.from([ESC, 0x45, 0x00])
  const center    = Buffer.from([ESC, 0x61, 0x01])
  const left      = Buffer.from([ESC, 0x61, 0x00])
  const dblSize   = Buffer.from([ESC, 0x21, 0x30])
  const normalSize= Buffer.from([ESC, 0x21, 0x00])
  const cut       = Buffer.from([GS,  0x56, 0x00])

  const LINE = Buffer.from('--------------------------------\n')

  const now     = new Date()
  const dateStr = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })

  const tableLabel = tableNumber ? `Table: ${tableNumber}` : 'Takeaway / Delivery'
  const orderLabel = orderNumber ? `  #${orderNumber}` : ''

  const parts = [
    init,
    center,
    boldOn, dblSize,
    Buffer.from('KOT\n'),
    normalSize,
    Buffer.from(`${restaurantName || 'Restaurant'}\n`),
    boldOff,
    LINE,
    Buffer.from(`${tableLabel}${orderLabel}\n`),
    ...(customerName && customerName.trim()
      ? [boldOn, Buffer.from(`Name: ${customerName.trim()}\n`), boldOff]
      : []),
    Buffer.from(`${dateStr}   ${timeStr}\n`),
    LINE,
    left,
    boldOn,
    Buffer.from(' QTY   ITEM\n'),
    boldOff,
    LINE,
  ]

  // 80mm thermal = 48 chars/line. Prefix ` QTY   ` is 7 chars, so names get 41.
  const NAME_W = 41
  const wrapName = (str) => {
    const words = String(str).split(/\s+/).filter(Boolean)
    const lines = []
    let cur = ''
    for (const w of words) {
      // a single word longer than the line: hard-split it
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
    const qty   = String(item.quantity || 1).padStart(3)
    const lines = wrapName(item.name || '')
    parts.push(Buffer.from(` ${qty}   ${lines[0]}\n`))
    for (let i = 1; i < lines.length; i++) parts.push(Buffer.from(`       ${lines[i]}\n`))
  }

  parts.push(LINE)

  if (notes && notes.trim()) {
    parts.push(boldOn)
    parts.push(Buffer.from('Notes:\n'))
    parts.push(boldOff)
    parts.push(Buffer.from(`${notes.trim()}\n`))
    parts.push(LINE)
  }

  parts.push(Buffer.from('\n\n\n\n\n\n'))
  parts.push(cut)

  return Buffer.concat(parts)
}

// ── ESC/POS bill builder ──────────────────────────────────────────────────────

function buildBillBuffer(billData) {
  const { restaurant: r = {}, order: o = {} } = billData
  const ESC = 0x1b, GS = 0x1d

  const init       = Buffer.from([ESC, 0x40])
  const boldOn     = Buffer.from([ESC, 0x45, 0x01])
  const boldOff    = Buffer.from([ESC, 0x45, 0x00])
  const center     = Buffer.from([ESC, 0x61, 0x01])
  const left       = Buffer.from([ESC, 0x61, 0x00])
  const dblHeight  = Buffer.from([ESC, 0x21, 0x10])
  const normalSize = Buffer.from([ESC, 0x21, 0x00])
  const cut        = Buffer.from([GS,  0x56, 0x00])

  const W    = 42
  const LINE = Buffer.from('-'.repeat(W) + '\n')
  const lpad = (s, n) => String(s).substring(0, n).padEnd(n)
  const rpad = (s, n) => String(s).substring(0, n).padStart(n)

  const orderTypeLabel = { dine_in: 'Dine-In', takeaway: 'Takeaway', delivery: 'Delivery', zomato: 'Zomato', swiggy: 'Swiggy' }[o.order_type] || ''
  const payLabel       = { cash: 'Cash', upi: 'UPI', card: 'Card' }[o.payment_method] || o.payment_method || ''
  const gstRate        = r.gst_rate ?? 5
  const halfRate       = (gstRate / 2).toFixed(1)
  const halfAmt        = ((o.gst_amount || 0) / 2).toFixed(2)

  const dt      = o.created_at ? new Date(o.created_at) : new Date()
  const dateStr = dt.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: '2-digit' })
  const timeStr = dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })

  const parts = [
    init,
    center, boldOn, dblHeight,
    Buffer.from(`${r.name || 'Restaurant'}\n`),
    normalSize, boldOff,
  ]

  if (r.phone)   parts.push(Buffer.from(`PH: ${r.phone}\n`))
  if (r.address) parts.push(Buffer.from(`${r.address}\n`))
  if (r.city)    parts.push(Buffer.from(`${r.city}\n`))
  if (r.fssai)   parts.push(Buffer.from(`FSSAI: ${r.fssai}\n`))
  if (r.gstin)   parts.push(Buffer.from(`GSTIN: ${r.gstin}\n`))

  parts.push(LINE, left)
  parts.push(Buffer.from(`Date: ${dateStr} ${timeStr}   ${orderTypeLabel}\n`))
  parts.push(Buffer.from(`Bill: #${o.order_number}${o.table_number ? `   Table: ${o.table_number}` : ''}\n`))
  if (payLabel) parts.push(Buffer.from(`Payment: ${payLabel}\n`))

  parts.push(LINE, boldOn)
  parts.push(Buffer.from(`${lpad('#', 3)}${lpad('Item', 19)}${rpad('Qty', 4)}${rpad('Rate', 8)}${rpad('Amt', 8)}\n`))
  parts.push(boldOff, LINE)

  const items = (o.items || []).filter(i => !i.cancelled_at)
  items.forEach((item, idx) => {
    const amt = (item.total || item.price * item.quantity)
    parts.push(Buffer.from(
      `${lpad(idx + 1, 3)}${lpad(item.name, 19)}${rpad(item.quantity, 4)}${rpad(Number(item.price).toFixed(2), 8)}${rpad(Number(amt).toFixed(2), 8)}\n`
    ))
  })

  const totalQty = items.reduce((s, i) => s + i.quantity, 0)
  const fmtRow   = (label, value) => Buffer.from(`${lpad(label, W - 10)}${rpad(value, 10)}\n`)

  parts.push(LINE)
  parts.push(fmtRow(`Total Qty: ${totalQty}`, `Sub: ${Number(o.subtotal || 0).toFixed(2)}`))
  if (r.show_gst_breakup !== false) {
    parts.push(fmtRow(`CGST (${halfRate}%)`, halfAmt))
    parts.push(fmtRow(`SGST (${halfRate}%)`, halfAmt))
  }
  if (o.discount_amount > 0) parts.push(fmtRow('Discount', `-${Number(o.discount_amount).toFixed(2)}`))

  parts.push(LINE, boldOn)
  parts.push(fmtRow('Grand Total', `Rs.${Number(o.total_amount || 0).toFixed(2)}`))
  parts.push(boldOff, LINE, center)
  parts.push(Buffer.from('Prices are inclusive of GST\n'))
  parts.push(Buffer.from('Thank You, Visit Again!\n'))
  parts.push(Buffer.from('Powered by BillByte\n'))
  parts.push(Buffer.from('\n\n\n\n\n\n'))
  parts.push(cut)

  return Buffer.concat(parts)
}

// ── TCP thermal print ─────────────────────────────────────────────────────────

function printToThermal(ip, buffer) {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket()
    socket.setTimeout(5000)

    socket.connect(9100, ip, () => {
      socket.write(buffer, () => {
        socket.destroy()
        resolve()
      })
    })

    socket.on('timeout', () => {
      socket.destroy()
      reject(new Error(`Timeout connecting to printer at ${ip}`))
    })

    socket.on('error', err => {
      socket.destroy()
      reject(err)
    })
  })
}

// ── USB printing via Windows driver (HTML → webContents.print) ───────────────

function printHtmlToUSB(printerName, htmlContent) {
  return new Promise((resolve, reject) => {
    const tmpFile = path.join(os.tmpdir(), `bb_receipt_${Date.now()}.html`)
    fs.writeFileSync(tmpFile, htmlContent, 'utf8')

    const win = new BrowserWindow({
      show: false,
      width: 800,
      height: 1000,
      webPreferences: { nodeIntegration: false, contextIsolation: true },
    })

    win.loadFile(tmpFile)
    win.webContents.once('did-finish-load', () => {
      win.webContents.print(
        { silent: true, deviceName: printerName, printBackground: false, margins: { marginType: 'none' }, pageSize: { width: 80000, height: 297000 } },
        (success, errorType) => {
          win.destroy()
          try { fs.unlinkSync(tmpFile) } catch {}
          success ? resolve() : reject(new Error(errorType || 'Print failed'))
        }
      )
    })
  })
}

// ── HTML receipt builders (for USB/inkjet printers) ───────────────────────────

const RECEIPT_CSS = `
  * { margin:0; padding:0; box-sizing:border-box; }
  @page { size: 80mm auto; margin: 0; }
  /* Content is inset via padding (not page margins) and kept well within an
     80mm printer's ~72mm printable area: text spans ~4mm to ~66mm, leaving a
     6mm safety zone on the right so nothing clips. */
  body { font-family: 'Courier New', monospace; font-size: 10pt; width: 72mm; margin: 0; padding: 3mm 6mm 14mm 4mm; }
  h1 { font-size: 14pt; text-align: center; font-weight: bold; margin-bottom: 3px; }
  .center { text-align: center; }
  .line { border-top: 1px dashed #000; margin: 4px 0; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  th { font-weight: bold; border-bottom: 1px solid #000; padding: 2px 0; text-align: left; }
  td { padding: 2px 0; vertical-align: top; word-break: break-word; overflow-wrap: anywhere; }
  .r { text-align: right; }
  .c { text-align: center; }
  .bold { font-weight: bold; }
`

function buildKOTHtml(kotData) {
  const { restaurantName, orderNumber, tableNumber, customerName, items, notes } = kotData
  const now      = new Date()
  const dateStr  = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  const timeStr  = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
  const tableLabel = tableNumber ? `Table: ${tableNumber}` : 'Takeaway / Delivery'
  const orderLabel = orderNumber ? `&nbsp;&nbsp;#${orderNumber}` : ''
  const nameRow = customerName?.trim() ? `<div class="bold">Name: ${customerName.trim()}</div>` : ''
  const rows = (items || []).map(i =>
    `<tr><td style="width:34px">${i.quantity || 1}</td><td>${i.name || ''}</td></tr>`
  ).join('')
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${RECEIPT_CSS}</style></head><body>
    <h1>KOT</h1>
    <div class="center">${restaurantName || 'Restaurant'}</div>
    <div class="line"></div>
    <div>${tableLabel}${orderLabel}</div>
    ${nameRow}
    <div>${dateStr} &nbsp; ${timeStr}</div>
    <div class="line"></div>
    <table><thead><tr><th>QTY</th><th>ITEM</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="line"></div>
    ${notes?.trim() ? `<div><strong>Notes:</strong> ${notes.trim()}</div><div class="line"></div>` : ''}
  </body></html>`
}

function buildBillHtml(billData) {
  const { restaurant: r = {}, order: o = {} } = billData
  const gstRate   = r.gst_rate ?? 5
  const halfRate  = (gstRate / 2).toFixed(1)
  const halfAmt   = ((o.gst_amount || 0) / 2).toFixed(2)
  const dt        = o.created_at ? new Date(o.created_at) : new Date()
  const dateStr   = dt.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: '2-digit' })
  const timeStr   = dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })
  const typeLabel = { dine_in: 'Dine-In', takeaway: 'Takeaway', delivery: 'Delivery', zomato: 'Zomato', swiggy: 'Swiggy' }[o.order_type] || ''
  const payLabel  = { cash: 'Cash', upi: 'UPI', card: 'Card' }[o.payment_method] || o.payment_method || ''
  const items     = (o.items || []).filter(i => !i.cancelled_at)
  const totalQty  = items.reduce((s, i) => s + i.quantity, 0)

  const rows = items.map((item, idx) => {
    const amt = item.total || item.price * item.quantity
    return `<tr>
      <td style="width:24px">${idx + 1}</td>
      <td>${item.name}</td>
      <td class="c" style="width:30px">${item.quantity}</td>
      <td class="r" style="width:60px">${Number(item.price).toFixed(2)}</td>
      <td class="r" style="width:60px">${Number(amt).toFixed(2)}</td>
    </tr>`
  }).join('')

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${RECEIPT_CSS}</style></head><body>
    <h1>${r.name || 'Restaurant'}</h1>
    ${r.phone   ? `<div class="center">PH: ${r.phone}</div>` : ''}
    ${r.address ? `<div class="center">${r.address}</div>` : ''}
    ${r.city    ? `<div class="center">${r.city}</div>` : ''}
    ${r.fssai   ? `<div class="center">FSSAI: ${r.fssai}</div>` : ''}
    ${r.gstin   ? `<div class="center">GSTIN: ${r.gstin}</div>` : ''}
    <div class="line"></div>
    <div>Date: ${dateStr} ${timeStr} &nbsp; ${typeLabel}</div>
    <div>Bill: #${o.order_number}${o.table_number ? ` &nbsp; Table: ${o.table_number}` : ''}</div>
    ${payLabel ? `<div>Payment: ${payLabel}</div>` : ''}
    <div class="line"></div>
    <table>
      <thead><tr><th>#</th><th>Item</th><th class="c">Qty</th><th class="r">Rate</th><th class="r">Amt</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="line"></div>
    <table>
      <tr><td>Total Qty: ${totalQty}</td><td class="r">Sub: ${Number(o.subtotal || 0).toFixed(2)}</td></tr>
      ${r.show_gst_breakup !== false
        ? `<tr><td>CGST (${halfRate}%)</td><td class="r">${halfAmt}</td></tr>
      <tr><td>SGST (${halfRate}%)</td><td class="r">${halfAmt}</td></tr>`
        : ''}
      ${o.discount_amount > 0 ? `<tr><td>Discount</td><td class="r">-${Number(o.discount_amount).toFixed(2)}</td></tr>` : ''}
    </table>
    <div class="line"></div>
    <table>
      <tr><td class="bold">Grand Total</td><td class="r bold">Rs.${Number(o.total_amount || 0).toFixed(2)}</td></tr>
    </table>
    <div class="line"></div>
    <div class="center">Prices are inclusive of GST</div>
    <div class="center">Thank You, Visit Again!</div>
    <div class="center">Powered by BillByte</div>
  </body></html>`
}

// ── Print routing helpers ─────────────────────────────────────────────────────

function hasValidTarget(p) {
  return (p.type === 'usb') ? !!p.usbName?.trim() : !!p.ip?.trim()
}

function printKOTData(printerCfg, kotData) {
  if (printerCfg.type === 'usb' && printerCfg.usbName?.trim())
    return printHtmlToUSB(printerCfg.usbName.trim(), buildKOTHtml(kotData))
  if (printerCfg.ip?.trim())
    return printToThermal(printerCfg.ip.trim(), buildKOTBuffer(kotData))
  return Promise.reject(new Error('Printer not configured'))
}

function printBillData(printerCfg, billData) {
  if (printerCfg.type === 'usb' && printerCfg.usbName?.trim())
    return printHtmlToUSB(printerCfg.usbName.trim(), buildBillHtml(billData))
  if (printerCfg.ip?.trim())
    return printToThermal(printerCfg.ip.trim(), buildBillBuffer(billData))
  return Promise.reject(new Error('Printer not configured'))
}

// ── KOT auto-print polling ────────────────────────────────────────────────────

const API_BASE = 'https://api.billbyte.co.in/api'
let _authToken             = null
let _restaurantName        = ''
let _kotInitialized        = false
let _pollingTimer          = null
const _printedKots         = new Set()
const _printedKotsTs       = {}       // key -> timestamp, persisted to disk
const _recentDirectPrints  = new Map()
const DIRECT_PRINT_TTL     = 30_000
const KOT_PERSIST_TTL      = 24 * 60 * 60 * 1000  // keep for 24 h
let   _startSeq            = 0

// ── Printer config: backend is source of truth, local file is offline cache ────
// The owner configures printers once (from any device); the backend stores it
// and this PC reads it. Falls back to the local file for legacy setups or when
// the backend is unreachable, so printing never stops working offline.
const CONFIG_TTL = 10_000
let _cfgCache   = null
let _cfgCacheTs = 0

async function _fetchBackendConfig() {
  if (!_authToken) return null
  try {
    const res = await fetch(`${API_BASE}/auth/printer-config`, {
      headers: { Authorization: `Bearer ${_authToken}` },
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

async function getEffectiveConfig() {
  if (_cfgCache && Date.now() - _cfgCacheTs < CONFIG_TTL) return _cfgCache
  const backend = await _fetchBackendConfig()
  const backendHasPrinters = backend && Array.isArray(backend.printers) && backend.printers.length > 0
  let cfg
  if (backendHasPrinters) {
    cfg = backend
    try { writePrinterConfig(backend) } catch {}   // refresh local offline cache
  } else {
    cfg = readPrinterConfig()                       // legacy / offline / not yet set on server
  }
  _cfgCache = cfg
  _cfgCacheTs = Date.now()
  return cfg
}

// ── Menu category map (for routing KOT items to specific printers) ────────────
let _menuMap   = null      // { byId: Map<itemId, catId>, byName: Map<lowerName, catId> }
let _menuMapTs = 0
const MENU_MAP_TTL = 5 * 60 * 1000

function _printersRouteByCategory(printers) {
  return printers.some(p => Array.isArray(p.categories) && p.categories.length)
}

async function _getMenuMap() {
  if (_menuMap && Date.now() - _menuMapTs < MENU_MAP_TTL) return _menuMap
  try {
    const res = await fetch(`${API_BASE}/menu/items`, {
      headers: { Authorization: `Bearer ${_authToken}` },
    })
    if (res.ok) {
      const data  = await res.json()
      const items = data.items || data || []
      const byId = new Map(), byName = new Map()
      for (const it of items) {
        if (it.category_id == null) continue
        byId.set(it.id, it.category_id)
        if (it.name) byName.set(String(it.name).trim().toLowerCase(), it.category_id)
      }
      _menuMap = { byId, byName }; _menuMapTs = Date.now()
    }
  } catch { /* keep stale map on failure */ }
  return _menuMap || { byId: new Map(), byName: new Map() }
}

function _resolveCategory(item, menuMap) {
  if (item.menu_item_id != null && menuMap.byId.has(item.menu_item_id)) return menuMap.byId.get(item.menu_item_id)
  const nm = item.name ? String(item.name).trim().toLowerCase() : ''
  if (nm && menuMap.byName.has(nm)) return menuMap.byName.get(nm)
  return null
}

// Subset of `items` that should print on `printer`, given all configured printers.
// A printer with no categories = catch-all (prints what no other printer claims).
function _itemsForPrinter(printer, allPrinters, items, menuMap) {
  const cats        = (printer.categories || []).map(Number)
  const claimed     = new Set(allPrinters.flatMap(p => (p.categories || []).map(Number)))
  const hasCatchAll = allPrinters.some(p => !(p.categories || []).length)

  if (cats.length === 0) {
    return items.filter(it => { const c = _resolveCategory(it, menuMap); return c == null || !claimed.has(c) })
  }
  const set = new Set(cats)
  const out = items.filter(it => { const c = _resolveCategory(it, menuMap); return c != null && set.has(c) })
  if (!hasCatchAll) {
    // No catch-all printer — send orphan/unknown items to every category printer so none are lost
    for (const it of items) {
      const c = _resolveCategory(it, menuMap)
      if ((c == null || !claimed.has(c)) && !out.includes(it)) out.push(it)
    }
  }
  return out
}

function _kotCachePath() {
  return path.join(app.getPath('userData'), 'printed-kots.json')
}

function _loadKotCache() {
  try {
    const raw = JSON.parse(fs.readFileSync(_kotCachePath(), 'utf8'))
    const now = Date.now()
    for (const [key, ts] of Object.entries(raw)) {
      if (now - ts < KOT_PERSIST_TTL) {
        _printedKots.add(key)
        _printedKotsTs[key] = ts
      }
    }
  } catch { /* no cache yet */ }
}

function _markPrinted(key) {
  if (_printedKots.has(key)) return
  _printedKots.add(key)
  _printedKotsTs[key] = Date.now()
  try { fs.writeFileSync(_kotCachePath(), JSON.stringify(_printedKotsTs), 'utf8') } catch {}
}

function _getMaxKotNum(items) {
  const nums = (items || []).map(i => i.kot_number || 1)
  return nums.length ? Math.max(...nums) : 1
}

async function _initPrintedKots() {
  try {
    const res = await fetch(`${API_BASE}/orders/?status=kot_sent&limit=100`, {
      headers: { Authorization: `Bearer ${_authToken}` },
    })
    if (!res.ok) return
    const data = await res.json()
    const orders = data.items || data || []
    for (const order of orders) {
      const maxKot = _getMaxKotNum(order.items || [])
      _markPrinted(`${order.id}-${maxKot}`)
    }
  } catch { /* disk cache already loaded — fail open */ } finally {
    _kotInitialized = true
  }
}

async function _pollKOTs() {
  if (!_authToken || !_kotInitialized) return
  const config   = await getEffectiveConfig()
  const printers = (config.printers || []).filter(hasValidTarget)
  if (!printers.length) return

  try {
    const res = await fetch(`${API_BASE}/orders/?status=kot_sent&limit=50`, {
      headers: { Authorization: `Bearer ${_authToken}` },
    })
    if (!res.ok) return
    const data   = await res.json()
    const orders = data.items || data || []

    const routeByCategory = _printersRouteByCategory(printers)
    const menuMap = routeByCategory ? await _getMenuMap() : null

    for (const order of orders) {
      const allItems = (order.items || []).filter(i => !i.cancelled_at)
      if (!allItems.length) continue
      const maxKot = _getMaxKotNum(allItems)
      const key    = `${order.id}-${maxKot}`
      if (_printedKots.has(key)) continue
      _markPrinted(key)

      // skip if this order was just printed directly via IPC
      const directTs = _recentDirectPrints.get(String(order.id))
      if (directTs && Date.now() - directTs < DIRECT_PRINT_TTL) continue

      const kotItems = allItems
        .filter(i => (i.kot_number || 1) === maxKot)
        .map(i => ({ name: i.name, quantity: i.quantity, menu_item_id: i.menu_item_id }))

      const basePayload = {
        restaurantName: _restaurantName,
        orderNumber:    order.order_number,
        tableNumber:    order.table_number,
        customerName:   order.customer_name || '',
        notes:          order.notes || '',
      }
      for (const printer of printers) {
        const items = routeByCategory ? _itemsForPrinter(printer, printers, kotItems, menuMap) : kotItems
        if (!items.length) continue
        printKOTData(printer, { ...basePayload, items }).catch(err =>
          console.error(`Auto KOT print failed — ${printer.name}: ${err.message}`)
        )
      }
    }
  } catch (err) {
    console.error('KOT poll error:', err.message)
  }
}

function _startPolling() {
  const seq = ++_startSeq
  if (_pollingTimer) { clearInterval(_pollingTimer); _pollingTimer = null }
  _kotInitialized = false
  _printedKots.clear()
  _loadKotCache()  // reload disk cache so restarts/re-logins never reprint old KOTs
  _initPrintedKots().then(() => {
    if (seq !== _startSeq) return  // superseded by a later _startPolling call
    _pollingTimer = setInterval(_pollKOTs, 5000)
  })
}

function _stopPolling() {
  _startSeq++
  if (_pollingTimer) { clearInterval(_pollingTimer); _pollingTimer = null }
  _authToken = null; _restaurantName = ''; _kotInitialized = false; _printedKots.clear()
}

// ── IPC handlers ─────────────────────────────────────────────────────────────

ipcMain.on('set-auth-token', (_, { token, name }) => {
  _authToken      = token
  _restaurantName = name || ''
  _startPolling()
})

ipcMain.on('clear-auth-token', () => _stopPolling())

ipcMain.handle('get-printer-config', () => readPrinterConfig())

ipcMain.handle('save-printer-config', (_, config) => {
  writePrinterConfig(config)
  _cfgCache = null  // backend just changed — force a re-read on next print/poll
  return { ok: true }
})

ipcMain.on('print-kot', async (_, kotData) => {
  const config   = await getEffectiveConfig()
  const printers = (config.printers || []).filter(hasValidTarget)
  if (!printers.length) return
  if (kotData.orderId) _recentDirectPrints.set(String(kotData.orderId), Date.now())
  const routeByCategory = _printersRouteByCategory(printers)
  const menuMap  = routeByCategory ? await _getMenuMap() : null
  const allItems = kotData.items || []
  for (const printer of printers) {
    const items = routeByCategory ? _itemsForPrinter(printer, printers, allItems, menuMap) : allItems
    if (!items.length) continue
    printKOTData(printer, { ...kotData, items }).catch(err =>
      console.error(`KOT print failed — ${printer.name}: ${err.message}`)
    )
  }
})

ipcMain.on('print-bill', async (_, billData) => {
  const orderId = billData?.order?.id
  if (orderId) _recentDirectPrints.set(String(orderId), Date.now())
  const config      = await getEffectiveConfig()
  const billPrinter = config.billPrinter
  if (!billPrinter || !hasValidTarget(billPrinter)) return
  printBillData(billPrinter, billData).catch(err =>
    console.error(`Bill print failed — ${billPrinter.name}: ${err.message}`)
  )
})

ipcMain.handle('get-system-printers', async () => {
  const wins = BrowserWindow.getAllWindows()
  if (!wins.length) return []
  try {
    const list = await wins[0].webContents.getPrintersAsync()
    return list.map(p => p.name)
  } catch { return [] }
})

// ── Window ────────────────────────────────────────────────────────────────────

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    title: 'BillByte POS',
    icon: path.join(__dirname, 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  win.setMenu(null)

  if (isDev) {
    win.loadURL('http://localhost:3000')
    win.webContents.openDevTools({ mode: 'detach' })
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url === 'about:blank') return { action: 'allow' }
    shell.openExternal(url)
    return { action: 'deny' }
  })
}

// ── Auto-updater ──────────────────────────────────────────────────────────────

autoUpdater.on('update-downloaded', () => {
  dialog.showMessageBox({
    type: 'info',
    title: 'Update Ready',
    message: 'A new version of BillByte POS has been downloaded.',
    detail: 'Restart the app now to apply the update.',
    buttons: ['Restart Now', 'Later'],
    defaultId: 0,
  }).then(({ response }) => {
    if (response === 0) autoUpdater.quitAndInstall()
  })
})

// ── App lifecycle ─────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  session.defaultSession.webRequest.onBeforeSendHeaders(
    { urls: ['https://billbyte-backend-production.up.railway.app/*'] },
    (details, callback) => {
      details.requestHeaders['Origin'] = 'https://bill-byte-frontend.vercel.app'
      callback({ requestHeaders: details.requestHeaders })
    }
  )

  createWindow()

  if (!isDev) autoUpdater.checkForUpdatesAndNotify()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
