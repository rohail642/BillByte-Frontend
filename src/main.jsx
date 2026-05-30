import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import toast from 'react-hot-toast'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import './index.css'

registerSW({
  onNeedRefresh(updateSW) {
    toast(
      t => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span>Update available</span>
          <button
            onClick={() => { toast.dismiss(t.id); updateSW(true); setTimeout(() => window.location.reload(), 300) }}
            style={{
              background: '#16a34a', color: '#fff', border: 'none',
              borderRadius: 20, padding: '4px 12px', fontWeight: 700,
              fontSize: 12, cursor: 'pointer', flexShrink: 0,
            }}
          >
            Refresh
          </button>
        </div>
      ),
      { duration: Infinity, id: 'sw-update', style: { borderRadius: '12px' } }
    )
  },
})

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 0,
      refetchOnWindowFocus: true,
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