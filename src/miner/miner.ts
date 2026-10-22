// ─────────────────────────────────────────────────────────────
//  Miner manager: real SHA-256 proof-of-work in Web Workers.
//  Tickets and proof checks run locally ("server stub") so the full loop works offline:
//    challenge → hash → verify (WebCrypto recompute) → credit work into the window.
//  TODO(backend): fetch tickets from the server and POST proofs instead of verifyLocal().
// ─────────────────────────────────────────────────────────────
import { ECON } from '../config/brand'
import { b58decode } from '../lib/base58'
import { bus } from '../lib/bus'
import { createStore } from '../lib/store'
import { safeStorage } from '../lib/hooks'
import { utc } from '../lib/format'
import { creditYou, net, pushTabRecord, registerMinerRate } from '../sim/network'

export type Device = 'cpu' | 'gpu'
export type Load = 0.25 | 0.5 | 0.75 | 1

export interface Ticket { id: string; challenge: Uint8Array; difficulty: number; issuedAt: number; expiresAt: number; round: number; proofs: number }
export interface LogLine { time: string; text: string; tone?: 'bad' | 'ok' }
export interface MinerSnap {
  status: 'idle' | 'starting' | 'running' | 'error'
  on: boolean
  device: Device
  load: Load
  threads: number
  hashRate: number
  sessionHashes: number
  ticket: Ticket | null
  accepted: number
  rejected: number
  acceptedTotal: number
  windowWork: number
  sample: { hex: string; bits: number }[] | null
  log: LogLine[]
  selfTest: boolean | null
  error: string | null
}

const LOAD_KEY = 'cubit:load'
const PROOFS_PER_TICKET = 24
const TARGET_PROOF_SEC = 2.5

const initialLoad = (Number(safeStorage.get(LOAD_KEY)) || 0.5) as Load

export const miner = createStore<MinerSnap>({
  status: 'idle',
  on: false,
  device: 'cpu',
  load: initialLoad,
  threads: 0,
  hashRate: 0,
  sessionHashes: 0,
  ticket: null,
  accepted: 0,
  rejected: 0,
  acceptedTotal: 0,
  windowWork: 0,
  sample: null,
  log: [],
  selfTest: null,
  error: null,
})

let workers: Worker[] = []
let wallet: Uint8Array | null = null
let walletStr: string | null = null
let rateWindow: { t: number; n: number }[] = []
const seen = new Set<string>()
let lastRound = -1
let calibrated = false
let startedAt = 0

registerMinerRate(() => (miner.get().on ? miner.get().hashRate : 0))

const cores = () => Math.max(1, Math.min(16, navigator.hardwareConcurrency || 4))
const threadsFor = (load: Load) => Math.max(1, Math.round(cores() * load * (load === 1 ? 1 : 0.9)))

function log(text: string, tone?: LogLine['tone']) {
  miner.set((s) => ({ ...s, log: [...s.log, { time: utc(Date.now()), text, tone }].slice(-30) }))
}

function hexId(b: Uint8Array) {
  return [...b.slice(0, 2)].map((x) => x.toString(16).padStart(2, '0')).join('')
}

function difficultyFor(hps: number) {
  if (!hps) return 20
  return Math.max(14, Math.min(40, Math.round(Math.log2(hps * TARGET_PROOF_SEC))))
}

function issueTicket(): Ticket {
  const st = net.get()
  const challenge = new Uint8Array(32)
  crypto.getRandomValues(challenge)
  const t: Ticket = {
    id: hexId(challenge),
    challenge,
    difficulty: difficultyFor(miner.get().hashRate),
    issuedAt: Date.now(),
    expiresAt: st.current.closesAt,
    round: st.current.round,
    proofs: 0,
  }
  miner.set((s) => ({ ...s, ticket: t }))
  log(`ticket ${t.id} · target ${t.difficulty} bits`)
  workers.forEach((w, i) =>
    w.postMessage({ type: 'ticket', ticket: { id: t.id, challenge, wallet, difficulty: t.difficulty, nonceHi: (i << 24) ^ (Math.random() * 0xffffff) } }),
  )
  return t
}

async function verifyLocal(t: Ticket, nonceHi: number, nonceLo: number, claimedHash: string): Promise<{ ok: boolean; reason?: string; bits: number }> {
  // Recompute independently with WebCrypto, exactly like the server would.
  const pre = new Uint8Array(72)
  pre.set(t.challenge, 0)
  pre.set(wallet!, 32)
  const dv = new DataView(pre.buffer)
  dv.setUint32(64, nonceHi >>> 0)
  dv.setUint32(68, nonceLo >>> 0)
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', pre))
  const hex = [...h].map((b) => b.toString(16).padStart(2, '0')).join('')
  let bits = 0
  for (const b of h) {
    if (b === 0) {
      bits += 8
      continue
    }
    bits += Math.clz32(b) - 24
    break
  }
  const key = `${t.id}:${nonceHi}:${nonceLo}`
  if (seen.has(key)) return { ok: false, reason: 'duplicate', bits }
  seen.add(key)
  if (hex !== claimedHash) return { ok: false, reason: 'hash mismatch', bits }
  if (Date.now() > t.expiresAt + 2000) return { ok: false, reason: 'window closed', bits }
  if (bits < t.difficulty) return { ok: false, reason: 'below target', bits }
  return { ok: true, bits }
}

