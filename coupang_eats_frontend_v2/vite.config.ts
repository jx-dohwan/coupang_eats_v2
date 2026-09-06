import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/auth': { target: 'http://localhost:3000', changeOrigin: true },
      '/users': { target: 'http://localhost:3000', changeOrigin: true },
      '/restaurants': { target: 'http://localhost:3000', changeOrigin: true },
      '/categories': { target: 'http://localhost:3000', changeOrigin: true },
      '/orders': { target: 'http://localhost:3000', changeOrigin: true },
      '/payments': { target: 'http://localhost:3000', changeOrigin: true },
      '/reviews': { target: 'http://localhost:3000', changeOrigin: true },
      '/uploads': { target: 'http://localhost:3000', changeOrigin: true },
      '/health': { target: 'http://localhost:3000', changeOrigin: true },
      '/dishes': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
})
