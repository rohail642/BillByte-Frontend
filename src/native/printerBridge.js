// Android (Capacitor) printing bridge.
//
// Installs a window.electronAPI-compatible object so the existing call sites
// (Send KOT, print bill) work unchanged on mobile. When a waiter/cashier sends
// a KOT, it prints directly to the printer the OWNER configured — the config is
// read from the backend (restaurant-wide, shared to every device), so a waiter's
// phone prints to the same printer without configuring anything locally.
//
// Printing goes out as raw ESC/POS bytes over TCP to a WiFi thermal printer at
// ip:9100 via the native EscPosPrinter plugin — no print dialog.

import { Capacitor, registerPlugin } from '@capacitor/core'
import { buildKOTBuffer, buildBillBuffer, bytesToBase64 } from './escpos'
import { getMenuItems } from '../api/menu'
import { getPrinterConfig } from '../api/printers'

const EscPosPrinter = registerPlugin('EscPosPrinter')

const CONFIG_TTL = 10_000
const MENU_MAP_TTL = 5 * 60 * 1000

// ── Config (fetched from backend, briefly cached) ────────────────────────────
let _config = null
let _configTs = 0

async function getConfig() {
  if (_config && Date.now() - _configTs < CONFIG_TTL) return _config
  try {
    const cfg = await getPrinterConfig()
    _config = cfg || { printers: [], billPrinter: null }
    _configTs = Date.now()
  } catch {
    if (!_config) _config = { printers: [], billPrinter: null }
  }
  return _config
}

function hasValidTarget(p) {
  return !!p?.ip?.trim()   // Android prints over the network only
}

// ── Raw TCP print ────────────────────────────────────────────────────────────
async function printBytes(ip, bytes) {
  await EscPosPrinter.print({ ip: ip.trim(), port: 9100, data: bytesToBase64(bytes) })
}

// ── Category routing (ported from electron/main.cjs) ─────────────────────────
let _menuMap = null
let _menuMapTs = 0

function _printersRouteByCategory(printers) {
  return printers.some(p => Array.isArray(p.categories) && p.categories.length)
}

async function _getMenuMap() {
  if (_menuMap && Date.now() - _menuMapTs < MENU_MAP_TTL) return _menuMap
  try {
    const data = await getMenuItems()
    const items = data.items || data || []
    const byId = new Map(), byName = new Map()
    for (const it of items) {
      if (it.category_id == null) continue
      byId.set(it.id, it.category_id)
      if (it.name) byName.set(String(it.name).trim().toLowerCase(), it.category_id)
    }
    _menuMap = { byId, byName }; _menuMapTs = Date.now()
  } catch { /* keep stale map on failure */ }
  return _menuMap || { byId: new Map(), byName: new Map() }
}

function _resolveCategory(item, menuMap) {
  if (item.menu_item_id != null && menuMap.byId.has(item.menu_item_id)) return menuMap.byId.get(item.menu_item_id)
  const nm = item.name ? String(item.name).trim().toLowerCase() : ''
  if (nm && menuMap.byName.has(nm)) return menuMap.byName.get(nm)
  return null
}

function _itemsForPrinter(printer, allPrinters, items, menuMap) {
  const cats = (printer.categories || []).map(Number)
  const claimed = new Set(allPrinters.flatMap(p => (p.categories || []).map(Number)))
  const hasCatchAll = allPrinters.some(p => !(p.categories || []).length)

  if (cats.length === 0) {
    return items.filter(it => { const c = _resolveCategory(it, menuMap); return c == null || !claimed.has(c) })
  }
  const set = new Set(cats)
  const out = items.filter(it => { const c = _resolveCategory(it, menuMap); return c != null && set.has(c) })
  if (!hasCatchAll) {
    for (const it of items) {
      const c = _resolveCategory(it, menuMap)
      if ((c == null || !claimed.has(c)) && !out.includes(it)) out.push(it)
    }
  }
  return out
}

// ── Print dispatch ───────────────────────────────────────────────────────────
async function dispatchKOT(kotData) {
  const config = await getConfig()
  const printers = (config.printers || []).filter(hasValidTarget)
  if (!printers.length) return

  const routeByCategory = _printersRouteByCategory(printers)
  const menuMap = routeByCategory ? await _getMenuMap() : null
  const allItems = kotData.items || []

  for (const printer of printers) {
    const items = routeByCategory ? _itemsForPrinter(printer, printers, allItems, menuMap) : allItems
    if (!items.length) continue
    printBytes(printer.ip, buildKOTBuffer({ ...kotData, items }))
      .catch(err => console.error(`KOT print failed — ${printer.name}: ${err.message || err}`))
  }
}

async function dispatchBill(billData) {
  const config = await getConfig()
  const bp = config.billPrinter
  if (!bp || !hasValidTarget(bp)) return
  printBytes(bp.ip, buildBillBuffer(billData))
    .catch(err => console.error(`Bill print failed — ${bp.name}: ${err.message || err}`))
}

// ── Install the window.electronAPI-compatible shim ───────────────────────────
export function installAndroidPrinterBridge() {
  if (!Capacitor.isNativePlatform()) return
  if (window.electronAPI) return  // never shadow the real desktop bridge

  window.electronAPI = {
    isAndroid: true,
    platform: 'android',
    printKOT: (kotData) => { dispatchKOT(kotData) },
    printBill: (billData) => { dispatchBill(billData) },
    // Invalidate the cached config right after the owner saves new settings.
    refreshPrinterConfig: () => { _config = null; _configTs = 0 },
  }
}
