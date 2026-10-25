/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// In development, `npm run dev` serves the UI on :5173 and forwards API calls to the
// backend started with `vachi serve` (port 8000). In Docker, Nginx does this instead.
const backend = process.env.VACHI_BACKEND_URL ?? 'http://127.0.0.1:8000'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': backend,
      '/v1': backend,
    },
  },
  test: {
    environment: 'node',
  },
})
