// ─────────────────────────────────────────────────────────────
//  Demo network.
//  Everything the panels show about *other* miners, fees, payouts and burns is simulated here,
//  so the site runs with zero backend. Your own mining (src/miner) is real work and is folded
//  into each window exactly like a server would do it.
//  TODO(backend): replace this module with the real stream (same NetState shape).
// ─────────────────────────────────────────────────────────────
import { ECON } from '../config/brand'
import { bus } from '../lib/bus'
import { randomB58 } from '../lib/base58'
import { createStore } from '../lib/store'
import { LAMPORTS, hashesShort, shortAddr, sol, utc } from '../lib/format'
import { safeStorage } from '../lib/hooks'

export type Shape = 'local' | 'pending' | 'server' | 'chain' | 'error' | 'warn' | 'info'

export interface Receipt { sig: string; at: number; lamports: number }
export interface Payout { sig: string; at: number; lamports: number; wallets: number; round: number }
export interface Burn { sig: string; at: number; lamports: number; tokens: number }
export interface Share { wallet: string; work: number; lamports: number; capBps: number; paidBy: string | null; you?: boolean }
export interface Round {
  round: number
  opensAt: number
  closesAt: number
  poolLamports: number
  funding: boolean
  miners: number
  work: number
  credited: number
  shares: Share[]
  feeSigs: string[]
  finalizedAt: number | null
}
export interface KV { k: string; v: string; sigs?: string[] }
export interface LedgerRec {
  id: string
  kind: 'claim' | 'payout' | 'settle' | 'burn' | 'proof' | 'reject'
  at: number
  title: string
  meta: string
  amount: string
  tone?: 'chain' | 'dim'
  shape: Shape
  kv: KV[]
  tab?: boolean
}
export interface RosterMiner { wallet: string; hps: number; units: number; day: number; all: number; pending: number; active: boolean }
export interface YouRound { round: number; at: number; work: number; shareBps: number; capBps: number; lamports: number }
export interface You { wallet: string; pending: number; paid: number; lifetime: number; workNow: number; capBps: number; rounds: YouRound[] }

export interface NetState {
  live: { poolPerMin: number; miners: number; workPerSec: number; proofsPerMin: number }
  current: Round
  rounds: Round[]
  receipts: Receipt[]
  payouts: Payout[]
  burns: Burn[]
  ledger: LedgerRec[]
  roster: RosterMiner[]
  totals: { feesIn: number; paidOut: number; boughtBack: number; burnedTokens: number; infra: number }
  rewardWallet: number
  owed: number
  slot: number
  token: { holdUnit: number; priceUsd: number; mcapUsd: number; holders: number; supply: number }
  you: You | null
  startedAt: number
}

const WIN = ECON.windowSec * 1000
const EPOCH = Date.UTC(2026, 9, 16, 0, 0, 0) // window #0
const roundAt = (t: number) => Math.floor((t - EPOCH) / WIN)
const opensOf = (r: number) => EPOCH + r * WIN
const rand = (a: number, b: number) => a + Math.random() * (b - a)
const sig = () => randomB58(64)
const wal = () => randomB58(32)

function makeRoster(): RosterMiner[] {
  // log-spread hash rates: a few GPU rigs at the top, a long tail of laptops
  const rates = [2.4e9, 1.9e9, 1.4e9, 9.2e8, 6.1e8, 3.8e8, 2.3e8, 1.6e8, 9e7, 6.4e7, 4.1e7, 2.6e7, 1.8e7, 1.1e7, 7e6, 4.4e6, 2.9e6, 1.7e6]
  return rates.map((hps, i) => ({
    wallet: wal(),
    hps: hps * rand(0.85, 1.15),
    units: i < 4 ? 5 : i < 9 ? Math.ceil(rand(1, 5)) : 1,
    day: 0,
    all: 0,
    pending: rand(0, 0.006) * LAMPORTS,
    active: Math.random() < 0.8,
  }))
}

