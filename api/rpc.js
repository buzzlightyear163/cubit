// Vercel serverless function: read-only Solana RPC proxy for the browser.
// Public RPC endpoints refuse requests that come straight from a web page, so the site calls /api/rpc
// and this forwards a small whitelist of read methods. Set SOLANA_RPC in Vercel to use your own endpoint.
const UPSTREAM = process.env.SOLANA_RPC || 'https://api.mainnet-beta.solana.com'
const ALLOWED = new Set(['getTokenAccountsByOwner', 'getTokenSupply', 'getAccountInfo', 'getBalance', 'getSlot'])

export default async function handler(req, res) {
  res.setHeader('cache-control', 'no-store')
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'POST only' })
    return
  }
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
  const calls = Array.isArray(body) ? body : [body]
  if (!calls.length || calls.length > 5 || calls.some((c) => !ALLOWED.has(c && c.method))) {
    res.status(400).json({ error: 'method not allowed' })
    return
  }
  try {
    const up = await fetch(UPSTREAM, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    const text = await up.text()
    res.status(up.status).setHeader('content-type', 'application/json').send(text)
  } catch {
    res.status(502).json({ error: 'upstream unreachable' })
  }
}
