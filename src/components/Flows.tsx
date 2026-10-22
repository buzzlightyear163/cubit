// Dotted hex-glyph currents between the panels and the cube (desktop Mine only):
//   network panel → cube top   (work coming in)
//   cube core    → wallet dock (credit going out; a packet flies per credited proof)
import { useEffect, useRef } from 'react'
import { getCube } from '../cube/engine'
import { bus } from '../lib/bus'
import { miner } from '../miner/miner'
import { net } from '../sim/network'

const HEX = '0123456789abcdef'
const FONT = '"Geist Mono Variable", ui-monospace, monospace'
const sm = (e: number) => e * e * (3 - 2 * e)
const quad = (a: number[], c: number[], b: number[], t: number) => {
  const n = 1 - t
  return [n * n * a[0] + 2 * n * t * c[0] + t * t * b[0], n * n * a[1] + 2 * n * t * c[1] + t * t * b[1]]
}
function hash(a: number, b: number) {
  let i = (Math.imul(a | 0, 0x165667b1) + Math.imul(b | 0, 0x27d4eb2f)) | 0
  i = Math.imul(i ^ (i >>> 13), 0x4bf19f61)
  return ((i ^ (i >>> 16)) >>> 0) / 0x100000000
}
const rectCache = new Map<string, { r: DOMRect | null; at: number }>()
function rectOf(sel: string) {
  const now = performance.now()
  const c = rectCache.get(sel)
  if (c && now - c.at < 400) return c.r
  const el = document.querySelector(sel)
  const r = el ? el.getBoundingClientRect() : null
  rectCache.set(sel, { r, at: now })
  return r
}
function point(sel: string, side: 'left' | 'top'): [number, number] | null {
  const r = rectOf(sel)
  if (!r || !r.width || r.bottom < 0 || r.top > innerHeight) return null
  return side === 'left' ? [r.left - 6, r.top + r.height / 2] : [r.left + r.width / 2, r.top - 6]
}

