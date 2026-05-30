const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  platform:   process.platform,

  // KOT printing
  printKOT:          (kotData) => ipcRenderer.send('print-kot', kotData),
  getPrinterConfig:  ()        => ipcRenderer.invoke('get-printer-config'),
  savePrinterConfig: (config)  => ipcRenderer.invoke('save-printer-config', config),
})
