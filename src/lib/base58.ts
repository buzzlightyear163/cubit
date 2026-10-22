const ALPHA = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
const MAP = new Map([...ALPHA].map((c, i) => [c, i]))

/** Decode base58 → bytes, or null if invalid. */
export function b58decode(s: string): Uint8Array | null {
  if (!s) return null
  const bytes: number[] = [0]
  for (const ch of s) {
    const v = MAP.get(ch)
    if (v === undefined) return null
    let carry = v
    for (let j = 0; j < bytes.length; j++) {
      carry += bytes[j] * 58
      bytes[j] = carry & 0xff
      carry >>= 8
    }
    while (carry > 0) {
      bytes.push(carry & 0xff)
      carry >>= 8
    }
  }
  for (let k = 0; k < s.length && s[k] === '1'; k++) bytes.push(0)
  return new Uint8Array(bytes.reverse())
}

export function b58encode(buf: Uint8Array): string {
  const digits: number[] = [0]
  for (const byte of buf) {
    let carry = byte
    for (let j = 0; j < digits.length; j++) {
      carry += digits[j] << 8
      digits[j] = carry % 58
      carry = (carry / 58) | 0
    }
    while (carry > 0) {
      digits.push(carry % 58)
      carry = (carry / 58) | 0
    }
  }
  let out = ''
  for (let k = 0; k < buf.length && buf[k] === 0; k++) out += '1'
  for (let q = digits.length - 1; q >= 0; q--) out += ALPHA[digits[q]]
  return out
}

/** A Solana public key is 32 bytes of base58. */
export function isSolanaAddress(s: string): boolean {
  const t = s.trim()
  if (t.length < 32 || t.length > 44) return false
  const b = b58decode(t)
  return !!b && b.length === 32
}

/** Random 32-byte base58 string (demo signatures/wallets) — 64 bytes for signatures. */
export function randomB58(bytes = 32): string {
  const a = new Uint8Array(bytes)
  crypto.getRandomValues(a)
  return b58encode(a)
}
