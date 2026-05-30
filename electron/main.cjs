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