function onWorkerMessage(e: MessageEvent) {
  const m = e.data
  const s = miner.get()
  if (m.type === 'ready') {
    if (s.selfTest === null) miner.set((x) => ({ ...x, selfTest: !!m.ok }))
    if (!m.ok) log('self-test failed: SHA-256 mismatch', 'bad')
    return
  }
  if (m.type === 'tick') {
    const now = performance.now()
    rateWindow.push({ t: now, n: m.hashes })
    rateWindow = rateWindow.filter((x) => now - x.t < 2500)
    const span = Math.max(500, Math.min(2500, now - (rateWindow[0]?.t ?? now) + 250))
    const rate = (rateWindow.reduce((a, x) => a + x.n, 0) / span) * 1000
    const sample = (m.samples as { hex: string; bits: number }[]) ?? []
    // first real measurement: retune the ticket so proofs land every ~2.5 s
    const tk = miner.get().ticket
    if (!calibrated && tk && performance.now() - startedAt > 1500 && rate > 0) {
      calibrated = true
      if (Math.abs(difficultyFor(rate) - tk.difficulty) >= 1) queueMicrotask(() => issueTicket())
    }
    miner.set((x) => ({
      ...x,
      status: 'running',
      hashRate: rate,
      sessionHashes: x.sessionHashes + m.hashes,
      sample: sample.length ? sample : x.sample,
    }))
    return
  }
  if (m.type === 'proof') {
    const t = s.ticket
    if (!t || m.ticketId !== t.id) {
      reject('expired')
      return
    }
    bus.emit({ type: 'proof', ok: true })
    verifyLocal(t, m.nonceHi, m.nonceLo, m.hash).then((r) => {
      if (r.ok) {
        const work = 2 ** t.difficulty
        creditYou(work)
        t.proofs++
        miner.set((x) => ({ ...x, accepted: x.accepted + 1, acceptedTotal: x.acceptedTotal + 1, windowWork: x.windowWork + work }))
        setTimeout(() => bus.emit({ type: 'merge' }), 1100)
        log(`proof credited · ${r.bits} bits`, 'ok')
        pushTabRecord({ kind: 'proof', at: Date.now(), title: 'Proof credited', meta: `this tab · ${r.bits} bits · ticket ${t.id}`, amount: `${(work / 1e6).toFixed(2)} M`, shape: 'local', kv: [{ k: 'Ticket', v: t.id }, { k: 'Bits', v: String(r.bits) }, { k: 'Credit', v: `2^${t.difficulty} hashes` }], tab: true })
        if (t.proofs >= PROOFS_PER_TICKET) {
          log('challenge full · asking for a harder one')
          issueTicket()
        }
      } else reject(r.reason ?? 'malformed')
    })
  }
}

function reject(reason: string) {
  miner.set((x) => ({ ...x, rejected: x.rejected + 1 }))
  setTimeout(() => bus.emit({ type: 'reject' }), 1100)
  log(`rejected · ${reason}`, 'bad')
  pushTabRecord({ kind: 'reject', at: Date.now(), title: 'Proof rejected', meta: `this tab · ${reason}`, amount: 'no credit', shape: 'error', kv: [{ k: 'Reason', v: reason }], tab: true })
}

function spawn(n: number) {
  for (let i = 0; i < n; i++) {
    const w = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
    w.onmessage = onWorkerMessage
    w.onerror = () => {
      miner.set((s) => ({ ...s, status: 'error', error: 'A mining thread crashed.' }))
    }
    workers.push(w)
  }
}

function killAll() {
  workers.forEach((w) => w.terminate())
  workers = []
}

// window rollover: reset per-window counters, new ticket
net.subscribe(() => {
  const r = net.get().current.round
  if (r !== lastRound) {
    const was = lastRound
    lastRound = r
    if (was !== -1 && miner.get().on) {
      miner.set((s) => ({ ...s, accepted: 0, rejected: 0, windowWork: 0 }))
      log(`window #${was} closed`)
      issueTicket()
    }
  }
})

export function setWallet(addr: string | null) {
  walletStr = addr
  wallet = addr ? b58decode(addr) : null
  if (!addr && miner.get().on) stop()
}

export function start() {
  if (!wallet || !walletStr) return
  const s = miner.get()
  if (s.on) return
  const n = threadsFor(s.load)
  spawn(n)
  calibrated = false
  startedAt = performance.now()
  miner.set((x) => ({ ...x, on: true, status: 'starting', threads: n, error: null }))
  log(`started · ${n} thread${n === 1 ? '' : 's'} on CPU`)
  issueTicket()
}

export function stop() {
  killAll()
  rateWindow = []
  miner.set((x) => ({ ...x, on: false, status: 'idle', hashRate: 0, threads: 0 }))
  log('stopped')
}

export function setLoad(load: Load) {
  safeStorage.set(LOAD_KEY, String(load))
  const s = miner.get()
  miner.set((x) => ({ ...x, load }))
  if (s.on) {
    killAll()
    rateWindow = []
    const n = threadsFor(load)
    spawn(n)
    calibrated = false
    startedAt = performance.now()
    miner.set((x) => ({ ...x, threads: n }))
    log(`load ${Math.round(load * 100)}% · ${n} thread${n === 1 ? '' : 's'}`)
    issueTicket()
  }
}

export function windowsLeftMs() {
  return Math.max(0, net.get().current.closesAt - Date.now())
}

export const MINER_INFO = { cores, threadsFor, PROOFS_PER_TICKET, windowSec: ECON.windowSec }
