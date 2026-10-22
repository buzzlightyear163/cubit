// ─────────────────────────────────────────────────────────────
//  The cube: a 4×4×4 lattice of hex-digit blocks with a lit core, drawn on 2D canvas
//  in isometric projection. One engine instance lives for the whole session and its
//  DOM node is moved between "slots" (Mine viz, page map) so animation state survives
//  navigation; the move is animated with a View Transition.
// ─────────────────────────────────────────────────────────────
import { LAYER_SECTION, SECTIONS, type SectionId } from '../data/sections'
import { bus } from '../lib/bus'
import { safeStorage } from '../lib/hooks'

export type Visuals = 'auto' | 'full' | 'lite' | 'off'
type Side = 't' | 'l' | 'r'
type V3 = [number, number, number]
type Tone = 'base' | 'acc'

const HEX = '0123456789abcdef'
const FONT = '"Geist Mono Variable", "Geist Mono", ui-monospace, Menlo, monospace'
const C_FG = '#E7EDF2'
const C_ACC = '#9EDFFF'
const ACC_RGB = '127,214,247'
const BG = '#07090B'
const FACE: Record<Tone | 'hot', Record<Side, string>> = {
  base: { t: '#191C21', l: '#101317', r: '#0A0C0F' },
  acc: { t: '#1D3440', l: '#14252F', r: '#0D1920' },
  hot: { t: '#15222A', l: '#101A20', r: '#0B1317' },
}
const SHADE: Record<Side, number> = { t: 1, l: 0.66, r: 0.34 }
const LOGICAL_W = 704
const LOGICAL_H = 576

const smooth = (a: number, b: number, x: number) => {
  const r = Math.max(0, Math.min(1, (x - a) / (b - a)))
  return r * r * (3 - 2 * r)
}
const easeIO = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2)
const easeOut = (x: number) => 1 - Math.pow(1 - x, 3)
const clamp01 = (x: number) => Math.max(0, Math.min(1, x))
const rnd16 = () => (Math.random() * 16) | 0
const bez = (a: V3, b: V3, c: V3, t: number): V3 => {
  const n = 1 - t
  return [0, 1, 2].map((i) => n * n * a[i] + 2 * n * t * b[i] + t * t * c[i]) as V3
}

function buildAtlas(): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = 768
  c.height = 96
  const g = c.getContext('2d')
  if (!g) return c
  ;[C_FG, C_ACC].forEach((col, row) => {
    for (let n = 0; n < 16; n++) {
      const x = 48 * n
      const y = 48 * row
      g.globalAlpha = 0.8
      g.strokeStyle = col
      g.lineWidth = 2.6
      g.beginPath()
      if (g.roundRect) g.roundRect(x + 5, y + 5, 38, 38, 7)
      else g.rect(x + 5, y + 5, 38, 38)
      g.stroke()
      g.globalAlpha = 1
      g.fillStyle = col
      g.font = `600 22px ${FONT}`
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.fillText(HEX[n], x + 24, y + 25)
    }
  })
  return c
}

interface Table { n: number; ch: Uint8Array; b: Float32Array; rk: Float32Array; v: number; owe: number }
interface CellFx { acc?: boolean; b?: number; flick?: number; hide?: boolean }
interface Block {
  x: number
  y: number
  z: number
  s?: number
  L?: number
  key: string
  n?: number
  tone?: Tone
  lit?: number
  alpha?: number
  hollow?: boolean
  dis?: number
  edge?: string
  flick?: number
  cellFn?: ((x: number, y: number, z: number, rank: number) => CellFx | null) | null
}
interface FX { on: boolean; t: number; C: V3; coreI: number; ripples: { t0: number }[]; gs: number }

class Painter {
  cv: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
  atlas: HTMLCanvasElement
  bloomCv = document.createElement('canvas')
  tables = new Map<string, Table>()
  W = 0
  H = 0
  dpr = 1
  dprCap = 1.5
  S = 1
  ox = 0
  oy = 0
  yc = 1
  ys = 0
  kY = 0.5
  fx: FX = { on: false, t: 0, C: [2, 2, 2], coreI: 0.5, ripples: [], gs: 0 }
  haloCv: HTMLCanvasElement | null = null
  bloomTick = 0
  atlasRev = 0
  faceCache = new Map<string, { cv: HTMLCanvasElement; ctx: CanvasRenderingContext2D; sig: string }>()

  constructor(cv: HTMLCanvasElement, atlas: HTMLCanvasElement) {
    const ctx = cv.getContext('2d')
    if (!ctx) throw new Error('2D canvas unavailable')
    this.cv = cv
    this.ctx = ctx
    this.atlas = atlas
  }

