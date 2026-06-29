import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import toast from 'react-hot-toast'
import { registerSW } from 'virtual:pwa-register'
import { Capacitor } from '@capacitor/core'
import { initLiveUpdates } from './native/liveUpdate'
import App from './App'
import './index.css'

if (Capacitor.isNativePlatform()) {
  // Native Android app. Printing is SEND-ONLY (same as the PWA): the phone just
  // creates the order on the server, and the restaurant's PC (desktop app) prints
  // the KOT via its poller. This works on mobile data and never double-prints.
  // (The native direct-print path in ./native/printerBridge.js is intentionally
  // left unwired — it's only for future phone-only restaurants with no PC.)
  // The PWA service worker is NOT registered on native so it can't re-introduce
  // stale-cache update problems or conflict with OTA bundle swapping.
  initLiveUpdates()
} else {
  registerSW()
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      refetchOnMount: true,
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <QueryClientProvider client={queryClient}>
    <App />
    <Toaster
      position="bottom-center"
      toastOptions={{
        style: {
          background: '#1c1917',
          color: '#fff',
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          fontSize: '13px',
          fontWeight: '600',
          borderRadius: '100px',
          padding: '10px 18px',
        },
        success: { iconTheme: { primary: '#16a34a', secondary: '#fff' } },
        error:   { iconTheme: { primary: '#dc2626', secondary: '#fff' } },
      }}
    />
  </QueryClientProvider>
)