// ─────────────────────────────────────────────────────────────
//  Everything that makes this site "cubit" lives here.
//  Rebrand = change this file + src/styles/tokens.css + public/assets/brand.
// ─────────────────────────────────────────────────────────────

export const BRAND = {
  name: 'cubit',
  wordmark: 'cubit',
  ticker: '$CUBIT',
  symbol: 'CUBIT',
  decimals: 6,
  tagline: 'Hold $CUBIT. Mine from a browser tab. Get paid in SOL.',
  headline: ['Mine from a browser tab.', 'Get paid in SOL.'],
  description:
    'Proof-of-work in your browser, paid only from pump.fun creator fees already collected. Hold $CUBIT to mine; every proof is re-checked.',
  xHandle: 'usecubit', // TODO(brand): set your real X handle
  /** Token mint (CA). Empty hides the CA chip and mint links. */
  mint: '8zotsdhpt6U8SRrXiGC7XDMkxhgRUKx4Q1mMn4acpump' as string,
  /** Wallets shown on the Vault page. Empty = "set at launch". */
  wallets: {
    reward: '' as string,
    burn: '' as string,
    infra: '' as string,
  },
  /**
   * Solana RPC for read-only calls (token balance check). Public RPCs refuse browser requests, so the
   * default is our own proxy: api/rpc.js on Vercel, and a Vite proxy in dev. VITE_SOLANA_RPC can point
   * straight at a browser-enabled RPC (e.g. a Helius URL with key) instead.
   */
  rpc: (import.meta.env.VITE_SOLANA_RPC as string | undefined) || '/api/rpc',
  explorer: 'https://solscan.io',
} as const

/** Protocol economics. Shown on Mine, Vault and Protocol; also drives the demo network. */
export const ECON = {
  windowSec: 60,
  minerShareBps: 7500, // 75% of each fee claim pays miners
  burnShareBps: 1500, // 15% buys back and burns the token
  // the rest (10%) runs infrastructure
  capPerUnitBps: 200, // each hold unit adds 2% to a wallet's cap per window
  walletCapBps: 1000, // a wallet never takes more than 10% of a window's pool
  holdUnitTokens: 400_000, // tokens in one hold unit (halves as price rises)
  holdUnitBandSol: [0.5, 1] as [number, number],
  payoutThresholdLamports: 10_000_000, // 0.01 SOL
  maxPoolLamports: 1_000_000_000, // 1 SOL per window, at most
  fundingFloorLamports: 1_000_000, // under 0.001 SOL a window is a funding window
} as const

/**
 * DEMO = the network panels (fees, payouts, leaderboard, ledger) are simulated in the browser.
 * Your own mining is real SHA-256 work in this tab. Flip to false once the backend stream is wired.
 * TODO(backend): replace src/sim/network.ts with the real stream.
 */
export const DEMO = (import.meta.env.VITE_DEMO as string | undefined) !== 'false'

export const X_URL = `https://x.com/${BRAND.xHandle}`