  pxScale = 1
  fit(w: number, h: number): boolean {
    if (!w || !h) return false
    // device pixels per logical pixel = screen DPR × how much the layer is scaled, capped
    const d = Math.max(0.75, Math.min(this.dprCap, (window.devicePixelRatio || 1) * this.pxScale))
    const pw = Math.round(w * d)
    const ph = Math.round(h * d)
    if (this.cv.width !== pw || this.cv.height !== ph) {
      this.cv.width = pw
      this.cv.height = ph
      this.bloomCv.width = Math.max(1, pw >> 2)
      this.bloomCv.height = Math.max(1, ph >> 2)
    }
    this.W = w
    this.H = h
    this.dpr = d
    return true
  }
  clear() {
    const c = this.ctx
    c.setTransform(1, 0, 0, 1, 0, 0)
    c.globalAlpha = 1
    c.clearRect(0, 0, this.cv.width, this.cv.height)
  }
  view(s: number, ox: number, oy: number) {
    this.S = s
    this.ox = ox
    this.oy = oy
  }
  camera(yaw: number, pitch: number) {
    this.yc = Math.cos(yaw)
    this.ys = Math.sin(yaw)
    this.kY = 0.5 + pitch
  }
  rx(x: number, y: number) {
    return (x - 2) * this.yc - (y - 2) * this.ys + 2
  }
  ry(x: number, y: number) {
    return (x - 2) * this.ys + (y - 2) * this.yc + 2
  }
  P(x: number, y: number, z: number): [number, number] {
    const a = this.rx(x, y)
    const b = this.ry(x, y)
    return [this.ox + (a - b) * this.S * 0.866, this.oy + (a + b) * this.S * this.kY - z * this.S]
  }
  depth(x: number, y: number, z: number) {
    return this.rx(x, y) + this.ry(x, y) + z
  }
  ndepth(x: number, y: number, z: number) {
    return (this.depth(x, y, z) - 6) / (1 + this.fx.gs) + 6
  }
  table(key: string, n: number): Table {
    let t = this.tables.get(key)
    if (!t || t.n !== n) {
      const N = n * n
      t = { n, ch: new Uint8Array(N), b: new Float32Array(N), rk: new Float32Array(N), v: 0, owe: 0 }
      for (let i = 0; i < N; i++) {
        t.ch[i] = rnd16()
        t.b[i] = 0.62 + 0.38 * Math.random()
        t.rk[i] = Math.random()
      }
      this.tables.set(key, t)
    }
    return t
  }

  face(o: V3, u: V3, v: V3, key: string, side: Side, b: Block) {
    const c = this.ctx
    const d = this.dpr
    const p0 = this.P(o[0], o[1], o[2])
    const pu = this.P(o[0] + u[0], o[1] + u[1], o[2] + u[2])
    const pv = this.P(o[0] + v[0], o[1] + v[1], o[2] + v[2])
    c.setTransform(d * (pu[0] - p0[0]), d * (pu[1] - p0[1]), d * (pv[0] - p0[0]), d * (pv[1] - p0[1]), d * p0[0], d * p0[1])
    const n = b.n ?? 5
    const alpha = b.alpha ?? 1
    const tone = b.tone ?? 'base'
    const fx = this.fx
    const lit3d = fx.on && !b.hollow
    const cx = o[0] + (u[0] + v[0]) / 2
    const cy = o[1] + (u[1] + v[1]) / 2
    const cz = o[2] + (u[2] + v[2]) / 2
    if (!b.hollow) {
      c.globalAlpha = alpha
      c.fillStyle = FACE[tone][side]
      c.fillRect(0, 0, 1, 1)
      if (lit3d) {
        const dx = cx - fx.C[0], dy = cy - fx.C[1], dz = cz - fx.C[2]
        const h = fx.coreI / (1 + (dx * dx + dy * dy + dz * dz) * 0.5)
        if (tone !== 'acc') {
          c.globalAlpha = Math.min(0.28, 0.2 * h) * alpha
          c.fillStyle = C_ACC
          c.fillRect(0, 0, 1, 1)
        }
        c.globalAlpha = (1 - smooth(2.5, 9.5, this.ndepth(cx, cy, cz))) * 0.55 * alpha
        c.fillStyle = BG
        c.fillRect(0, 0, 1, 1)
      }
    }
    c.globalAlpha = alpha * (b.hollow ? 0.9 : 1)
    c.lineWidth = 1.1 / (this.S * (b.s ?? 1))
    c.strokeStyle = b.edge ?? (tone === 'acc' ? `rgba(${ACC_RGB},.4)` : 'rgba(231,237,242,.07)')
    c.strokeRect(0, 0, 1, 1)

    const tb = this.table(key, n)
    const flick = b.flick ?? 0.004
    const lit = b.lit ?? 1
    // Quiet faces are rendered once into a small texture and reused until something changes.
    if (lit3d && tone !== 'acc' && !this.busy(o, u, v, b)) {
      tb.owe += flick * n * n
      if (tb.owe >= 3) {
        for (; tb.owe >= 1; tb.owe -= 1) tb.ch[(Math.random() * n * n) | 0] = rnd16()
        tb.v++
      }
      const dx = cx - fx.C[0], dy = cy - fx.C[1], dz = cz - fx.C[2]
      const h = fx.coreI / (1 + (dx * dx + dy * dy + dz * dz) * 0.5)
      const w = smooth(2.5, 9.5, this.ndepth(cx, cy, cz))
      const px = Math.max(24, Math.min(128, Math.round(this.S * (b.s ?? 1) * d)))
      const sig = `${tb.v}|${n}|${this.atlasRev}|${Math.round(14 * h)}|${Math.round(12 * w)}|${Math.round(lit * alpha * 24)}|${px}|${b.dis ? Math.round(10 * b.dis) : 0}`
      let fc = this.faceCache.get(key)
      if (!fc) {
        const cv = document.createElement('canvas')
        const cx2 = cv.getContext('2d')
        if (cx2) {
          fc = { cv, ctx: cx2, sig: '' }
          this.faceCache.set(key, fc)
        }
      }
      if (fc) {
        if (fc.sig !== sig) {
          if (fc.cv.width !== px) {
            fc.cv.width = px
            fc.cv.height = px
          } else fc.ctx.clearRect(0, 0, px, px)
          fc.ctx.setTransform(px, 0, 0, px, 0, 0)
          this.glyphs(fc.ctx, o, u, v, side, b, tb, false)
          fc.sig = sig
        }
        c.globalAlpha = 1
        c.drawImage(fc.cv, 0, 0, fc.cv.width, fc.cv.height, 0, 0, 1, 1)
        return
      }
    }
    for (let k = 0; k < n * n; k++) if (Math.random() < flick) tb.ch[k] = rnd16()
    this.glyphs(c, o, u, v, side, b, tb, true)
    tb.v++
  }