/** Split a pool by work with per-wallet caps; excess goes to uncapped wallets by work. */
function splitPool(pool: number, entries: { work: number; capBps: number }[]): number[] {
  const out = entries.map(() => 0)
  let left = pool
  let open = entries.map((_, i) => i).filter((i) => entries[i].work > 0)
  for (let guard = 0; guard < 6 && open.length && left > 1; guard++) {
    const totalWork = open.reduce((s, i) => s + entries[i].work, 0)
    let capped = false
    const next: number[] = []
    let spent = 0
    for (const i of open) {
      const want = (left * entries[i].work) / totalWork
      const cap = (pool * entries[i].capBps) / 10000 - out[i]
      if (want >= cap) {
        out[i] += Math.max(0, cap)
        spent += Math.max(0, cap)
        capped = true
      } else next.push(i)
    }
    if (!capped) {
      for (const i of open) out[i] += (left * entries[i].work) / totalWork
      left = 0
      break
    }
    left -= spent
    open = next
  }
  return out.map((x) => Math.floor(x))
}

function capOf(units: number) {
  return Math.min(ECON.walletCapBps, units * ECON.capPerUnitBps)
}

function poolFor(receipts: Receipt[], at: number): number {
  const hour = receipts.filter((r) => at - r.at < 3_600_000)
  const minerSum = hour.reduce((s, r) => s + (r.lamports * ECON.minerShareBps) / 10000, 0)
  return Math.min(ECON.maxPoolLamports, Math.floor(minerSum / 60))
}

function newRound(r: number, receipts: Receipt[]): Round {
  const opensAt = opensOf(r)
  const pool = poolFor(receipts, opensAt)
  return {
    round: r,
    opensAt,
    closesAt: opensAt + WIN,
    poolLamports: pool,
    funding: pool < ECON.fundingFloorLamports,
    miners: 0,
    work: 0,
    credited: 0,
    shares: [],
    feeSigs: receipts.filter((x) => opensAt - x.at < 3_600_000).slice(0, 30).map((x) => x.sig),
    finalizedAt: null,
  }
}

// ── you (this tab) ──────────────────────────────────────────
const YOU_KEY = 'cubit:you:'
function loadYou(wallet: string): You {
  try {
    const raw = safeStorage.get(YOU_KEY + wallet)
    if (raw) {
      const v = JSON.parse(raw) as You
      return { ...v, workNow: 0 }
    }
  } catch {
    /* ignore */
  }
  return { wallet, pending: 0, paid: 0, lifetime: 0, workNow: 0, capBps: ECON.capPerUnitBps, rounds: [] }
}
function saveYou(y: You) {
  safeStorage.set(YOU_KEY + y.wallet, JSON.stringify({ ...y, workNow: 0, rounds: y.rounds.slice(0, 40) }))
}

// ── build the initial history ───────────────────────────────
function seed(): NetState {
  const now = Date.now()
  const roster = makeRoster()
  const receipts: Receipt[] = []
  // ~2 hours of creator-fee claims, every 50–110 s
  for (let t = now - 7_200_000; t < now - 20_000; t += rand(50_000, 110_000)) {
    receipts.unshift({ sig: sig(), at: t, lamports: Math.floor(rand(0.28, 1.15) * LAMPORTS) })
  }
  const st: NetState = {
    live: { poolPerMin: 0, miners: 0, workPerSec: 0, proofsPerMin: 0 },
    current: newRound(roundAt(now), receipts),
    rounds: [],
    receipts,
    payouts: [],
    burns: [],
    ledger: [],
    roster,
    totals: { feesIn: 0, paidOut: 0, boughtBack: 0, burnedTokens: 0, infra: 0 },
    rewardWallet: 0,
    owed: 0,
    slot: 459_000_000 + Math.floor((now - EPOCH) / 400),
    token: { holdUnit: ECON.holdUnitTokens, priceUsd: 0.0000641, mcapUsd: 64_100, holders: 541, supply: 1_000_000_000 },
    you: null,
    startedAt: now,
  }
  // totals that add up: miners' share in = paid out + still in the reward wallet
  const feesIn = 9.6 * LAMPORTS + receipts.reduce((s, r) => s + r.lamports, 0)
  st.totals.feesIn = feesIn
  st.totals.boughtBack = Math.floor(((feesIn * ECON.burnShareBps) / 10000) * 0.92)
  st.totals.burnedTokens = Math.floor((st.totals.boughtBack / LAMPORTS) * (st.token.supply / (st.token.mcapUsd / 180)))
  st.totals.infra = Math.floor((feesIn * (10000 - ECON.minerShareBps - ECON.burnShareBps)) / 10000)
  // last 20 settled windows
  const cur = roundAt(now)
  for (let r = cur - 20; r < cur; r++) {
    const round = newRound(r, receipts)
    simulateRound(st, round, WIN)
    finalize(st, round, false)
  }
  // balance the books after the seeded payouts: miners' share in = paid out + reward wallet
  st.rewardWallet = 4.2 * LAMPORTS
  st.totals.paidOut = Math.floor((feesIn * ECON.minerShareBps) / 10000 - st.rewardWallet)
  // ledger: claims within the last ~20 min
  for (const rc of receipts.filter((x) => now - x.at < 1_200_000).reverse()) pushClaim(st, rc)
  st.ledger.sort((a, b) => b.at - a.at)
  st.owed = owedOf(st)
  updateLive(st, now)
  return st
}

