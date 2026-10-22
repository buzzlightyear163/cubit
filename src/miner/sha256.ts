// SHA-256 tuned for one fixed preimage shape:
//   preimage = challenge(32) ‖ wallet(32) ‖ nonce(8)  → 72 bytes → two 64-byte blocks
// Block 1 never changes for a ticket, so we compress it once (the "midstate").
// Every nonce then costs exactly one compression of block 2.

const K = new Int32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98,
  0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8,
  0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819,
  0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7,
  0xc67178f2,
])

const IV = new Int32Array([
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
])

const W = new Int32Array(64)

function compress(state: Int32Array, block: Int32Array, out: Int32Array) {
  for (let i = 0; i < 16; i++) W[i] = block[i]
  for (let i = 16; i < 64; i++) {
    const x = W[i - 15]
    const y = W[i - 2]
    const s0 = ((x >>> 7) | (x << 25)) ^ ((x >>> 18) | (x << 14)) ^ (x >>> 3)
    const s1 = ((y >>> 17) | (y << 15)) ^ ((y >>> 19) | (y << 13)) ^ (y >>> 10)
    W[i] = (W[i - 16] + s0 + W[i - 7] + s1) | 0
  }
  let a = state[0], b = state[1], c = state[2], d = state[3]
  let e = state[4], f = state[5], g = state[6], h = state[7]
  for (let i = 0; i < 64; i++) {
    const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7))
    const ch = (e & f) ^ (~e & g)
    const t1 = (h + S1 + ch + K[i] + W[i]) | 0
    const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10))
    const maj = (a & b) ^ (a & c) ^ (b & c)
    const t2 = (S0 + maj) | 0
    h = g; g = f; f = e
    e = (d + t1) | 0
    d = c; c = b; b = a
    a = (t1 + t2) | 0
  }
  out[0] = (state[0] + a) | 0
  out[1] = (state[1] + b) | 0
  out[2] = (state[2] + c) | 0
  out[3] = (state[3] + d) | 0
  out[4] = (state[4] + e) | 0
  out[5] = (state[5] + f) | 0
  out[6] = (state[6] + g) | 0
  out[7] = (state[7] + h) | 0
}

function bytesToWords(bytes: Uint8Array, offset: number, out: Int32Array, outOffset: number, n: number) {
  for (let i = 0; i < n; i++) {
    const p = offset + i * 4
    out[outOffset + i] = (bytes[p] << 24) | (bytes[p + 1] << 16) | (bytes[p + 2] << 8) | bytes[p + 3]
  }
}

/** Midstate after compressing challenge ‖ wallet. */
export function midstate(challenge: Uint8Array, wallet: Uint8Array): Int32Array {
  const block = new Int32Array(16)
  bytesToWords(challenge, 0, block, 0, 8)
  bytesToWords(wallet, 0, block, 8, 8)
  const out = new Int32Array(8)
  compress(IV, block, out)
  return out
}

const BLOCK2 = new Int32Array(16)
BLOCK2[2] = 0x80000000 | 0
BLOCK2[15] = 72 * 8

/** SHA-256 of the 72-byte preimage for nonce = hi ‖ lo (big-endian u32 pair). */
export function hashNonce(mid: Int32Array, hi: number, lo: number, out: Int32Array) {
  BLOCK2[0] = hi | 0
  BLOCK2[1] = lo | 0
  compress(mid, BLOCK2, out)
}

export function leadingZeroBits(h: Int32Array): number {
  let bits = 0
  for (let i = 0; i < 8; i++) {
    const w = h[i]
    if (w === 0) {
      bits += 32
      continue
    }
    return bits + Math.clz32(w)
  }
  return bits
}

export function wordsToHex(h: Int32Array, words = 8): string {
  let s = ''
  for (let i = 0; i < words; i++) s += (h[i] >>> 0).toString(16).padStart(8, '0')
  return s
}

/** Reference check using WebCrypto — used once at start to prove the fast path is correct. */
export async function selfTest(): Promise<boolean> {
  const challenge = new Uint8Array(32).map((_, i) => i * 7 + 1)
  const wallet = new Uint8Array(32).map((_, i) => 255 - i * 3)
  const hi = 0x01020304
  const lo = 0x0a0b0c0d
  const out = new Int32Array(8)
  hashNonce(midstate(challenge, wallet), hi, lo, out)
  const pre = new Uint8Array(72)
  pre.set(challenge, 0)
  pre.set(wallet, 32)
  new DataView(pre.buffer).setUint32(64, hi)
  new DataView(pre.buffer).setUint32(68, lo)
  const ref = new Uint8Array(await crypto.subtle.digest('SHA-256', pre))
  const refHex = [...ref].map((b) => b.toString(16).padStart(2, '0')).join('')
  return refHex === wordsToHex(out)
}