  /** Is anything animating across this face right now (ripple or cell effect)? */
  busy(o: V3, u: V3, v: V3, b: Block): boolean {
    const fx = this.fx
    if (fx.ripples.length) {
      const dx = o[0] + (u[0] + v[0]) / 2 - fx.C[0]
      const dy = o[1] + (u[1] + v[1]) / 2 - fx.C[1]
      const dz = o[2] + (u[2] + v[2]) / 2 - fx.C[2]
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)
      for (const r of fx.ripples) if (Math.abs(dist - (fx.t - r.t0) * 4.5) < 1.4) return true
    }
    if (!b.cellFn) return false
    for (const [p, q] of [[0.5, 0.5], [0.05, 0.05], [0.95, 0.05], [0.05, 0.95], [0.95, 0.95]]) {
      if (b.cellFn(o[0] + u[0] * p + v[0] * q, o[1] + u[1] * p + v[1] * q, o[2] + u[2] * p + v[2] * q, 0.5)) return true
    }
    return false
  }

  glyphs(c: CanvasRenderingContext2D, o: V3, u: V3, v: V3, side: Side, b: Block, tb: Table, live: boolean) {
    const n = tb.n
    const inv = 1 / n
    const m = SHADE[side]
    const lit = b.lit ?? 1
    const alpha = b.alpha ?? 1
    const tone = b.tone ?? 'base'
    const fx = this.fx
    const lit3d = fx.on && !b.hollow
    for (let k = 0; k < n * n; k++) {
      const g = tb.rk[k]
      if (b.dis && g < b.dis) continue
      const gx = k % n
      const gy = (k / n) | 0
      let acc = tone === 'acc'
      let j = m * tb.b[k] * lit * alpha
      const fu = (gx + 0.5) * inv
      const fv = (gy + 0.5) * inv
      const wx = o[0] + u[0] * fu + v[0] * fv
      const wy = o[1] + u[1] * fu + v[1] * fv
      const wz = o[2] + u[2] * fu + v[2] * fv
      if (live && b.cellFn) {
        const e = b.cellFn(wx, wy, wz, g)
        if (e) {
          if (e.acc) acc = true
          if (e.b != null) j *= e.b
          if (e.flick && Math.random() < e.flick) tb.ch[k] = rnd16()
          if (e.hide) continue
        }
      }
      if (lit3d) {
        const dx = wx - fx.C[0], dy = wy - fx.C[1], dz = wz - fx.C[2]
        const r2 = dx * dx + dy * dy + dz * dz
        if (tone !== 'acc') {
          const e = fx.coreI / (1 + 0.5 * r2)
          j *= 1 + 1.9 * e
          if (e > 0.2 + 0.55 * g) acc = true
        } else j *= 0.85 + 0.5 * fx.coreI * (0.6 + 0.4 * Math.sin(5 * fx.t + 30 * g))
        const dn = smooth(2.5, 9.5, this.ndepth(wx, wy, wz))
        if (g > 0.3 + 0.8 * dn) continue
        j *= 0.3 + 0.7 * dn
        if (live && fx.ripples.length) {
          const dist = Math.sqrt(r2)
          for (const rp of fx.ripples) {
            const age = fx.t - rp.t0
            const rr = 4.5 * age
            const w = Math.exp(-((dist - rr) * (dist - rr)) / 0.22) * (1 - age / 1.9)
            if (w > 0.03) {
              j *= 1 + 2.4 * w
              if (w > 0.3) {
                acc = true
                if (Math.random() < 0.25) tb.ch[k] = rnd16()
              }
            }
          }
        }
      }
      if (acc && tone === 'acc') j *= 1.3
      if (b.hollow) j *= 0.55
      if (j < 0.02) continue
      c.globalAlpha = Math.min(1, j)
      c.drawImage(this.atlas, 48 * tb.ch[k], acc ? 48 : 0, 48, 48, gx * inv, gy * inv, inv, inv)
    }
  }

  block(b: Block) {
    const s = b.s ?? 1
    const { x, y, z, key } = b
    this.face([x, y + s, z + s], [0, -s, 0], [s, 0, 0], `${key}t`, 't', b)
    this.face([x, y + s, z + s], [s, 0, 0], [0, 0, -s], `${key}l`, 'l', b)
    this.face([x + s, y + s, z + s], [0, -s, 0], [0, 0, -s], `${key}r`, 'r', b)
  }

  draw(blocks: Block[]) {
    const dep = (b: Block) => {
      const s = b.s ?? 1
      return this.depth(b.x + s / 2, b.y + s / 2, b.z + s / 2)
    }
    blocks.sort((a, b) => (a.L ?? 9) - (b.L ?? 9) || dep(a) - dep(b) || a.z - b.z)
    for (const b of blocks) this.block(b)
  }

  halo(x: number, y: number, z: number, r: number, a: number) {
    if (!this.haloCv) {
      const cv = document.createElement('canvas')
      cv.width = cv.height = 128
      const g = cv.getContext('2d')
      if (g) {
        const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64)
        gr.addColorStop(0, `rgba(${ACC_RGB},1)`)
        gr.addColorStop(1, `rgba(${ACC_RGB},0)`)
        g.fillStyle = gr
        g.fillRect(0, 0, 128, 128)
      }
      this.haloCv = cv
    }
    const c = this.ctx
    const p = this.P(x, y, z)
    const R = r * this.S
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    c.globalAlpha = Math.min(0.32, a)
    c.drawImage(this.haloCv, p[0] - R, p[1] - R, 2 * R, 2 * R)
  }

  bloom(k = 0.75) {
    const g = this.bloomCv.getContext('2d')
    if (!g || !('filter' in g)) return
    const c = this.ctx
    if (this.bloomTick++ % 2 === 0) {
      g.setTransform(1, 0, 0, 1, 0, 0)
      g.globalCompositeOperation = 'source-over'
      g.clearRect(0, 0, this.bloomCv.width, this.bloomCv.height)
      g.filter = 'blur(3px)'
      g.drawImage(this.cv, 0, 0, this.bloomCv.width, this.bloomCv.height)
      g.filter = 'none'
    }
    c.setTransform(1, 0, 0, 1, 0, 0)
    c.globalCompositeOperation = 'lighter'
    c.globalAlpha = k
    c.drawImage(this.bloomCv, 0, 0, this.cv.width, this.cv.height)
    c.globalCompositeOperation = 'source-over'
    c.globalAlpha = 1
  }

  glyph(ch: number, x: number, y: number, size: number, acc: boolean, a: number) {
    const c = this.ctx
    c.globalAlpha = Math.min(1, a)
    c.drawImage(this.atlas, 48 * ch, acc ? 48 : 0, 48, 48, x - size / 2, y - size / 2, size, size)
  }
  line(pts: [number, number][], color: string, a: number) {
    const c = this.ctx
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    c.globalAlpha = a
    c.strokeStyle = color
    c.lineWidth = 1
    c.beginPath()
    pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])))
    c.stroke()
  }
  text(s: string, x: number, y: number, o: { color?: string; a?: number; size?: number; w?: number } = {}) {
    const c = this.ctx
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    c.globalAlpha = o.a ?? 1
    c.font = `${o.w ?? 500} ${o.size ?? 11}px ${FONT}`
    c.fillStyle = o.color ?? C_FG
    c.textAlign = 'left'
    c.textBaseline = 'middle'
    c.fillText(s, x, y)
  }
}