function simulateRound(st: NetState, round: Round, dtMs: number) {
  for (const m of st.roster) {
    if (Math.random() < 0.04) m.active = !m.active
  }
  const active = st.roster.filter((m) => m.active)
  round.miners = active.length
  round.work += active.reduce((s, m) => s + m.hps * rand(0.92, 1.08), 0) * (dtMs / 1000)
}

function finalize(st: NetState, round: Round, live: boolean) {
  const active = st.roster.filter((m) => m.active)
  const totalHps = active.reduce((s, m) => s + m.hps, 0) || 1
  const you = st.you
  const entries = active.map((m) => ({ work: (m.hps / totalHps) * round.work, capBps: capOf(m.units), m }))
  const youWork = you ? you.workNow : 0
  const all = [...entries.map((e) => ({ work: e.work, capBps: e.capBps })), ...(youWork > 0 && you ? [{ work: youWork, capBps: you.capBps }] : [])]
  const pool = round.funding ? 0 : round.poolLamports
  const paid = splitPool(pool, all)
  round.shares = entries.map((e, i) => ({ wallet: e.m.wallet, work: e.work, lamports: paid[i], capBps: e.capBps, paidBy: null }))
  entries.forEach((e, i) => {
    e.m.pending += paid[i]
    e.m.day += e.work
    e.m.all += e.work
  })
  if (you && youWork > 0) {
    const lam = paid[paid.length - 1]
    const totalWork = round.work + youWork
    round.shares.push({ wallet: you.wallet, work: youWork, lamports: lam, capBps: you.capBps, paidBy: null, you: true })
    round.work = totalWork
    round.miners += 1
    you.pending += lam
    you.lifetime += lam
    you.rounds.unshift({ round: round.round, at: round.closesAt, work: youWork, shareBps: Math.round((youWork / totalWork) * 10000), capBps: you.capBps, lamports: lam })
    you.workNow = 0
    saveYou(you)
  }
  round.shares.sort((a, b) => b.work - a.work)
  round.credited = paid.reduce((s, x) => s + x, 0)
  round.finalizedAt = round.closesAt + 3000
  st.rounds.unshift(round)
  st.rounds = st.rounds.slice(0, 40)
  if (live) {
    pushSettle(st, round)
    maybePayout(st, round)
    bus.emit({ type: 'settle', round: round.round })
  } else {
    pushSettle(st, round)
    if (Math.random() < 0.45) maybePayout(st, round, true)
  }
}

function maybePayout(st: NetState, round: Round, force = false) {
  const due = st.roster.filter((m) => m.pending >= ECON.payoutThresholdLamports)
  if (!due.length || (!force && Math.random() < 0.35)) return
  const total = due.reduce((s, m) => s + m.pending, 0)
  const s = sig()
  const at = round.finalizedAt ?? Date.now()
  const p: Payout = { sig: s, at, lamports: total, wallets: due.length, round: round.round }
  for (const m of due) {
    const share = round.shares.find((x) => x.wallet === m.wallet)
    if (share) share.paidBy = s
    m.pending = 0
  }
  st.payouts.unshift(p)
  st.payouts = st.payouts.slice(0, 30)
  st.totals.paidOut += total
  st.rewardWallet -= total
  st.ledger.unshift({
    id: s,
    kind: 'payout',
    at,
    title: 'Payout',
    meta: `on chain · ${due.length} wallet${due.length === 1 ? '' : 's'}`,
    amount: `−${sol(total)} SOL`,
    tone: 'chain',
    shape: 'chain',
    kv: [
      { k: 'Wallets', v: String(due.length) },
      { k: 'Total', v: `${sol(total, 5)} SOL` },
      { k: 'Window', v: `#${round.round}` },
      { k: 'Signature', v: shortAddr(s), sigs: [s] },
    ],
  })
}

