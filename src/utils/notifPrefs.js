const KEY = 'bb_notif_prefs'
const DEFAULTS = { orderAlert: true, lowStock: true, dailySummary: true }

export function getNotifPrefs() {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') } }
  catch { return { ...DEFAULTS } }
}

export function setNotifPref(key, value) {
  const prefs = getNotifPrefs()
  localStorage.setItem(KEY, JSON.stringify({ ...prefs, [key]: value }))
}
