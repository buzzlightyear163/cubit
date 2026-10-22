// Address-only wallet: we read the public key, never ask for a signature or a transaction.
import { useEffect, useState } from 'react'
import { BRAND, ECON } from '../config/brand'
import { isSolanaAddress } from '../lib/base58'
import { safeStorage } from '../lib/hooks'
import { createStore, useStore } from '../lib/store'
import { setWallet as minerSetWallet } from '../miner/miner'
import { setYou, setYouCap } from '../sim/network'

type Provider = {
  isPhantom?: boolean
  isSolflare?: boolean
  isBackpack?: boolean
  publicKey?: { toString(): string } | null
  connect: (opts?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey?: { toString(): string } } | void>
  disconnect?: () => Promise<void>
}
type Detected = { name: string; icon: string; provider: Provider }

export interface Holding {
  status: 'demo' | 'checking' | 'ok' | 'short' | 'unknown'
  balance: number | null
  units: number
  capBps: number
}

export interface WalletState {
  address: string | null
  via: string | null
  connecting: boolean
  error: string | null
  picker: boolean
  holding: Holding
}

const KEY = 'cubit:wallet'
const saved = safeStorage.get(KEY)
const savedAddr = saved && isSolanaAddress(saved.split('|')[0]) ? saved.split('|')[0] : null

const DEMO_HOLDING: Holding = { status: 'demo', balance: null, units: 1, capBps: ECON.capPerUnitBps }

export const walletStore = createStore<WalletState>({
  address: savedAddr,
  via: savedAddr ? saved!.split('|')[1] || 'address' : null,
  connecting: false,
  error: null,
  picker: false,
  holding: DEMO_HOLDING,
})

if (savedAddr) {
  minerSetWallet(savedAddr)
  setYou(savedAddr)
}

const icon = (letter: string, bg: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 18"><rect width="18" height="18" rx="4" fill="${bg}"/><text x="9" y="12.5" font-family="Arial" font-size="10" font-weight="700" text-anchor="middle" fill="#fff">${letter}</text></svg>`)}`

export function detectWallets(): Detected[] {
  const w = window as unknown as Record<string, any>
  const out: Detected[] = []
  if (w.phantom?.solana?.isPhantom) out.push({ name: 'Phantom', icon: icon('P', '#7b61d9'), provider: w.phantom.solana })
  if (w.solflare?.isSolflare) out.push({ name: 'Solflare', icon: icon('S', '#e6762e'), provider: w.solflare })
  if (w.backpack?.solana) out.push({ name: 'Backpack', icon: icon('B', '#d8433b'), provider: w.backpack.solana })
  if (!out.length && w.solana?.connect) out.push({ name: 'Solana wallet', icon: icon('◎', '#3b4450'), provider: w.solana })
  return out
}

function setAddress(addr: string | null, via: string | null) {
  safeStorage.set(KEY, addr ? `${addr}|${via ?? ''}` : null)
  walletStore.set((s) => ({ ...s, address: addr, via, connecting: false, error: null, picker: false, holding: DEMO_HOLDING }))
  minerSetWallet(addr)
  setYou(addr)
  if (addr) checkHolding(addr)
}

export async function connectWith(d: Detected) {
  walletStore.set((s) => ({ ...s, connecting: true, error: null }))
  try {
    const res = await d.provider.connect()
    const pk = (res && 'publicKey' in res && res.publicKey) || d.provider.publicKey
    const addr = pk?.toString() ?? null
    if (!addr || !isSolanaAddress(addr)) throw new Error('No address returned')
    setAddress(addr, d.name)
  } catch (e) {
    walletStore.set((s) => ({ ...s, connecting: false, error: (e as Error)?.message || 'Connection was cancelled' }))
  }
}

export function connectPasted(addr: string) {
  setAddress(addr.trim(), 'address')
}

export function openPicker() {
  const found = detectWallets()
  if (found.length === 1) {
    connectWith(found[0])
    return
  }
  walletStore.set((s) => ({ ...s, picker: true }))
}

export function closePicker() {
  walletStore.set((s) => ({ ...s, picker: false }))
}

export function disconnect() {
  const via = walletStore.get().via
  if (via && via !== 'address') {
    const d = detectWallets().find((x) => x.name === via)
    d?.provider.disconnect?.().catch(() => undefined)
  }
  setAddress(null, null)
}

/** Reads the wallet's token balance (read-only RPC) once the mint exists. */
async function checkHolding(addr: string) {
  if (!BRAND.mint) {
    walletStore.set((s) => ({ ...s, holding: DEMO_HOLDING }))
    setYouCap(DEMO_HOLDING.capBps)
    return
  }
  walletStore.set((s) => ({ ...s, holding: { ...s.holding, status: 'checking' } }))
  try {
    const res = await fetch(BRAND.rpc, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getTokenAccountsByOwner',
        params: [addr, { mint: BRAND.mint }, { encoding: 'jsonParsed' }],
      }),
    }).then((r) => r.json())
    const accounts = (res?.result?.value ?? []) as any[]
    const balance = accounts.reduce((s, a) => s + Number(a?.account?.data?.parsed?.info?.tokenAmount?.uiAmount ?? 0), 0)
    const units = Math.floor(balance / ECON.holdUnitTokens)
    const capBps = Math.min(ECON.walletCapBps, units * ECON.capPerUnitBps)
    walletStore.set((s) => ({ ...s, holding: { status: units >= 1 ? 'ok' : 'short', balance, units, capBps } }))
    setYouCap(capBps)
  } catch {
    walletStore.set((s) => ({ ...s, holding: { status: 'unknown', balance: null, units: 0, capBps: 0 } }))
  }
}
if (savedAddr) checkHolding(savedAddr)