function pushClaim(st: NetState, rc: Receipt) {
  const miners = Math.floor((rc.lamports * ECON.minerShareBps) / 10000)
  const burn = Math.floor((rc.lamports * ECON.burnShareBps) / 10000)
  st.ledger.unshift({
    id: rc.sig,
    kind: 'claim',
    at: rc.at,
    title: 'Fee claim',
    meta: 'on chain · creator fees',
    amount: `+${sol(rc.lamports)} SOL`,
    tone: 'chain',
    shape: 'chain',
    kv: [
      { k: 'Claimed', v: `${sol(rc.lamports, 5)} SOL` },
      { k: 'To miners', v: `${sol(miners, 5)} SOL` },
      { k: 'To burn', v: `${sol(burn, 5)} SOL` },
      { k: 'To infra', v: `${sol(rc.lamports - miners - burn, 5)} SOL` },
      { k: 'Signature', v: shortAddr(rc.sig), sigs: [rc.sig] },
    ],
  })
}

function pushSettle(st: NetState, round: Round) {
  const top = round.shares.slice(0, 8)
  st.ledger.unshift({
    id: `w${round.round}`,
    kind: 'settle',
    at: round.finalizedAt ?? round.closesAt,
    title: `Window #${round.round} settled`,
    meta: `server · ${round.miners} miners`,
    amount: round.funding ? 'funding' : `+${sol(round.credited)} SOL`,
    shape: 'server',
    kv: [
      { k: 'Pool', v: round.funding ? 'funding window' : `${sol(round.poolLamports, 5)} SOL` },
      { k: 'Credited', v: `${sol(round.credited, 5)} SOL` },
      { k: 'Open', v: `${utc(round.opensAt)} to ${utc(round.closesAt)} UTC` },
      { k: 'Work', v: `${hashesShort(round.work)} hashes` },
      { k: 'Fee claims measured', v: `${round.feeSigs.length}`, sigs: round.feeSigs.slice(0, 12) },
      ...top.map((s, i) => ({
        k: i === 0 ? 'Shares' : '',
        v: `${s.you ? 'you · ' : ''}${shortAddr(s.wallet)} · ${hashesShort(s.work)} hashes · ${sol(s.lamports, 5)} SOL · cap ${s.capBps / 100}%`,
      })),
      ...(round.shares.length > 8 ? [{ k: '', v: `and ${round.shares.length - 8} more wallets` }] : []),
    ],
  })
  st.ledger = st.ledger.slice(0, 120)
}

function owedOf(st: NetState) {
  return st.current.poolLamports + st.roster.reduce((s, m) => s + m.pending, 0) + (st.you?.pending ?? 0)
}

function updateLive(st: NetState, now: number) {
  const active = st.roster.filter((m) => m.active)
  const youHps = minerHps()
  st.live.miners = active.length + (youHps > 0 ? 1 : 0)
  st.live.workPerSec = active.reduce((s, m) => s + m.hps, 0) * rand(0.97, 1.03) + youHps
  st.live.poolPerMin = st.current.funding ? 0 : st.current.poolLamports
  st.live.proofsPerMin = Math.round(active.length * rand(32, 40) + (youHps > 0 ? 24 : 0))
  st.slot = 459_000_000 + Math.floor((now - EPOCH) / 400)
}

/** What this tab would get if the window closed now (same split rules as settlement). */
export function estimateYou(st: NetState): number {
  const you = st.you
  const cur = st.current
  if (!you || you.workNow <= 0 || cur.funding) return 0
  const active = st.roster.filter((m) => m.active)
  const totalHps = active.reduce((s, m) => s + m.hps, 0) || 1
  const entries = active.map((m) => ({ work: (m.hps / totalHps) * cur.work, capBps: capOf(m.units) }))
  entries.push({ work: you.workNow, capBps: you.capBps })
  const paid = splitPool(cur.poolLamports, entries)
  return paid[paid.length - 1]
}

