import client from './client'

// Telegram daily reports — linking + delivery controls (owner/manager only)
export const getTelegramStatus       = () => client.get('/telegram/status')
export const createTelegramLinkToken = () => client.post('/telegram/link-token')
export const toggleTelegram          = (enabled) => client.patch('/telegram/toggle', { enabled })
export const unlinkTelegram          = () => client.delete('/telegram/link')
export const sendTelegramReportNow   = () => client.post('/telegram/send-now')
