import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // same origin in dev so no CORS setup needed on the browser side
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
})
