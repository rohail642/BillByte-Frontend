import client, { API_URL } from './client'

// ── Staff (authenticated) ─────────────────────────────────────────────────────
export const getQrRequests    = (status = 'pending') => client.get('/table-ordering/requests', { params: { status } })
export const acceptQrRequest  = id                   => client.post(`/table-ordering/requests/${id}/accept`)
export const rejectQrRequest  = (id, reason)         => client.post(`/table-ordering/requests/${id}/reject`, { reason })
export const getQrCalls        = ()                   => client.get('/table-ordering/calls')
export const finishQrCall      = id                   => client.post(`/table-ordering/calls/${id}/done`)
export const getQrSettings    = ()                   => client.get('/table-ordering/settings')
export const saveQrSettings   = body                 => client.put('/table-ordering/settings', body)
export const getQrTables      = ()                   => client.get('/table-ordering/tables')
export const regenerateQrCodes = ()                  => client.post('/table-ordering/tables/regenerate')

// Where the guest page lives. In the browser that's this site; inside Electron /
// Android (file:// or capacitor://) it must be the public web app.
export function guestOrderUrl(token) {
  const base = /^https?:$/.test(window.location.protocol)
    ? window.location.origin + window.location.pathname.replace(/index\.html$/, '')
    : (import.meta.env.VITE_PUBLIC_APP_URL || 'https://app.billbyte.co.in/')
  return `${base.replace(/\/?$/, '/')}#/order/${token}`
}

// ── Guest (public) — plain fetch: no staff token, no 401→login redirect ──────
async function publicCall(path, opts = {}) {
  const res = await fetch(`${API_URL}/public/table${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
  })
  let data = null
  try { data = await res.json() } catch { /* empty body */ }
  if (!res.ok) {
    const d = data?.detail
    const msg = Array.isArray(d) ? d[0]?.msg : d
    const err = new Error(res.status === 429 && !msg ? 'Too many requests — please wait a moment.' : (msg || 'Something went wrong'))
    err.status = res.status
    throw err
  }
  return data
}

export const guestGetMenu    = token                 => publicCall(`/${encodeURIComponent(token)}/menu`)
export const guestPlaceOrder = (token, body)         => publicCall(`/${encodeURIComponent(token)}/orders`, { method: 'POST', body: JSON.stringify(body) })
export const guestGetStatus  = (token, id, key)      => publicCall(`/${encodeURIComponent(token)}/orders/${id}?key=${encodeURIComponent(key)}`)
export const guestGetTable   = (token, seen)         => publicCall(`/${encodeURIComponent(token)}/table${seen ? `?seen=${encodeURIComponent(seen)}` : ''}`)
export const guestCall       = (token, body, opts)   => publicCall(`/${encodeURIComponent(token)}/call`, { method: 'POST', body: JSON.stringify(body), ...(opts || {}) })
