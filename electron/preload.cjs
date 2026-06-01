const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  platform:   process.platform,

  // Auth token forwarding (for KOT auto-print polling)
  setAuthToken:      (token, name) => ipcRenderer.send('set-auth-token', { token, name }),
  clearAuthToken:    ()            => ipcRenderer.send('clear-auth-token'),

  // Printing
  printKOT:          (kotData)  => ipcRenderer.send('print-kot', kotData),
  printBill:         (billData) => ipcRenderer.send('print-bill', billData),
  getPrinterConfig:  ()         => ipcRenderer.invoke('get-printer-config'),
  savePrinterConfig: (config)   => ipcRenderer.invoke('save-printer-config', config),
})
