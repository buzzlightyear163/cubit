export const LAMPORTS = 1_000_000_000

export function sol(lamports: number, digits = 4): string {
  return (lamports / LAMPORTS).toFixed(digits)
}

export function signedSol(lamports: number, digits = 4): string {
  const s = sol(Math.abs(lamports), digits)
  return lamports < 0 ? `−${s}` : `+${s}`
}

export function count(n: number): string {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

export function bps(b: number): string {
  const p = b / 100
  return `${Number.isInteger(p) ? p : p.toFixed(1)}%`
}

export function shortAddr(a: string | null | undefined, head = 4, tail = 4): string {
  if (!a) return '–'
  if (a.length <= head + tail + 1) return a
  return `${a.slice(0, head)}…${a.slice(-tail)}`
}

const UNITS = ['', 'K', 'M', 'G', 'T', 'P']

/** 1.74 G hashes etc. */
export function hashesShort(n: number): string {
  if (n < 1000) return `${Math.round(n)}`
  let i = 0
  let v = n
  while (v >= 1000 && i < UNITS.length - 1) {
    v /= 1000
    i++
  }
  return `${v.toFixed(2)} ${UNITS[i]}`
}

/** Hash rate → value + unit, e.g. { v: '10.8', u: 'GH/s' } */
export function hashRate(hps: number): { v: string; u: string } {
  if (!hps || hps < 1) return { v: '0', u: 'H/s' }
  let i = 0
  let v = hps
  while (v >= 1000 && i < UNITS.length - 1) {
    v /= 1000
    i++
  }
  return { v: v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2), u: `${UNITS[i]}H/s` }
}

export function ago(at: number, now: number): string {
  const s = Math.max(0, Math.round((now - at) / 1000))
  if (s < 60) return `${s} s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m} min ago`
  const h = Math.floor(m / 60)
  return `${h} h ago`
}

export function utc(at: number): string {
  const d = new Date(at)
  return [d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()].map((x) => String(x).padStart(2, '0')).join(':')
}

export function clock(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export function clamp(v: number, a = 0, b = 1): number {
  return Math.max(a, Math.min(b, v))
}
