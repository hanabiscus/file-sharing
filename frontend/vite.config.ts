import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'https://d10in0kelu18m1.cloudfront.net',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path
      }
    }
  }
})