export function Flows() {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const cv = ref.current
    const g = cv?.getContext('2d')
    if (!cv || !g) return
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
    let raf = 0
    let last = 0
    let dpr = 1
    let a = 0
    let b = 0
    let startedAt = 0
    let wasOn = false
    let packets: { t0: number; landed: boolean }[] = []
    const resize = () => {
      dpr = Math.min(2, devicePixelRatio || 1)
      cv.width = Math.round(innerWidth * dpr)
      cv.height = Math.round(innerHeight * dpr)
      rectCache.clear()
    }
    resize()
    addEventListener('resize', resize)
    const offBus = bus.on((e) => {
      if (e.type === 'merge') packets.push({ t0: performance.now() / 1000, landed: false })
    })
    const dotted = (p0: number[], p1: number[], bend: number, t: number, color: string, alpha: number, speed: number, seed: number, density: number, avoid: DOMRect | null) => {
      const c = [(p0[0] + p1[0]) / 2 + (p1[1] - p0[1]) * bend, (p0[1] + p1[1]) / 2 - (p1[0] - p0[0]) * bend]
      const n = Math.max(2, Math.floor((1.1 * Math.hypot(p1[0] - p0[0], p1[1] - p0[1])) / 10))
      const f = reduced ? 0 : t * speed
      const fi = Math.floor(f)
      const fr = f - fi
      g.fillStyle = color
      for (let i = 0; i <= n; i++) {
        const k = Math.min(1, (i + fr) / n)
        const p = quad(p0, c, p1, k)
        if (avoid && p[0] > avoid.left - 6 && p[0] < avoid.right + 6 && p[1] > avoid.top - 6 && p[1] < avoid.bottom + 6) continue
        const h = hash(seed, i - fi)
        const on = h < density
        g.globalAlpha = alpha * sm(Math.min(1, 4 * k, (1 - k) * 4)) * (on ? 0.7 : 0.12)
        g.fillText(on ? HEX[(h * 1e4) & 15] : '·', p[0], p[1])
      }
      return c
    }
    const frame = (ms: number) => {
      raf = requestAnimationFrame(frame)
      if (ms - last < 1000 / 30) return
      const dt = last ? Math.min(0.1, (ms - last) / 1000) : 0
      last = ms
      const t = ms / 1000
      g.setTransform(1, 0, 0, 1, 0, 0)
      g.clearRect(0, 0, cv.width, cv.height)
      if (innerWidth < 900 || document.hidden) return
      const m = miner.get()
      const hashing = m.on && m.status === 'running'
      const armed = !!net.get().you
      if (hashing && !wasOn) startedAt = t
      wasOn = hashing
      const ease = (d: number) => (reduced ? 1 : Math.min(1, Math.max(0, (t - startedAt - d) / 0.5)))
      const ppm = net.get().live.proofsPerMin
      const pulse = reduced ? 0.6 : 0.55 + 0.45 * Math.max(0, Math.sin(t * Math.PI * Math.min(2, Math.max(0.25, ppm / 30))))
      const ta = hashing ? ease(0.35) : armed ? 0.3 : 0.16 * pulse
      const tb = hashing ? ease(0.75) : armed ? 0.22 : 0.1
      a += (ta - a) * Math.min(1, 3 * dt)
      b += (tb - b) * Math.min(1, 3 * dt)
      const anc = getCube().anchor()
      if (!anc) return
      const netP = point('[data-flow="network"]', 'left')
      const dock = point('[data-flow="wallet"] [data-side="l"]', 'top') ?? point('[data-flow="wallet"]', 'top')
      const capR = rectOf('.cube-cap:not([hidden])')
      const avoid = capR && capR.width ? capR : null
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      g.font = `400 10px ${FONT}`
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      if (netP && a > 0.02) {
        const d = 0.08 + 0.32 * a
        dotted(netP, anc.top, 0.12, t, '#E7EDF2', 0.4 * a + 0.04, 9, 11, d, avoid)
        dotted([netP[0], netP[1] + 16], [anc.top[0], anc.top[1] + 14], 0.18, t, '#E7EDF2', 0.2 * a, 7, 23, 0.7 * d, avoid)
      }
      if (dock && b > 0.02) {
        const d = hashing ? 0.1 + 0.35 * b : 0
        const c = dotted(anc.core, dock, 0.2, t, '#7FD6F7', 0.6 * b + 0.06, 11, 37, d, avoid)
        if (hashing) dotted([anc.core[0] - 12, anc.core[1] + 8], [dock[0] - 18, dock[1]], 0.28, t, '#7FD6F7', 0.28 * b, 8, 41, 0.7 * d, avoid)
        packets = packets.filter((p) => t - p.t0 < 0.9).slice(-8)
        for (const p of packets) {
          const k = (t - p.t0) / 0.8
          if (k < 0) continue
          if (k >= 1) {
            if (!p.landed) {
              p.landed = true
              const el = document.querySelector('[data-flow="wallet"] [data-side="l"] dd')
              if (el && !reduced) el.animate([{ color: '#7FD6F7', textShadow: '0 0 12px rgba(127,214,247,.55)' }, { color: '', textShadow: 'none' }], { duration: 520, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' })
            }
            continue
          }
          const e = 1 - Math.pow(1 - k, 3)
          for (let r = 0; r < 6; r++) {
            const s = e - 0.025 * r
            if (s < 0) continue
            const pt = quad(anc.core, c, dock, s)
            g.globalAlpha = (1 - r / 6) * Math.min(1, (1 - k) * 5 + 0.2)
            g.fillStyle = r === 0 ? '#E7EDF2' : '#7FD6F7'
            g.fillText(r === 0 ? '@' : HEX[(5 * r + Math.floor(20 * t)) & 15], pt[0], pt[1])
          }
        }
      }
      g.globalAlpha = 1
    }
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      removeEventListener('resize', resize)
      offBus()
    }
  }, [])
  return <canvas ref={ref} className="cb-flows" aria-hidden="true" />
}