export function useWallet() {
  return useStore(walletStore)
}

// ── picker modal ────────────────────────────────────────────
export function WalletPicker() {
  const w = useWallet()
  const [paste, setPaste] = useState('')
  const [problem, setProblem] = useState<string | null>(null)
  const found = w.picker ? detectWallets() : []

  useEffect(() => {
    if (!w.picker) return
    const k = (e: KeyboardEvent) => e.key === 'Escape' && closePicker()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [w.picker])

  if (!w.picker) return null
  const href = encodeURIComponent(window.location.href)
  const ref = encodeURIComponent(window.location.origin)

  const submit = () => {
    if (!isSolanaAddress(paste)) {
      setProblem('That is not a Solana address. It should be 32 to 44 base58 characters.')
      return
    }
    setProblem(null)
    connectPasted(paste)
    setPaste('')
  }

  return (
    <div className="wallet-picker" onClick={closePicker}>
      <div className="wallet-picker-card" role="dialog" aria-modal="true" aria-label="Connect a wallet" onClick={(e) => e.stopPropagation()}>
        <div className="wallet-picker-head">
          <b>Connect a wallet</b>
          <span className="dim">address only, no signature</span>
        </div>
        {found.length === 0 ? (
          <>
            <p className="wallet-picker-empty">No wallet in this browser. Open this page inside your wallet app, or paste the address you want paid.</p>
            <div className="wallet-picker-list">
              <a className="btn ghost" href={`https://phantom.app/ul/browse/${href}?ref=${ref}`}>Open in Phantom</a>
              <a className="btn ghost" href={`https://solflare.com/ul/v1/browse/${href}?ref=${ref}`}>Open in Solflare</a>
            </div>
          </>
        ) : (
          <div className="wallet-picker-list">
            {found.map((d) => (
              <button key={d.name} type="button" className="btn ghost" disabled={w.connecting} onClick={() => connectWith(d)}>
                <img src={d.icon} alt="" width={18} height={18} />
                {d.name}
              </button>
            ))}
          </div>
        )}
        {w.error ? <p className="wallet-paste-problem">{w.error}</p> : null}
        <div className="wallet-paste">
          <label htmlFor="wallet-paste">Or paste the address to be paid</label>
          <div className="wallet-paste-row">
            <input
              id="wallet-paste"
              value={paste}
              onChange={(e) => setPaste(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              placeholder="Solana address"
              spellCheck={false}
              autoComplete="off"
            />
            <button type="button" className="btn sm" onClick={submit}>Use</button>
          </div>
          {problem ? <p className="wallet-paste-problem">{problem}</p> : null}
        </div>
        <button type="button" className="btn sm ghost" onClick={closePicker}>Cancel</button>
      </div>
    </div>
  )
}
