import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The dev server proxies /api/* to the API gateway, which avoids CORS entirely.
// Override the target with: GATEWAY_URL=http://host:port npm run dev
const gateway = process.env.GATEWAY_URL ?? 'http://localhost:8080'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true, // fail loudly instead of silently moving to 5174
    host: '::',       // dual-stack: reachable via localhost, 127.0.0.1 and [::1]
    proxy: {
      // Regex key: must be '/api/' so it doesn't swallow the app's own '/api-keys' route.
      '^/api/': {
        target: gateway,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
