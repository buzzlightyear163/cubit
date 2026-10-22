/// <reference lib="webworker" />
// One mining thread. Searches nonces for a ticket and reports proofs + hash counts.
import { hashNonce, leadingZeroBits, midstate, selfTest, wordsToHex } from './sha256'

type Ticket = { id: string; challenge: Uint8Array; wallet: Uint8Array; difficulty: number; nonceHi: number }
type InMsg = { type: 'ticket'; ticket: Ticket } | { type: 'pause' } | { type: 'resume' }

const ctx = self as unknown as DedicatedWorkerGlobalScope

let ticket: Ticket | null = null
let mid: Int32Array | null = null
let lo = 0
let running = false
let hashes = 0
let lastReport = performance.now()
let best = { bits: -1, hex: '' }
const samples: { hex: string; bits: number }[] = []
const out = new Int32Array(8)
const CHUNK = 40_000

function loop() {
  if (!running || !ticket || !mid) return
  const t = ticket
  const d = t.difficulty
  let localBestBits = -1
  let localBestHex = ''
  for (let i = 0; i < CHUNK; i++) {
    hashNonce(mid, t.nonceHi, lo, out)
    const w0 = out[0]
    // Quick reject: anything with a set bit in the top 8 cannot beat 8 bits.
    if ((w0 >>> 24) === 0 || i === 0) {
      const bits = leadingZeroBits(out)
      if (bits > localBestBits) {
        localBestBits = bits
        localBestHex = wordsToHex(out, 2)
      }
      if (bits >= d) {
        ctx.postMessage({ type: 'proof', ticketId: t.id, nonceHi: t.nonceHi, nonceLo: lo >>> 0, bits, hash: wordsToHex(out) })
      }
    }
    lo = (lo + 1) | 0
  }
  hashes += CHUNK
  if (localBestBits >= 0) {
    samples.push({ hex: localBestHex, bits: localBestBits })
    if (localBestBits > best.bits) best = { bits: localBestBits, hex: localBestHex }
  }
  const now = performance.now()
  if (now - lastReport > 250) {
    ctx.postMessage({ type: 'tick', hashes, ms: now - lastReport, samples: samples.splice(0, samples.length).slice(-4) })
    hashes = 0
    lastReport = now
  }
  setTimeout(loop, 0)
}

ctx.onmessage = (e: MessageEvent<InMsg>) => {
  const m = e.data
  if (m.type === 'ticket') {
    ticket = m.ticket
    mid = midstate(m.ticket.challenge, m.ticket.wallet)
    lo = 0
    best = { bits: -1, hex: '' }
    if (!running) {
      running = true
      lastReport = performance.now()
      hashes = 0
      setTimeout(loop, 0)
    }
  } else if (m.type === 'pause') {
    running = false
  } else if (m.type === 'resume') {
    if (!running && ticket) {
      running = true
      lastReport = performance.now()
      setTimeout(loop, 0)
    }
  }
}

selfTest().then((ok) => ctx.postMessage({ type: 'ready', ok }))
