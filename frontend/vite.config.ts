import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The dev server proxies /api/* to the API gateway, which avoids CORS entirely.
// Override the target with: GATEWAY_URL=http://host:port npm run dev
const gateway = process.env.GATEWAY_URL ?? 'http://localhost:8080'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: gateway,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