// ── layout helpers ──────────────────────────────────────────
const IDLE = [0, 0.5, 1, 1.5]
const ARMED = [0, 0.75, 1.5, 2.25]
const isCut = (x: number, y: number, z: number) => x >= 2 && y >= 2 && z >= 1 // front corner cut away
const isCore = (x: number, y: number, z: number) => x >= 1 && x <= 2 && y >= 1 && y <= 2 && z >= 1 && z <= 2
const farPoint = (): V3 => [-0.6 + 0.8 * Math.random(), 7.4 + 0.9 * Math.random(), -1.4 + 0.5 * Math.random()]
const VIA: V3 = [0.4, 4.6, 0.4]

function lift(sec: SectionId, mode: 'idle' | 'armed' | 'mining'): number[] {
  const layer = SECTIONS[sec].layer
  if (sec === 'core') return mode === 'idle' ? IDLE : ARMED
  if (layer == null) return [0, 0.14, 0.28, 0.42]
  return [0, 1, 2, 3].map((e) => 0.14 * e + 0.8 * (e > layer ? 1 : 0) + 0.34 * (e === layer ? 1 : 0))
}

interface Proof { t0: number; ph: 'gather' | 'rise' | 'in' | 'drop'; ok: boolean; extra?: number }
interface Particle { kind: 'stream' | 'amb' | 'shard'; t0: number; dur?: number; a?: V3; ch: number; p?: Proof; j?: V3; pos?: V3; vel?: V3 }

export interface CubeMode { hashing: boolean; armed: boolean; load: number }

// ── engine ──────────────────────────────────────────────────
class CubeEngine {
  el: HTMLDivElement
  main: HTMLCanvasElement
  top: HTMLCanvasElement
  cap: HTMLDivElement
  private a: Painter | null = null
  private b: Painter | null = null
  private sec: SectionId = 'core'
  private mode: CubeMode = { hashing: false, armed: false, load: 0 }
  private onSelect: ((id: SectionId) => void) | null = null
  private hover: SectionId | null = null
  private pointer: [number, number] | null = null
  private polys: { id: SectionId; poly: [number, number][] }[] = []
  private anchorPts: { core: [number, number]; top: [number, number] } | null = null
  private started = false
  private box = { w: 0, h: 0 }
  private slot: HTMLElement | null = null
  private slotRO: ResizeObserver
  private k = 1
  private visible = true
  private io: IntersectionObserver
  visuals: Visuals = (safeStorage.get('cubit:visuals') as Visuals) || 'auto'
  private visualsSubs = new Set<() => void>()
  // animation state
  private S = IDLE.slice()
  private trans: { from: number[]; to: number[]; t0: number; d: number } | null = null
  private lastSec: SectionId = 'core'
  private lastMode: 'idle' | 'armed' | 'mining' = 'idle'
  private U = 0
  private lastT = 0
  private yaw = 0
  private pitch = 0
  private el4 = [0.44, 0.44, 0.44, 0.44]
  private mergeAt = -10
  private proofTimes: number[] = []
  private sweeps: { z: number; t0: number }[] = []
  private ripples: { t0: number }[] = []
  private proofs: Proof[] = []
  private parts: Particle[] = []
  private ambAcc = 0
  private lastDraw = -1
  private degrade = 0
  private perf = { ms: 0, frames: 0, t0: performance.now() }
  private capAt = 0
  private reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

