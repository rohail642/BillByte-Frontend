# CLAUDE.md — BillByte React Frontend

This file is read automatically at the start of every Claude Code session.

## Project Overview

**BillByte** is a multi-tenant Restaurant OS. This is the React frontend.
The backend lives in `../billbyte-backend/` (FastAPI + PostgreSQL via Supabase).

## Commands

```bash
# Web dev server (localhost:3000)
npm run dev

# Electron desktop app (dev mode with hot reload)
npm run electron:dev

# Build production .exe installer → release/BillByte POS Setup x.x.x.exe
npm run electron:build

# Web-only production build
npm run build
```

## Tech Stack

| Tool | Version | Purpose |
|---|---|---|
| React 19 | ^19.2 | UI |
| Vite 8 | ^8.0 | Build tool, dev server (port 3000) |
| React Router 7 | ^7.14 | Routing — uses **HashRouter** (required for Electron file:// loading) |
| TanStack Query 5 | ^5.96 | Server state, caching |
| Zustand 5 | ^5.0 | Client state (auth, cart, UI) |
| Axios | ^1.14 | HTTP client |
| Tailwind CSS 3 | ^3.4 | Styling |
| Lucide React | ^1.7 | Icons |
| Recharts | ^3.8 | Charts (dashboard/reports) |
| Electron 34 | ^34.0 | Desktop app packaging |
| electron-builder | ^25.1 | Builds .exe installer |

## Architecture

### API layer — `src/api/`

All API calls go through `src/api/client.js` which:
- Base URL: `http://localhost:8000/api` (change to deployed URL for production)
- Auto-attaches JWT from `localStorage` (`bb_auth` key, Zustand persist format)
- On 401: clears auth and redirects to `/login`

Individual modules: `auth.js`, `menu.js`, `orders.js`, `customers.js`, `inventory.js`, `staff.js`, `recipes.js`, `reports.js`, `team.js`

### State — `src/store/`

| Store | File | Persisted | Purpose |
|---|---|---|---|
| `useAuthStore` | `store/auth.js` | ✅ localStorage (`bb_auth`) | JWT token, user (id/name/role), restaurantId |
| `useCartStore` | `store/cart.js` | ❌ | POS cart items, order type, table, discount, GST rate |
| `useUIStore` | `store/ui.js` | ❌ | Sidebar open/close, AI assistant open/close |

### Routing — `src/App.jsx`

Uses `HashRouter` (NOT BrowserRouter — Electron requires this for file:// protocol).

**Role-based redirects on login:**
- `owner` → `/` (Dashboard)
- `cashier` → `/pos` (POS Terminal)
- `waiter` → `/waiter` (Waiter View, full-screen)

**Route access by role:**

| Route | Page | Roles |
|---|---|---|
| `/` | Dashboard | owner |
| `/pos` | POSTerminal | cashier, owner |
| `/billing` | Billing | cashier |
| `/tables` | CashierTables | cashier |
| `/orders` | Orders | owner, cashier |
| `/online-orders` | OnlineOrders | owner, cashier |
| `/menu` | Menu | owner |
| `/inventory` | Inventory | owner, cashier |
| `/crm` | CRM | owner, cashier |
| `/staff` | Staff | owner |
| `/reports` | Reports | owner |
| `/settings` | Settings | owner |
| `/waiter` | WaiterView | waiter (full-screen, no sidebar) |

### Layout

`AppLayout` (`src/components/layout/AppLayout.jsx`) wraps all owner/cashier routes:
- `Sidebar` — role-filtered nav links, inventory alert badge, user info + logout
- `Topbar` — top bar
- `<Outlet>` — page content

`WaiterView` and previously `POSTerminal` bypass AppLayout entirely (full-screen).

### Design System — `src/index.css`

CSS custom properties (tokens):

```
--bg, --bg2, --surface, --surface2, --surface3      backgrounds
--green, --green2, --green3, --green-dim, --green-mid  brand green
--orange, --orange-dim                               accent orange
--blue, --blue-dim
--amber, --amber-dim
--red, --red-dim
--purple, --purple-dim
--text, --text2, --text3, --muted                   text hierarchy
--border, --border2                                  borders
--sidebar-w: 224px
--topbar-h: 60px
```

Fonts: `Plus Jakarta Sans` (body), `Outfit` (headings/display/font-display class).

### UI Components — `src/components/ui/`

`Button`, `Card`, `Input`, `Select`, `Modal`, `Badge`, `Spinner`, `Toggle`, `EmptyState`

## Pages Summary

### POSTerminal (`/pos`) — main cashier billing screen
The primary POS interface. Identical layout to `Billing.jsx` but lives at `/pos` and is the default landing page for cashiers.

- Left: active tables sidebar (toggleable), search, category filter chips, menu item grid
- Right: order type/table selector, customer phone lookup + loyalty points, cart items, totals, discount input, **Send KOT** + **Collect & Print** buttons
- Cart state lives in `useCartStore` (Zustand)
- After KOT: stays on page (no redirect)
- After payment: shows receipt modal with print option

### Billing (`/billing`) — legacy cashier billing (same UI as POSTerminal)

### CashierTables (`/tables`) — table management
Grid of all tables (respects `profile.table_count` and `profile.table_sections`).
Click a table → split panel showing current order + menu for adding items → Send KOT.

### WaiterView (`/waiter`) — full-screen, no sidebar
Waiter-facing interface for taking orders at tables.

### Dashboard (`/`) — owner home
Summary cards + charts. Uses `getDashboardSummary` and `getRevenueTrend`.

### Orders (`/orders`) — order list + management
### OnlineOrders (`/online-orders`) — Zomato/Swiggy webhook orders
### Menu (`/menu`) — menu item + category management
### Inventory (`/inventory`) — stock levels + low-stock alerts
### CRM (`/crm`) — customer list + loyalty points
### Staff (`/staff`) — staff accounts management
### Reports (`/reports`) — sales reports + charts
### Settings (`/settings`) — restaurant profile, GST rate, table count, sections

## Electron Setup

```
electron/
  main.cjs      — creates BrowserWindow, loads localhost:3000 (dev) or dist/index.html (prod)
  preload.cjs   — exposes window.electronAPI.isElectron + platform to renderer
```

**Dev detection:** `app.isPackaged` — false when running via `electron .`, true in installed build.

**Build output:** `release/BillByte POS Setup x.x.x.exe` (NSIS installer for Windows).
`release/` is in `.gitignore` — never commit it (files are 80-180 MB).

**vite.config.js** has `base: './'` — required so Electron can load built files via `file://`.

## Android App (Capacitor)

The same React build is shipped to the **Google Play Store** as a native Android app via Capacitor. It exists primarily for two things a PWA cannot do: **silent thermal printing** (no OS print dialog) and **reliable OTA updates** (no service-worker stale-cache problem). The web code is shared — there is no separate mobile codebase.

```
android/                                  — generated native project (committed; build artifacts gitignored)
  app/src/main/java/com/billbyte/pos/
    MainActivity.java                     — registers EscPosPrinterPlugin
    EscPosPrinterPlugin.java             — native TCP raw-print to ip:9100 (no dialog)
src/native/
  escpos.js                               — ESC/POS KOT + bill byte builders (ported 1:1 from electron/main.cjs)
  printerBridge.js                        — installs a window.electronAPI-compatible shim on Android
  liveUpdate.js                           — Capgo self-hosted OTA (silent, applies on next launch)
capacitor.config.json
scripts/make-ota-bundle.mjs               — zips dist/ into an OTA bundle + latest.json manifest
```

**Key idea — the `window.electronAPI` shim:** on Android, `installAndroidPrinterBridge()` (called in `main.jsx` before React mounts) installs a `window.electronAPI` object exposing `printKOT` / `printBill` (plus `refreshPrinterConfig`). So the existing Send KOT / bill-print call sites work unchanged. `isAndroid: true` is set so Settings can hide the desktop-only USB tab.

**Printer config is server-side and shared.** The owner configures printers once in Settings → it saves to `restaurant.printer_config` on the backend (`PUT /api/auth/printer-config`, owner/manager only). Every device reads it (`GET /api/auth/printer-config`, any logged-in user). So when a **waiter sends a KOT from their phone, it prints directly to the printer the owner configured** — the waiter configures nothing. There is **no per-device polling and no "auto-print station"** — printing is the direct path only: tap Send KOT → ESC/POS bytes go straight to the printer.

**Printing:** network (WiFi/LAN) thermal printers only on mobile — the bridge fetches the config (cached ~10s), routes items by category, opens a TCP socket to `ip:9100`, and writes raw ESC/POS bytes via the native `EscPosPrinterPlugin`. No print dialog. USB is desktop-only.

**Settings save fans out:** `savePrinters()` writes to the backend (source of truth), then mirrors to `window.electronAPI.savePrinterConfig` (desktop's local file = offline cache) and calls `refreshPrinterConfig` (mobile, to drop the cached config).

**Desktop reads config from the backend too.** `electron/main.cjs` `getEffectiveConfig()` fetches `/api/auth/printer-config` (cached ~10s): the backend config wins when it has printers, otherwise it falls back to the local file (legacy setups / offline / not yet configured on the server). So the owner configures printers once from **any** device and the PC picks it up. The desktop KOT poller and both print IPC handlers all go through `getEffectiveConfig()`; `save-printer-config` clears the cache so changes apply immediately.

**PC-as-gateway topology (recommended for USB/Bluetooth printers).** A printer without an IP (USB, or BT) can't be shared across many phones. The clean setup: run the **desktop app on the counter PC** with the printer attached. Waiters send KOTs from phones (no printer configured on the phones → they only create the order); the PC's KOT poller picks up every `kot_sent` order from the backend (~5s) and prints it — including online Zomato/Swiggy orders. Phones are order terminals; the PC is the single print brain. Mobile direct-print (WiFi printer at ip:9100) and the PC-gateway model can also coexist.

**Online Zomato/Swiggy order printing on mobile is intentionally NOT handled yet** (deferred). Those orders arrive with no device "sending" them; the desktop poller prints them (incl. in the gateway model above). Revisit only for genuinely mobile-only restaurants.

**Service worker is disabled on native** (`main.jsx` only calls `registerSW()` on web) so it never fights OTA bundle swapping or re-introduces stale caching.

### Commands

```bash
npm run android:sync     # vite build + cap sync android
npm run android:open     # build + sync + open Android Studio
npm run android:apk      # build + sync + gradlew assembleRelease (.apk)
npm run android:bundle   # build + sync + gradlew bundleRelease (.aab for Play Store)
```

Toolchain notes: the Gradle wrapper is pinned to **8.11.1** and AGP to **8.7.2** so the project builds with **JDK 23** (the default Gradle 8.2.1 that Capacitor ships cannot parse JDK 23). `compileSdk`/`targetSdk` are **35** (Play Store requirement + Capgo's work-runtime transitive). `android/local.properties` must point `sdk.dir` at the Android SDK using **forward slashes** (Java-properties escaping mangles backslashes).

### Silent OTA releases (Capgo, self-hosted — no paid Appflow)

The app does NOT auto-update against Capgo cloud. On launch it fetches `VITE_OTA_MANIFEST_URL` (default `https://app.billbyte.co.in/ota/latest.json`), and if the manifest `version` differs from the running bundle it downloads the new web bundle and stages it for the **next** app launch (never mid-shift).

To ship a web-only update (no Play Store review needed):
1. Bump `version` in `package.json`.
2. `npm run build`
3. `npm run ota:zip` → produces `release/ota/billbyte-<version>.zip` + `latest.json`.
4. Upload both so `…/ota/latest.json` and the zip are publicly reachable.

Native changes (new plugin, permission, icon, SDK bump) still require a Play Store release via `npm run android:bundle`.

### Required backend setting

Capacitor's WebView origin is `https://localhost`, so the FastAPI backend's `ALLOWED_ORIGINS` **must include `https://localhost`** (CORS) or all API calls from the app fail. Add it alongside the existing web origins.

## Key Decisions & Notes

- **HashRouter not BrowserRouter** — Electron's `file://` protocol breaks HTML5 history API. Always keep this as HashRouter.
- **`release/` is gitignored** — the .exe and unpacked app are too large for GitHub (83-181 MB). Build locally, share the .exe directly.
- **API base URL is `localhost:8000`** — works for local dev. For production/sharing, deploy the FastAPI backend and update `src/api/client.js` `API_URL`.
- **Supabase always requires internet** — even local FastAPI hits Supabase cloud for DB. Fully offline mode would require a local PostgreSQL instance.
- **GST rate syncs from profile** — `cart.setGstRate(profile.gst_rate)` is called in billing pages when profile loads. Restaurant's configured rate overrides the default 5%.
- **Cart is not persisted** — intentional, cart resets on page refresh/reload.
- **`OrderItem.name` is denormalized** — stored at order time so menu edits don't corrupt history (same as backend design).

## GitHub

Frontend repo: `https://github.com/rohail642/BillByte-Frontend`
Branch: `dev`
