import axios from 'axios'

export const API_URL = 'http://localhost:8000/api'

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
    if (err.response?.status === 401) {
      localStorage.removeItem('bb_auth')
      window.location.href = '/login'
    }
    return Promise.reject(err.response?.data?.detail || err.message || 'Request failed')
  }
)

export default client