import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import toast from 'react-hot-toast'
import { registerSW } from 'virtual:pwa-register'
import { Capacitor } from '@capacitor/core'
import { installAndroidPrinterBridge } from './native/printerBridge'
import { initLiveUpdates } from './native/liveUpdate'
import App from './App'
import './index.css'

if (Capacitor.isNativePlatform()) {
  // Native Android app: install the silent ESC/POS printing bridge before
  // React mounts, and use Capgo OTA for updates. The PWA service worker is
  // intentionally NOT registered here — it would re-introduce stale-cache
  // update problems and conflict with OTA bundle swapping.
  installAndroidPrinterBridge()
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