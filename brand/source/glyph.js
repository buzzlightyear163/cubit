// Shared drawing for cubit graphics: hex-glyph atlas + isometric glyph-block cube.
// Same material as the site's cube (src/cube/engine.ts).
const HEX = '0123456789abcdef'
const C = { bg: '#07090B', fg: '#E7EDF2', acc: '#9EDFFF', accRGB: '127,214,247' }
const FACE = {
  base: { t: '#181B20', l: '#101317', r: '#0A0C0F' },
  acc: { t: '#1F4252', l: '#163240', r: '#0E2029' },
}
const SHADE = { t: 1, l: 0.66, r: 0.4 }

function rng(seed) {
  let s = seed >>> 0
  return () => ((s = Math.imul(s ^ (s >>> 15), 0x2c1b3c6d) + 0x9e3779b9) >>> 0) / 4294967296
}

function buildAtlas(cell = 96, cols = [C.fg, C.acc], font = '"Mono", ui-monospace, monospace') {
  const c = document.createElement('canvas')
  c.width = cell * 16
  c.height = cell * cols.length
  const g = c.getContext('2d')
  const k = cell / 48
  cols.forEach((col, row) => {
    for (let n = 0; n < 16; n++) {
      const x = cell * n, y = cell * row
      g.globalAlpha = 0.8
      g.strokeStyle = col
      g.lineWidth = 2.6 * k
      g.beginPath()
      g.roundRect(x + 5 * k, y + 5 * k, 38 * k, 38 * k, 7 * k)
      g.stroke()
      g.globalAlpha = 1
      g.fillStyle = col
      g.font = `600 ${22 * k}px ${font}`
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.fillText(HEX[n], x + 24 * k, y + 25 * k)
    }
  })
  return { cv: c, cell }
}

/**
 * Draw an isometric cube built from blocks.
 * opts: { ctx, dpr, S, ox, oy, blocks:[{x,y,z,lit}], n, light:[x,y,z], lightI, seed }
 */
function drawCube(o) {
  const { ctx, dpr, S, ox, oy, atlas } = o
  const r = rng(o.seed || 7)
  const P = (x, y, z) => [ox + (x - y) * S * 0.866, oy + (x + y) * S * 0.5 - z * S]
  const L = o.light || [1, 1, 1]
  const LI = o.lightI ?? 1
  const blocks = o.blocks.slice().sort((a, b) => a.x + a.y + a.z - (b.x + b.y + b.z))
  const face = (b, org, u, v, side) => {
    const p0 = P(...org), pu = P(org[0] + u[0], org[1] + u[1], org[2] + u[2]), pv = P(org[0] + v[0], org[1] + v[1], org[2] + v[2])
    ctx.setTransform(dpr * (pu[0] - p0[0]), dpr * (pu[1] - p0[1]), dpr * (pv[0] - p0[0]), dpr * (pv[1] - p0[1]), dpr * p0[0], dpr * p0[1])
    const tone = b.lit ? 'acc' : 'base'
    ctx.globalAlpha = 1
    ctx.fillStyle = FACE[tone][side]
    ctx.fillRect(0, 0, 1, 1)
    const cx = org[0] + (u[0] + v[0]) / 2, cy = org[1] + (u[1] + v[1]) / 2, cz = org[2] + (u[2] + v[2]) / 2
    const d2 = (cx - L[0]) ** 2 + (cy - L[1]) ** 2 + (cz - L[2]) ** 2
    if (!b.lit) {
      // light spill from the lit block
      const h = LI / (1 + d2 * 1.6)
      ctx.globalAlpha = Math.min(o.spillMax ?? 0.22, 0.4 * h)
      ctx.fillStyle = C.acc
      ctx.fillRect(0, 0, 1, 1)
    } else {
      const gr = ctx.createLinearGradient(0, 0, 1, 1)
      gr.addColorStop(0, `rgba(${C.accRGB},.28)`)
      gr.addColorStop(1, `rgba(${C.accRGB},.06)`)
      ctx.fillStyle = gr
      ctx.fillRect(0, 0, 1, 1)
    }
    ctx.globalAlpha = 1
    ctx.lineWidth = (b.lit ? 2 : 1.4) / (S * dpr) * dpr
    ctx.strokeStyle = b.lit ? `rgba(${C.accRGB},.75)` : 'rgba(231,237,242,.09)'
    ctx.strokeRect(0, 0, 1, 1)
    const n = o.n || 8
    const inv = 1 / n
    for (let k = 0; k < n * n; k++) {
      const gx = k % n, gy = (k / n) | 0
      const fu = (gx + 0.5) * inv, fv = (gy + 0.5) * inv
      const wx = org[0] + u[0] * fu + v[0] * fv, wy = org[1] + u[1] * fu + v[1] * fv, wz = org[2] + u[2] * fu + v[2] * fv
      const dd = (wx - L[0]) ** 2 + (wy - L[1]) ** 2 + (wz - L[2]) ** 2
      let a = SHADE[side] * ((o.gBase ?? 0.07) + (o.gVar ?? 0.24) * r())
      let acc = b.lit
      if (!b.lit) {
        const e = LI / (1 + dd * 1.3)
        a *= 1 + 2.6 * e
        if (e > 0.3 + 0.5 * r()) acc = true
      } else a = (0.5 + 0.5 * SHADE[side]) * (0.45 + 0.55 * r())
      if (o.skip && r() < o.skip && !b.lit) continue
      ctx.globalAlpha = Math.min(1, a)
      ctx.drawImage(atlas.cv, atlas.cell * ((r() * 16) | 0), acc ? atlas.cell : 0, atlas.cell, atlas.cell, gx * inv, gy * inv, inv, inv)
    }
  }
  for (const b of blocks) {
    const s = b.s || 1
    face(b, [b.x, b.y + s, b.z + s], [0, -s, 0], [s, 0, 0], 't')
    face(b, [b.x, b.y + s, b.z + s], [s, 0, 0], [0, 0, -s], 'l')
    face(b, [b.x + s, b.y + s, b.z + s], [0, -s, 0], [0, 0, -s], 'r')
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  return P
}

/** Soft glow: blur a copy of the canvas region and add it back with 'lighter'. */
function bloom(cv, amount = 0.6, blurPx = 18) {
  const t = document.createElement('canvas')
  t.width = cv.width
  t.height = cv.height
  const g = t.getContext('2d')
  g.filter = `blur(${blurPx}px)`
  g.drawImage(cv, 0, 0)
  const c = cv.getContext('2d')
  c.save()
  c.globalCompositeOperation = 'lighter'
  c.globalAlpha = amount
  c.drawImage(t, 0, 0)
  c.restore()
}
