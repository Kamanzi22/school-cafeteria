import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
const __dirname = dirname(fileURLToPath(import.meta.url))
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      // Three HTML shells (see render.yaml routing) that all boot the same src/main.jsx SPA —
      // only the manifest/title baked into each differs, so a restaurant/admin install picks up
      // its own app identity from the page it was actually served, not the customer's.
      input: {
        main: resolve(__dirname, 'index.html'),
        admin: resolve(__dirname, 'admin.html'),
        superadmin: resolve(__dirname, 'superadmin.html'),
      },
    },
  },
  server: {
    host: true,
    proxy: {
      '/api': { target: 'http://localhost:5000', changeOrigin: true },
      '/uploads': { target: 'http://localhost:5000', changeOrigin: true },
      '/socket.io': { target: 'http://localhost:5000', ws: true }
    }
  }
})
