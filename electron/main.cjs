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
  const { restaurantName, orderNumber, tableNumber, items, notes } = kotData
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
    Buffer.from(`${dateStr}   ${timeStr}\n`),
    LINE,
    left,
    boldOn,
    Buffer.from(' QTY   ITEM\n'),
    boldOff,
    LINE,
  ]

  for (const item of (items || [])) {
    const qty  = String(item.quantity || 1).padStart(3)
    const name = (item.name || '').substring(0, 26)
    parts.push(Buffer.from(` ${qty}   ${name}\n`))
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
  parts.push(Buffer.from(`${lpad('#', 3)}${lpad('Item', 21)}${rpad('Qty', 4)}${rpad('Rate', 8)}${rpad('Amt', 6)}\n`))
  parts.push(boldOff, LINE)

  const items = (o.items || []).filter(i => !i.cancelled_at)
  items.forEach((item, idx) => {
    const amt = (item.total || item.price * item.quantity)
    parts.push(Buffer.from(
      `${lpad(idx + 1, 3)}${lpad(item.name, 21)}${rpad(item.quantity, 4)}${rpad(Number(item.price).toFixed(2), 8)}${rpad(Number(amt).toFixed(2), 6)}\n`
    ))
  })

  const totalQty = items.reduce((s, i) => s + i.quantity, 0)
  const fmtRow   = (label, value) => Buffer.from(`${lpad(label, W - 10)}${rpad(value, 10)}\n`)

  parts.push(LINE)
  parts.push(fmtRow(`Total Qty: ${totalQty}`, `Sub: ${Number(o.subtotal || 0).toFixed(2)}`))
  parts.push(fmtRow(`CGST (${halfRate}%)`, halfAmt))
  parts.push(fmtRow(`SGST (${halfRate}%)`, halfAmt))
  if (o.discount_amount > 0) parts.push(fmtRow('Discount', `-${Number(o.discount_amount).toFixed(2)}`))

  parts.push(LINE, boldOn)
  parts.push(fmtRow('Grand Total', `Rs.${Number(o.total_amount || 0).toFixed(2)}`))
  parts.push(boldOff, LINE, center)
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
        { silent: true, deviceName: printerName, printBackground: false, pageSize: { width: 80000, height: 297000 } },
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
  @page { size: 80mm auto; margin: 3mm 5mm 15mm 5mm; }
  body { font-family: 'Courier New', monospace; font-size: 10pt; width: 70mm; margin: 0; padding-bottom: 10mm; }
  h1 { font-size: 14pt; text-align: center; font-weight: bold; margin-bottom: 3px; }
  .center { text-align: center; }
  .line { border-top: 1px dashed #000; margin: 4px 0; }
  table { width: 100%; border-collapse: collapse; }
  th { font-weight: bold; border-bottom: 1px solid #000; padding: 2px 0; text-align: left; }
  td { padding: 2px 0; vertical-align: top; }
  .r { text-align: right; }
  .c { text-align: center; }
  .bold { font-weight: bold; }
`

function buildKOTHtml(kotData) {
  const { restaurantName, orderNumber, tableNumber, items, notes } = kotData
  const now      = new Date()
  const dateStr  = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  const timeStr  = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
  const tableLabel = tableNumber ? `Table: ${tableNumber}` : 'Takeaway / Delivery'
  const orderLabel = orderNumber ? `&nbsp;&nbsp;#${orderNumber}` : ''
  const rows = (items || []).map(i =>
    `<tr><td style="width:50px">${i.quantity || 1}</td><td>${i.name || ''}</td></tr>`
  ).join('')
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${RECEIPT_CSS}</style></head><body>
    <h1>KOT</h1>
    <div class="center">${restaurantName || 'Restaurant'}</div>
    <div class="line"></div>
    <div>${tableLabel}${orderLabel}</div>
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
      <tr><td>CGST (${halfRate}%)</td><td class="r">${halfAmt}</td></tr>
      <tr><td>SGST (${halfRate}%)</td><td class="r">${halfAmt}</td></tr>
      ${o.discount_amount > 0 ? `<tr><td>Discount</td><td class="r">-${Number(o.discount_amount).toFixed(2)}</td></tr>` : ''}
    </table>
    <div class="line"></div>
    <table>
      <tr><td class="bold">Grand Total</td><td class="r bold">Rs.${Number(o.total_amount || 0).toFixed(2)}</td></tr>
    </table>
    <div class="line"></div>
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
let _authToken       = null
let _restaurantName  = ''
let _kotInitialized  = false
let _pollingTimer    = null
const _printedKots          = new Set()
const _recentDirectPrints   = new Map()
const DIRECT_PRINT_TTL      = 30000
let   _startSeq             = 0

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
      _printedKots.add(`${order.id}-${maxKot}`)
    }
  } catch { /* fail open */ } finally {
    _kotInitialized = true
  }
}

async function _pollKOTs() {
  if (!_authToken || !_kotInitialized) return
  const config   = readPrinterConfig()
  const printers = (config.printers || []).filter(hasValidTarget)
  if (!printers.length) return

  try {
    const res = await fetch(`${API_BASE}/orders/?status=kot_sent&limit=50`, {
      headers: { Authorization: `Bearer ${_authToken}` },
    })
    if (!res.ok) return
    const data   = await res.json()
    const orders = data.items || data || []

    for (const order of orders) {
      const allItems = (order.items || []).filter(i => !i.cancelled_at)
      if (!allItems.length) continue
      const maxKot = _getMaxKotNum(allItems)
      const key    = `${order.id}-${maxKot}`
      if (_printedKots.has(key)) continue
      _printedKots.add(key)

      // skip if this order was just printed directly via IPC
      const directTs = _recentDirectPrints.get(String(order.id))
      if (directTs && Date.now() - directTs < DIRECT_PRINT_TTL) continue

      const kotItems = allItems
        .filter(i => (i.kot_number || 1) === maxKot)
        .map(i => ({ name: i.name, quantity: i.quantity }))

      const kotPayload = {
        restaurantName: _restaurantName,
        orderNumber:    order.order_number,
        tableNumber:    order.table_number,
        items:          kotItems,
        notes:          order.notes || '',
      }
      for (const printer of printers) {
        printKOTData(printer, kotPayload).catch(err =>
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
  return { ok: true }
})

ipcMain.on('print-kot', (_, kotData) => {
  const config   = readPrinterConfig()
  const printers = (config.printers || []).filter(hasValidTarget)
  if (!printers.length) return
  if (kotData.orderId) _recentDirectPrints.set(String(kotData.orderId), Date.now())
  for (const printer of printers) {
    printKOTData(printer, kotData).catch(err =>
      console.error(`KOT print failed — ${printer.name}: ${err.message}`)
    )
  }
})

ipcMain.on('print-bill', (_, billData) => {
  const orderId = billData?.order?.id
  if (orderId) _recentDirectPrints.set(String(orderId), Date.now())
  const config      = readPrinterConfig()
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
