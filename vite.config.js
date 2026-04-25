import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',          // relative paths so Electron can load built files via file://
  server: {
    port: 3000,
    open: false,       // Electron opens its own window; no need for a browser tab
  },
})
