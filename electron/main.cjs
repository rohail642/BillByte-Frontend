const { app, BrowserWindow, shell, session, dialog, ipcMain } = require('electron')
const path = require('path')
const fs   = require('fs')
const net  = require('net')
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

  parts.push(Buffer.from('\n\n\n'))
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
  parts.push(Buffer.from('\n\n\n'))
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

// ── IPC handlers ─────────────────────────────────────────────────────────────

ipcMain.handle('get-printer-config', () => readPrinterConfig())

ipcMain.handle('save-printer-config', (_, config) => {
  writePrinterConfig(config)
  return { ok: true }
})

ipcMain.on('print-kot', (_, kotData) => {
  const config   = readPrinterConfig()
  const printers = (config.printers || []).filter(p => p.ip && p.ip.trim())
  if (!printers.length) return

  const buffer = buildKOTBuffer(kotData)

  for (const printer of printers) {
    printToThermal(printer.ip.trim(), buffer).catch(err => {
      console.error(`KOT print failed — ${printer.name} (${printer.ip}): ${err.message}`)
    })
  }
})

ipcMain.on('print-bill', (_, billData) => {
  const config      = readPrinterConfig()
  const billPrinter = config.billPrinter
  if (!billPrinter?.ip?.trim()) return

  const buffer = buildBillBuffer(billData)
  printToThermal(billPrinter.ip.trim(), buffer).catch(err => {
    console.error(`Bill print failed — ${billPrinter.name} (${billPrinter.ip}): ${err.message}`)
  })
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
