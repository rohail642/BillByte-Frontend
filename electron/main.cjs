const { app, BrowserWindow, shell } = require('electron')
const path = require('path')

// When running from `electron .` (dev), app is not packaged.
// When running from the installed .exe, app.isPackaged is true.
const isDev = !app.isPackaged

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    title: 'BillByte POS',
    autoHideMenuBar: true,   // hides the File/Edit/View menu bar
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false, // keep renderer sandboxed
      contextIsolation: true,
    },
  })

  // Remove the menu bar entirely
  win.setMenu(null)

  if (isDev) {
    // Dev: load from Vite's local dev server
    win.loadURL('http://localhost:3000')
    win.webContents.openDevTools({ mode: 'detach' })
  } else {
    // Production: load the built React files from disk
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  // Any <a target="_blank"> or window.open() opens in the system browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
}

app.whenReady().then(() => {
  createWindow()

  // macOS: re-create window when dock icon is clicked and no windows are open
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