  constructor() {
    this.el = document.createElement('div')
    this.el.className = 'cube-layer'
    this.main = document.createElement('canvas')
    this.main.setAttribute('role', 'img')
    this.top = document.createElement('canvas')
    this.top.className = 'cube-top'
    this.top.setAttribute('aria-hidden', 'true')
    this.cap = document.createElement('div')
    this.cap.className = 'cube-cap'
    this.cap.setAttribute('role', 'status')
    this.cap.hidden = true
    this.cap.append(document.createElement('span'), document.createElement('span'))
    this.el.append(this.main, this.top)
    this.label()

    // The cube always lays out at a fixed logical size and is scaled to fit its slot,
    // so it looks identical everywhere and the move between slots is a pure transform.
    this.box = { w: LOGICAL_W, h: LOGICAL_H }
    this.el.style.width = `${LOGICAL_W}px`
    this.el.style.height = `${LOGICAL_H}px`
    this.slotRO = new ResizeObserver(() => this.place())
    this.io = new IntersectionObserver((entries) => {
      const e = entries[entries.length - 1]
      this.visible = e?.isIntersecting ?? true
    })

    this.main.addEventListener('mousemove', (e) => {
      const p = this.local(e)
      this.pointer = p
      const hit = this.hit(p[0], p[1])
      this.hover = hit
      this.main.style.cursor = hit && hit !== this.sec ? 'pointer' : 'default'
    })
    this.main.addEventListener('mouseleave', () => {
      this.hover = null
      this.pointer = null
    })
    this.main.addEventListener('click', (e) => {
      const p = this.local(e)
      const hit = this.hit(p[0], p[1])
      if (hit && this.onSelect) this.onSelect(hit)
    })

    bus.on((ev) => {
      if (ev.type === 'proof') this.proof(ev.ok)
      else if (ev.type === 'fee') this.caption('on chain', `+${(ev.lamports / 1e9).toFixed(4)} SOL creator fees landed.`)
      else if (ev.type === 'settle') this.sweep(3)
    })
  }

