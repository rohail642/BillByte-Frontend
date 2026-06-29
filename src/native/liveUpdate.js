// Silent over-the-air (OTA) web-bundle updates for the Android app.
//
// Self-hosted manual mode (no paid Appflow): on launch we confirm the running
// bundle is healthy, fetch a small manifest, and if a newer web bundle exists
// we download it in the background and stage it for the NEXT app launch. This
// means updates land silently — no Play Store review, no mid-shift disruption,
// and no print job ever interrupted by a reload.
//
// Manifest (hosted anywhere static — Vercel, GitHub Releases, the API):
//   { "version": "1.1.20", "url": "https://.../billbyte-1.1.20.zip" }
// The zip is the built `dist/` folder. See CLAUDE.md → "Android OTA releases".

import { Capacitor } from '@capacitor/core'

const MANIFEST_URL =
  import.meta.env.VITE_OTA_MANIFEST_URL || 'https://app.billbyte.co.in/ota/latest.json'

export async function initLiveUpdates() {
  if (!Capacitor.isNativePlatform()) return

  let CapacitorUpdater
  try {
    ({ CapacitorUpdater } = await import('@capgo/capacitor-updater'))
  } catch {
    return // plugin unavailable (e.g. web build) — nothing to do
  }

  // CRITICAL: tell the updater the current bundle booted OK. Without this the
  // plugin auto-rolls back to the previous bundle after a timeout.
  try { await CapacitorUpdater.notifyAppReady() } catch { /* ignore */ }

  // Apply a staged bundle when the app returns to the foreground after being
  // backgrounded for a while (covers users who leave the app open for days).
  try {
    const { App } = await import('@capacitor/app')
    App.addListener('appStateChange', async ({ isActive }) => {
      if (isActive) checkForUpdate(CapacitorUpdater).catch(() => {})
    })
  } catch { /* @capacitor/app optional */ }

  // Initial check on cold start.
  checkForUpdate(CapacitorUpdater).catch(() => {})
}

let _checking = false

async function checkForUpdate(CapacitorUpdater) {
  if (_checking) return
  _checking = true
  try {
    const res = await fetch(`${MANIFEST_URL}?t=${Date.now()}`, { cache: 'no-store' })
    if (!res.ok) return
    const manifest = await res.json()
    if (!manifest?.version || !manifest?.url) return

    // Capgo reports the APK's own bundle as "builtin" — in that case the real
    // version is the one baked into this build at compile time.
    const current = await CapacitorUpdater.current()
    let currentVersion = current?.bundle?.version
    if (!currentVersion || currentVersion === 'builtin') currentVersion = __APP_VERSION__

    if (manifest.version === currentVersion) return // already up to date

    // Download in the background, then stage for the next launch (silent).
    const bundle = await CapacitorUpdater.download({
      version: manifest.version,
      url: manifest.url,
    })
    await CapacitorUpdater.next({ id: bundle.id })
  } catch (err) {
    console.error('OTA update check failed:', err?.message || err)
  } finally {
    _checking = false
  }
}
