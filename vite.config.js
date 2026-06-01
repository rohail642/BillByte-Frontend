import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
      },
      manifest: {
        name: 'BillByte Restaurant OS',
        short_name: 'BillByte',
        start_url: '/',
        display: 'standalone',
        background_color: '#000000',
        theme_color: '#000000',
        icons: [
          { src: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
          { src: '/favicon.png',          sizes: '32x32',   type: 'image/png' },
        ],
      },
    }),
  ],
  base: './',
  server: {
    port: 3000,
    open: false,
  },
})