  private local(e: MouseEvent): [number, number] {
    const r = this.main.getBoundingClientRect()
    const k = r.width ? this.main.offsetWidth / r.width : 1
    return [(e.clientX - r.left) * k, (e.clientY - r.top) * k]
  }
  private hit(x: number, y: number): SectionId | null {
    const inside = (poly: [number, number][]) => {
      let r = false
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const a = poly[i]
        const b = poly[j]
        if (a[1] > y !== b[1] > y && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) r = !r
      }
      return r
    }
    for (const p of this.polys) if (inside(p.poly)) return p.id
    return null
  }
  private label() {
    this.main.setAttribute(
      'aria-label',
      `Hex-digit cube in four layers with a lit core, turning a little with the pointer, ${SECTIONS[this.sec].label} selected. Proofs arrive as glyphs and merge into the core or shatter.`,
    )
  }

  private place() {
    const s = this.slot
    if (!s) return
    const w = s.clientWidth
    const h = s.clientHeight
    if (!w || !h) return
    this.k = Math.min(w / LOGICAL_W, h / LOGICAL_H)
    this.el.style.transform = `translate(-50%, -50%) scale(${this.k})`
    if (this.a) this.a.pxScale = this.k
    if (this.b) this.b.pxScale = this.k
  }

  mount(slot: HTMLElement) {
    if (this.el.parentElement !== slot) slot.appendChild(this.el)
    if (this.cap.parentElement !== slot) slot.appendChild(this.cap)
    if (this.slot) this.slotRO.unobserve(this.slot)
    this.slot = slot
    this.slotRO.observe(slot)
    this.place()
    // (re)observe after attaching: an element observed while detached can stay "not intersecting"
    this.visible = true
    this.io.unobserve(this.el)
    this.io.observe(this.el)
    if (!this.started) this.start()
  }
  setSection(sec: SectionId) {
    this.sec = sec
    this.label()
  }
  setMode(m: CubeMode) {
    this.mode = m
  }
  setOnSelect(fn: (id: SectionId) => void) {
    this.onSelect = fn
  }
  setVisuals(v: Visuals) {
    this.visuals = v
    safeStorage.set('cubit:visuals', v === 'auto' ? null : v)
    this.visualsSubs.forEach((f) => f())
  }
  subscribeVisuals(fn: () => void) {
    this.visualsSubs.add(fn)
    return () => {
      this.visualsSubs.delete(fn)
    }
  }
  /** Viewport coordinates of the core and the cube's top corner. */
  anchor(): { core: [number, number]; top: [number, number] } | null {
    if (!this.anchorPts) return null
    const r = this.main.getBoundingClientRect()
    const k = this.main.offsetWidth ? r.width / this.main.offsetWidth : 1
    const { core, top } = this.anchorPts
    return { core: [r.left + core[0] * k, r.top + core[1] * k], top: [r.left + top[0] * k, r.top + top[1] * k] }
  }
  proof(ok: boolean) {
    const t = performance.now() / 1000
    this.proofTimes.push(t)
    let p: Proof | null = null
    if (this.proofs.length < 3) {
      p = { t0: t, ph: this.reduced ? 'rise' : 'gather', ok }
      this.proofs.push(p)
    } else this.proofs[2].extra = (this.proofs[2].extra ?? 0) + 1
    if (p && !this.reduced) for (let i = 0; i < 14; i++) this.parts.push({ kind: 'stream', p, t0: t + 0.04 * i, dur: 0.7, a: farPoint(), ch: rnd16() })
  }
  sweep(z: number) {
    this.sweeps.push({ z, t0: performance.now() / 1000 })
  }
  caption(a: string, b: string) {
    this.cap.hidden = false
    const [x, y] = this.cap.children
    x.textContent = a
    ;(x as HTMLElement).toggleAttribute('data-chain', a === 'on chain')
    y.textContent = b
    this.capAt = performance.now() / 1000
  }

  private start() {
    this.started = true
    const atlas = buildAtlas()
    this.a = new Painter(this.main, atlas)
    this.b = new Painter(this.top, atlas)
    this.a.pxScale = this.b.pxScale = this.k
    document.fonts?.load(`600 22px ${FONT}`).then(() => {
      const fresh = buildAtlas()
      if (this.a) {
        this.a.atlas = fresh
        this.a.atlasRev++
      }
      if (this.b) {
        this.b.atlas = fresh
        this.b.atlasRev++
      }
    })
    const loop = (ms: number) => {
      requestAnimationFrame(loop)
      const t0 = performance.now()
      this.frame(ms / 1000)
      const spent = performance.now() - t0
      this.perf.ms += spent
      this.perf.frames++
      if (t0 - this.perf.t0 > 1000) {
        const avg = this.perf.ms / Math.max(1, this.perf.frames)
        if (avg > 9 && this.degrade < 4) this.degrade++
        else if (avg < 3 && this.degrade > 0) this.degrade--
        this.perf = { ms: 0, frames: 0, t0 }
      }
    }
    requestAnimationFrame(loop)
  }

  private frame(t: number) {
    const A = this.a
    const B = this.b
    if (!A || !B) return
    if (this.visuals === 'off') {
      if (this.lastDraw !== -2) {
        A.clear()
        B.clear()
        this.lastDraw = -2
      }
      return
    }
    if (!this.visible || document.hidden) return
    if (!A.fit(this.box.w, this.box.h) || !B.fit(this.box.w, this.box.h)) return
    B.clear()
    const dt = this.lastT ? Math.min(0.1, t - this.lastT) : 0.016
    this.lastT = t
    const rm = this.reduced
    const lite = this.visuals === 'lite' || this.degrade >= 2
    const mode: 'idle' | 'armed' | 'mining' = this.mode.hashing ? 'mining' : this.mode.armed ? 'armed' : 'idle'
    const load = this.mode.hashing ? clamp01(this.mode.load || 0.5) : 0

    // layer lift transitions
    if (this.sec !== this.lastSec || mode !== this.lastMode) {
      const d = this.sec !== this.lastSec ? 0.85 : mode === 'mining' ? 1.1 : 0.7
      const kick = mode === 'mining' && this.lastMode !== 'mining' && this.sec === this.lastSec
      this.lastSec = this.sec
      this.lastMode = mode
      const to = lift(this.sec, mode)
      if (rm) {
        this.S = to.slice()
        this.trans = null
      } else {
        if (kick) this.mergeAt = t
        this.trans = { from: this.S.slice(), to, t0: t + (kick ? 0.15 : 0), d }
      }
    }
    this.U += ((mode === 'mining' ? 1 : 0) - this.U) * Math.min(1, 2.2 * dt)
    if (rm) this.U = mode === 'mining' ? 1 : 0
    if (this.trans) {
      const k = clamp01((t - this.trans.t0) / this.trans.d)
      const e = easeIO(k)
      const { from, to } = this.trans
      this.S = from.map((v, i) => v + (to[i] - v) * e)
      if (k >= 1) this.trans = null
    }

    // camera follows the pointer a little
    const W = A.W
    const H = A.H
    const ptr = this.pointer
    if (!rm) {
      const idle = 1 - this.U
      const ty = (ptr ? (ptr[0] / W - 0.5) * 0.42 : 0) + 0.07 * Math.sin(0.17 * t) * idle
      const tp = ptr ? (0.5 - ptr[1] / H) * 0.08 : 0.015 * Math.sin(0.11 * t) * idle
      this.yaw += (ty - this.yaw) * Math.min(1, 3.5 * dt)
      this.pitch += (tp - this.pitch) * Math.min(1, 3.5 * dt)
    }
    A.camera(this.yaw, this.pitch)
    B.camera(this.yaw, this.pitch)

    // horizontal explode per layer
    const sel = SECTIONS[this.sec].layer
    const isCoreSec = this.sec === 'core'
    const hov = this.hover
    const hovLayer = hov ? SECTIONS[hov].layer : null
    const base = isCoreSec ? 0.44 + 0.36 * this.U : 0.44
    const focus = isCoreSec ? (hov && hov !== 'core' ? hovLayer : null) : sel
    for (let i = 0; i < 4; i++) {
      const target = focus == null ? base : i === focus ? 1.35 * base : 0.45 * base
      this.el4[i] = rm ? target : this.el4[i] + (target - this.el4[i]) * Math.min(1, 4 * dt)
    }
    const el4 = this.el4
    const I = Math.max(...el4)
    const pos = (e: number, layer: number) => 2 + (e + 0.5 - 2) * (1 + el4[layer]) - 0.5
    const narrow = W < 480
    const up = 3.7 + this.S[3] + 1.5 * I
    const down = 4 + 1.5 * I
    const scale = Math.min(W / ((narrow ? 7.6 : 9.6) * Math.max(1, (8 + 6 * I) / 9.2)), H / (up + down + 2.4))
    const oy = H / 2 + ((up - down) / 2) * scale
    A.view(scale, W / 2, oy)
    B.view(scale, W / 2, oy)
    A.dprCap = B.dprCap = narrow ? 1.25 : lite ? 1 : 1.5

    // hit polygons
    const P = (x: number, y: number, z: number) => A.P(x, y, z)
    const hex = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number): [number, number][] => [
      P(x0, y0, z1), P(x1, y0, z1), P(x1, y0, z0), P(x1, y1, z0), P(x0, y1, z0), P(x0, y1, z1),
    ]
    this.polys = [{ id: 'core' as SectionId, poly: hex(pos(1, 1), pos(2, 1) + 1, pos(1, 1), pos(2, 1) + 1, 1 + this.S[1], 3 + this.S[2]) }].concat(
      [3, 2, 1, 0].map((e) => ({ id: LAYER_SECTION[e], poly: hex(pos(0, e), pos(3, e) + 1, pos(0, e), pos(3, e) + 1, e + this.S[e], e + 1 + this.S[e]) })),
    )

    // wobble
    const U = this.U
    const ey = this.S.map((e, i) => (isCoreSec && !rm ? e + (1 - U) * 0.05 * i * Math.sin(0.9 * t - 0.6 * i) + (i ? 0.06 * U * Math.sin(3.1 * t - 1.1 * i) : 0) : e))
    const bright = isCoreSec ? 1 : 0.8
    this.sweeps = this.sweeps.filter((s) => t - s.t0 < 2.2)
    this.ripples = this.ripples.filter((r) => t - r.t0 < 1.9)
    const sinceMerge = t - this.mergeAt
    const flash = sinceMerge >= 0 && sinceMerge < 1 ? 1 - sinceMerge : 0
    this.proofTimes = this.proofTimes.filter((x) => t - x < 0.6)
    const C: V3 = [2, 2, 2 + (ey[1] + ey[2]) / 2]
    const coreI = (0.42 + 0.3 * load + 0.12 * load * Math.sin(7.3 * t) + 1.4 * flash) * (isCoreSec ? 1 : 0.75)
    const gs = (el4[0] + el4[1] + el4[2] + el4[3]) / 4
    A.fx = { on: true, t, C, coreI, ripples: this.ripples, gs }
    const ph = (t % 6) / 2.2
    const scan = isCoreSec && !rm && U < 0.98 && ph <= 1 ? 11 * ph - 1.5 : null
    const bandLo = 1 + ey[1]
    const band = bandLo + ((0.55 * t) % 1) * (3 + ey[2] - bandLo)
    const flk = rm ? 0 : 0.5
    const n = lite ? 4 : 5
    const fpsMain = rm ? 6 : Math.max(4, (lite ? 12 : 30) - 5 * this.degrade)
    const moving = this.trans != null || Math.abs(el4[0] - (focus == null ? base : focus === 0 ? 1.35 * base : 0.45 * base)) > 0.01
    const redraw = this.lastDraw < 0 || t - this.lastDraw >= 1 / fpsMain - 0.004 || (moving && !rm) || !!ptr

    const blocks: Block[] = []
    for (let x = 0; redraw && x < 4; x++)
      for (let y = 0; y < 4; y++)
        for (let z = 0; z < 4; z++) {
          if (isCut(x, y, z)) continue
          const core = isCore(x, y, z)
          let lit = bright
          if (isCoreSec) lit *= core ? 1.05 : 0.78
          else lit *= z === sel ? 1.12 : 0.5
          if (hovLayer === z && !core && hov !== this.sec) lit *= 1.35
          if (!core && !rm) lit *= 0.94 + 0.06 * Math.sin(1.1 * t - (x + y) * 0.7)
          if (!core && isCoreSec) lit *= 1 + 0.18 * U
          const sw = this.sweeps.filter((s) => s.z === z).map((s) => ((t - s.t0) / 1.4) * 8 - 1)
          const mining = core && U > 0.05 && !rm
          const scanning = scan != null && !core
          const cellFn =
            sw.length || scanning || mining
              ? (cx: number, cy: number, cz: number, rank: number): CellFx | null => {
                  for (const s of sw) {
                    const d = (cx + cy - 4) / (1 + gs) + 4 - s
                    if (Math.abs(d) < 0.3) return { acc: true, b: 2.6, flick: 0.5 }
                    if (d < 0 && d > -2.8) {
                      const k = Math.exp(1.3 * d)
                      return { acc: rank < 0.9 * k, b: 1 + 1.2 * k }
                    }
                  }
                  if (mining) {
                    const d = cz - band
                    return { b: 1 + 1.1 * U * Math.exp(-(d * d) / 0.05), flick: 0.25 * U }
                  }
                  if (scanning && scan != null) {
                    const d = Math.abs((cx + cy - 4) / (1 + gs) + 4 - scan)
                    if (d < 1.1) return { b: 1 + 0.95 * (1 - d / 1.1), flick: 0.08 }
                  }
                  return null
                }
              : null
          const wob = rm ? 0 : 0.04 * U * Math.sin(2.3 * t + 1.7 * x + 2.9 * y + 1.3 * z)
          const blk: Block = { x: pos(x, z) + wob, y: pos(y, z) - wob, z: z + ey[z], L: z, n, key: `${x},${y},${z}`, lit, cellFn, flick: (0.004 + 0.012 * load) * flk * 2 }
          if (core) {
            blk.tone = 'acc'
            const pulse = rm ? 1 : mode === 'armed' ? 0.9 + 0.2 * Math.sin(4.2 * t) : 0.92 + 0.12 * Math.sin(1.6 * t)
            blk.lit = lit * (0.85 + 0.7 * flash + 0.25 * U) * (U > 0.5 ? 1 : pulse) * (hov === 'core' && !isCoreSec ? 1.3 : 1)
            blk.flick = rm ? 0 : 0.02 + 0.14 * load
            if (this.proofTimes.length && !rm) blk.flick = 0.4
          }
          blocks.push(blk)
        }

    // proofs on the top canvas
    const top: Block[] = []
    const labels: { pos: V3; s: number; ph: Proof['ph']; extra?: number; a: number }[] = []
    const anchors = new Map<Proof, V3>()
    this.proofs = this.proofs.filter((p, i) => {
      const age = t - p.t0
      const seat: V3 = [pos(2, 1) + 0.85, pos(2, 1) + 0.85, 1 + ey[1] + 0.25]
      let z = seat[2]
      let a = 1
      let s = 0.36
      let dis = 0
      let at: V3 | null = null
      if (p.ph === 'gather') {
        dis = 1 - easeOut(clamp01((age - 0.3) / 0.5))
        if (age > 0.85) {
          p.ph = 'rise'
          p.t0 = t
        }
      } else if (p.ph === 'rise') {
        z += 1.2 * easeOut(clamp01(age / 0.8))
        if (age > 1.1) {
          p.ph = p.ok ? 'in' : 'drop'
          p.t0 = t
          if (!p.ok && !rm) {
            const o: V3 = [seat[0] + 0.18, seat[1] - 0.5 * i + 0.18, z + 0.55 * i + 0.18]
            for (let q = 0; q < 16; q++)
              this.parts.push({ kind: 'shard', t0: t, pos: [...o] as V3, vel: [(Math.random() - 0.5) * 1.4, (Math.random() - 0.5) * 1.4, 0.4 + 1.4 * Math.random()], ch: rnd16() })
          }
        }
      }
      if (p.ph === 'in') {
        const k = easeIO(clamp01((t - p.t0) / 0.65))
        const from: V3 = [seat[0], seat[1] - 0.5 * i, seat[2] + 1.2 + 0.55 * i]
        const to: V3 = [C[0] - 0.05, C[1] - 0.05, C[2] - 0.05]
        at = from.map((v, q) => v + (to[q] - v) * k) as V3
        s = 0.36 - 0.26 * k
        a = 1 - 0.6 * k
        if (t - p.t0 > 0.65) {
          if (!rm) this.ripples.push({ t0: t })
          this.mergeAt = t
          return false
        }
      } else if (p.ph === 'drop') {
        const k = t - p.t0
        a = rm ? 1 - clamp01(k) : 1 - clamp01(k / 0.15)
        if (k > 1) return false
        const r = clamp01(k)
        labels.push({ pos: [seat[0], seat[1] - 0.5 * i, z + 1.2 + 0.55 * i], s, ph: 'drop', a: 1 - r * r * r })
      }
      if (!at) at = [seat[0], seat[1] - 0.5 * i, z + 0.55 * i]
      anchors.set(p, [at[0] + s / 2, at[1] + s / 2, at[2] + s / 2])
      if (a > 0.01)
        top.push({ x: at[0], y: at[1], z: at[2], s, n: 3, key: `pf${i}`, hollow: true, alpha: a, dis, edge: p.ph === 'drop' ? 'rgba(231,237,242,.35)' : `rgba(${ACC_RGB},.8)`, flick: rm ? 0 : 0.05 })
      if (p.ph !== 'drop' && p.ph !== 'gather') labels.push({ pos: at, s, ph: p.ph, extra: p.extra, a })
      if (p.ph === 'gather' && age > 0.45) labels.push({ pos: at, s, ph: 'gather', a: clamp01((age - 0.45) / 0.3) })
      return true
    })

    if (redraw) {
      A.clear()
      A.halo(C[0], C[1], C[2], 3.2, 0.12 * coreI)
      A.draw(blocks)
      if (!lite) A.bloom(0.75)
      this.lastDraw = t
      this.anchorPts = { core: A.P(C[0], C[1], C[2]), top: A.P(pos(3, 3) + 1, pos(0, 3), 4 + ey[3]) }
    }
    B.fx = { on: false, t, C, coreI, ripples: [], gs }
    B.draw(top)

    // ambient glyphs stream into the core while hashing
    if (this.mode.hashing && !rm) {
      for (this.ambAcc += dt * (4 + 18 * load); this.ambAcc > 1; this.ambAcc--) {
        this.parts.push({ kind: 'amb', t0: t, dur: 1.5 + 0.5 * Math.random(), a: farPoint(), j: [(Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.5], ch: rnd16() })
      }
    }
    B.ctx.setTransform(B.dpr, 0, 0, B.dpr, 0, 0)
    const trail = lite ? 1 : 3
    this.parts = this.parts.filter((pt) => {
      const age = t - pt.t0
      if (age < 0) return true
      if (pt.kind === 'shard') {
        if (age > 1.2 || !pt.pos || !pt.vel) return false
        pt.vel[2] -= 5 * dt
        for (let q = 0; q < 3; q++) pt.pos[q] += pt.vel[q] * dt
        const sp = B.P(pt.pos[0], pt.pos[1], pt.pos[2])
        B.glyph(pt.ch, sp[0], sp[1], 12, false, (1 - age / 1.2) * 0.62)
        return true
      }
      const r = age / (pt.dur ?? 1)
      if (r >= 1) return false
      const target: V3 = pt.kind === 'stream' && pt.p ? anchors.get(pt.p) ?? C : [C[0] + (pt.j?.[0] ?? 0), C[1] + (pt.j?.[1] ?? 0), C[2] + (pt.j?.[2] ?? 0)]
      if (Math.random() < 0.08) pt.ch = rnd16()
      const isStream = pt.kind === 'stream'
      for (let q = trail; q >= 0; q--) {
        const k = clamp01(r - 0.035 * q)
        const w = bez(pt.a ?? C, VIA, target, easeIO(k))
        const sp = B.P(w[0], w[1], w[2])
        const fade = (1 - q / 4) * (isStream ? 0.85 : 0.22) * smooth(0, 0.25, r) * (1 - smooth(0.75, 1, r) * (isStream ? 0.5 : 1))
        B.glyph(pt.ch, sp[0], sp[1], q ? 9 : 11, isStream, fade * (q ? 0.22 : 0.75))
      }
      return true
    })

    for (const l of labels) {
      const p = B.P(l.pos[0] + l.s, l.pos[1] + l.s / 2, l.pos[2] + l.s / 2)
      const txt = l.ph === 'in' ? 'credited' : l.ph === 'drop' ? '× rejected' : l.ph === 'gather' ? 'compiling' : `proof${l.extra ? ` +${l.extra}` : ''}`
      const col = l.ph === 'in' ? C_FG : l.ph === 'drop' ? '#A2ABB4' : C_ACC
      B.line([[p[0] + 2, p[1]], [p[0] + 14, p[1] - 8], [p[0] + 22, p[1] - 8]], col, 0.6 * l.a)
      B.text(txt, p[0] + 26, p[1] - 8, { color: col, a: l.a, size: 10.5 })
    }
    if (hov && ptr && hov !== this.sec) B.text(SECTIONS[hov].label, ptr[0] + 16, ptr[1] - 14, { color: C_FG, size: 12 })
    if (!this.cap.hidden && t - this.capAt > 6 && performance.now() / 1000 - this.capAt > 6) this.cap.hidden = true
  }
}

let engine: CubeEngine | null = null
export function getCube(): CubeEngine {
  if (!engine) {
    engine = new CubeEngine()
    if (import.meta.env.DEV) (window as unknown as { __cube?: CubeEngine }).__cube = engine
  }
  return engine
}
