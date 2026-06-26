import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const apiProxyTarget = process.env.API_PROXY_TARGET ?? 'http://localhost:4000'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: true,
    proxy: {
      '/api': {
        target: apiProxyTarget,
        changeOrigin: true,
      },
      '/graphql': {
        target: apiProxyTarget,
        changeOrigin: true,
      },
    },
  },
})
