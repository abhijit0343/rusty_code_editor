import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    // Proxy API calls to the Flask backend during development so we avoid
    // CORS issues when the dev server rewrites the origin.
    proxy: {
      '/run':    { target: 'http://localhost:5000', changeOrigin: true },
      '/save':   { target: 'http://localhost:5000', changeOrigin: true },
      '/health': { target: 'http://localhost:5000', changeOrigin: true },
    },
  },
})