// The miner registers a getter so the sim can include this tab's live hash rate.
let minerHps: () => number = () => 0
export function registerMinerRate(fn: () => number) {
  minerHps = fn
}

// ── live store ──────────────────────────────────────────────
export const net = createStore<NetState>(seed())
let ticking = false

export function startNetwork() {
  if (ticking) return
  ticking = true
  let last = Date.now()
  let nextFee = Date.now() + rand(12_000, 40_000)
  setInterval(() => {
    const now = Date.now()
    const dt = now - last
    last = now
    const st = { ...net.get() }
    let cur = { ...st.current }
    // work accrues continuously
    const active = st.roster.filter((m) => m.active)
    cur.work += active.reduce((s, m) => s + m.hps, 0) * (dt / 1000)
    cur.miners = active.length
    // window close
    if (now >= cur.closesAt) {
      finalize(st, cur, true)
      simulateRound(st, cur, 0)
      cur = newRound(roundAt(now), st.receipts)
    }
    // creator fees land
    if (now >= nextFee) {
      const rc: Receipt = { sig: sig(), at: now, lamports: Math.floor(rand(0.28, 1.15) * LAMPORTS) }
      st.receipts = [rc, ...st.receipts].slice(0, 120)
      st.totals = { ...st.totals, feesIn: st.totals.feesIn + rc.lamports }
      st.rewardWallet += Math.floor((rc.lamports * ECON.minerShareBps) / 10000)
      st.totals.infra += Math.floor((rc.lamports * (10000 - ECON.minerShareBps - ECON.burnShareBps)) / 10000)
      pushClaim(st, rc)
      bus.emit({ type: 'fee', lamports: rc.lamports })
      nextFee = now + rand(50_000, 110_000)
      // every few claims, buy back and burn
      if (Math.random() < 0.3) {
        const lam = Math.floor((rc.lamports * ECON.burnShareBps) / 10000 * rand(2, 4))
        const tokens = Math.floor((lam / LAMPORTS) * (st.token.supply / (st.token.mcapUsd / 180)))
        const b: Burn = { sig: sig(), at: now + 1500, lamports: lam, tokens }
        st.burns = [b, ...st.burns].slice(0, 30)
        st.totals.boughtBack += lam
        st.totals.burnedTokens += tokens
        st.ledger.unshift({
          id: b.sig,
          kind: 'burn',
          at: b.at,
          title: 'Buyback and burn',
          meta: 'on chain · burn share',
          amount: `${tokens.toLocaleString('en-US')} burned`,
          tone: 'chain',
          shape: 'chain',
          kv: [
            { k: 'Spent', v: `${sol(lam, 5)} SOL` },
            { k: 'Burned', v: `${tokens.toLocaleString('en-US')} tokens` },
            { k: 'Signature', v: shortAddr(b.sig), sigs: [b.sig] },
          ],
        })
      }
    }
    // token drifts a little
    if (Math.random() < 0.08) {
      const m = st.token.mcapUsd * rand(0.995, 1.006)
      st.token = { ...st.token, mcapUsd: m, priceUsd: m / st.token.supply, holders: st.token.holders + (Math.random() < 0.3 ? 1 : 0) }
    }
    st.current = cur
    st.owed = owedOf(st)
    updateLive(st, now)
    st.ledger = [...st.ledger].sort((a, b) => b.at - a.at)
    net.set(st)
  }, 1000)
}

// ── this tab's wallet + proofs ──────────────────────────────
export function setYou(wallet: string | null) {
  const st = { ...net.get() }
  st.you = wallet ? loadYou(wallet) : null
  net.set(st)
}

export function setYouCap(capBps: number) {
  const st = net.get()
  if (!st.you || st.you.capBps === capBps) return
  net.set({ ...st, you: { ...st.you, capBps } })
}

export function creditYou(work: number) {
  const st = net.get()
  if (!st.you) return
  net.set({ ...st, you: { ...st.you, workNow: st.you.workNow + work } })
}

export function pushTabRecord(rec: Omit<LedgerRec, 'id'>) {
  const st = net.get()
  net.set({ ...st, ledger: [{ ...rec, id: `t${Math.random().toString(36).slice(2)}` }, ...st.ledger].slice(0, 160) })
}
