import client from './client'

// Restaurant-wide printer config, stored on the server so the owner configures
// it once and every device (waiter phones, cashier tablets) prints to the same
// printer. GET is readable by any logged-in user; PUT is owner/manager-only.
export const getPrinterConfig  = ()    => client.get('/auth/printer-config')
export const savePrinterConfig = (cfg) => client.put('/auth/printer-config', cfg)
