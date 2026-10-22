import { defineConfig, type ProxyOptions } from 'vite'
import react from '@vitejs/plugin-react'

// /api/rpc → Solana mainnet, without the browser's Origin header (public RPC refuses browser origins).
// In production the same path is served by api/rpc.js on Vercel.
const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {}
type ProxyEvents = { on: (ev: 'proxyReq', fn: (req: { removeHeader(h: string): void }) => void) => void }

const rpcProxy: Record<string, ProxyOptions> = {
  '/api/rpc': {
    target: env.SOLANA_RPC || 'https://api.mainnet-beta.solana.com',
    changeOrigin: true,
    rewrite: () => '',
    configure: (proxy) => {
      ;(proxy as unknown as ProxyEvents).on('proxyReq', (req) => {
        req.removeHeader('origin')
        req.removeHeader('referer')
      })
    },
  },
}

export default defineConfig({
  plugins: [react()],
  worker: { format: 'es' },
  server: { port: 5173, host: true, proxy: rpcProxy },
  preview: { port: 4173, host: true, proxy: rpcProxy },
})
