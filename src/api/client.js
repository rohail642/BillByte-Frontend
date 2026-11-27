import axios from 'axios'
import { useAuthStore } from '../store/auth'

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'

const client = axios.create({ baseURL: API_URL })

client.interceptors.request.use(cfg => {
  try {
    const raw = localStorage.getItem('bb_auth')
    if (raw) {
      const parsed = JSON.parse(raw)
      // Zustand persist wraps state inside a "state" key
      const token = parsed?.state?.token || parsed?.token
      if (token) cfg.headers.Authorization = `Bearer ${token}`
    }
  } catch (e) {}
  return cfg
})

client.interceptors.response.use(
  res => res.data,
  err => {
    // Session expired / revoked: clear the in-memory login too, not just the
    // saved copy. Otherwise the app still thinks it's signed in, later requests
    // go out without a token and every screen silently shows empty data.
    const signedIn = !!err.config?.headers?.Authorization || !!useAuthStore.getState().token
    if (err.response?.status === 401 && !err.config?.url?.includes('/auth/login') && signedIn) {
      useAuthStore.getState().clearAuth()
      localStorage.removeItem('bb_auth')
      try { window.electronAPI?.clearAuthToken?.() } catch { /* not desktop */ }
      window.location.hash = '/login'
    }
    const detail = err.response?.data?.detail
    const message = Array.isArray(detail)
      ? detail[0]?.msg || 'Validation error'
      : typeof detail === 'string'
        ? detail
        : err.message || 'Request failed'
    return Promise.reject(message)
  }
)

export default client