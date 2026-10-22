// Live price and market cap for the real token (DexScreener, public, no key).
// Returns null until the first pair is indexed, so nothing simulated is shown for a live coin.
import { useEffect } from 'react'
import { BRAND } from '../config/brand'
import { createStore, useStore } from './store'

export interface Market { priceUsd: number; mcapUsd: number; source: string; url: string }

const market = createStore<Market | null>(null)
let started = false

async function load() {
  if (!BRAND.mint) return
  try {
    const res = await fetch(`https://api.dexscreener.com/token-pairs/v1/solana/${BRAND.mint}`)
    if (!res.ok) return
    const pairs = (await res.json()) as { priceUsd?: string; marketCap?: number; fdv?: number; liquidity?: { usd?: number }; url?: string; dexId?: string }[]
    if (!Array.isArray(pairs) || !pairs.length) return
    const best = pairs.slice().sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0]
    const priceUsd = Number(best.priceUsd)
    const mcapUsd = Number(best.marketCap ?? best.fdv ?? 0)
    if (!priceUsd || !mcapUsd) return
    market.set({ priceUsd, mcapUsd, source: `DexScreener (${best.dexId ?? 'pair'})`, url: best.url ?? '' })
  } catch {
    /* offline or blocked: keep the last value */
  }
}

export function useMarket(): Market | null {
  useEffect(() => {
    if (started || !BRAND.mint) return
    started = true
    load()
    setInterval(load, 30_000)
  }, [])
  return useStore(market)
}
