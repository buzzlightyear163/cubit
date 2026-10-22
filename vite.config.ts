import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Vite + React. Workers are bundled as ES modules so the miner can import its SHA-256 core.
export default defineConfig({
  plugins: [react()],
  worker: { format: 'es' },
  server: { port: 5173, host: true },
  preview: { port: 4173, host: true },
})
