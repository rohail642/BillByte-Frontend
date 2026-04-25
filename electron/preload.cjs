const { contextBridge } = require('electron')

// Expose a safe flag so React can detect it's running inside Electron
contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  platform: process.platform,
})
