// "meet cubit" pre-launch image: the miner as a browser tab. 1600×900 @2x → 3200×1800.
// usage: node meet.mjs <cube.png> <out.png>
import { chromium } from 'playwright'
import fs from 'fs'
import path from 'path'

const [cubePng, outPng] = process.argv.slice(2)
const here = path.dirname(new URL(import.meta.url).pathname)
const site = '/home/claude/cubit'
const b64 = (p) => fs.readFileSync(p).toString('base64')
const font = (f) => {
  const dir = `${site}/node_modules/@fontsource-variable/${f}/files/`
  return `data:font/woff2;base64,${b64(dir + fs.readdirSync(dir).find((x) => x.includes('latin-wght-normal')))}`
}
const logo = fs.readFileSync(`${site}/public/favicon.svg`, 'utf8').replace('<svg ', '<svg width="20" height="20" ')
const glyph = fs.readFileSync(path.join(here, 'glyph.js'), 'utf8')
const cube = `data:image/png;base64,${b64(cubePng)}`

const rows = [
  ['01', 'wallet', '7xKp…3fQa', 'address only, nothing to sign'],
  ['02', 'hold', '1 unit', '<b>$CUBIT</b> · eligible <i class="ok">✓</i>'],
  ['03', 'cpu', '14.2 MH/s', 'sha-256 · 4 threads'],
  ['04', 'window', '0:42', '18 proofs verified · split by work'],
]

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:G;src:url(${font('geist')}) format('woff2');font-weight:100 900}
@font-face{font-family:Mono;src:url(${font('geist-mono')}) format('woff2');font-weight:100 900}
*{box-sizing:border-box}
html,body{margin:0;background:#07090b}
.art{width:1600px;height:900px;position:relative;overflow:hidden;background:#07090b;font-family:G;color:#e7edf2}
#bg{position:absolute;inset:0;width:1600px;height:900px}
.win{position:absolute;left:120px;top:96px;width:1360px;height:708px;border-radius:18px;background:#07090b;
  border:1px solid rgba(231,237,242,.11);overflow:hidden;
  box-shadow:0 0 0 1px rgba(0,0,0,.6),0 50px 140px rgba(0,0,0,.75),0 0 160px rgba(127,214,247,.07)}
.bar{position:absolute;left:0;right:0;top:0;height:56px;background:#0c0f12;border-bottom:1px solid #16191d}
.dots{position:absolute;left:22px;top:22px;display:flex;gap:9px}
.dots i{width:12px;height:12px;border-radius:50%;background:#22262c;display:block}
.tab{position:absolute;left:104px;bottom:-1px;height:44px;width:300px;background:#07090b;border:1px solid #16191d;border-bottom:0;
  border-radius:11px 11px 0 0;display:flex;align-items:center;gap:11px;padding:0 16px;font-size:16px;font-weight:500;letter-spacing:-.005em}
.tab svg{flex:none;border-radius:4px}
.tab .t{flex:1;white-space:nowrap}
.tab .t em{font-style:normal;color:#7fd6f7}
.tab .x{color:#4a5058;font-size:18px;line-height:1}
.tab .live{width:7px;height:7px;border-radius:50%;background:#7fd6f7;box-shadow:0 0 10px rgba(127,214,247,.9)}
.plus{position:absolute;left:420px;top:16px;color:#4a5058;font-size:24px;font-weight:300}
.body{position:absolute;left:0;right:0;top:56px;bottom:0}
.glow{position:absolute;left:605px;top:40px;width:720px;height:620px;
  background:radial-gradient(closest-side,rgba(127,214,247,.16),rgba(127,214,247,.04) 60%,transparent)}
.cube{position:absolute;left:525px;top:-34px;width:860px;height:704px;background:url(${cube}) center/contain no-repeat}
.cube.b{filter:blur(18px);opacity:.3;mix-blend-mode:screen}
#flow{position:absolute;inset:0;width:1360px;height:652px}
.rig{position:absolute;left:48px;top:32px;width:500px}
.rh{display:flex;justify-content:space-between;align-items:center;font:500 13px Mono;letter-spacing:.14em;text-transform:uppercase;color:#747d88;padding-bottom:16px}
.rh .on{display:flex;align-items:center;gap:9px;color:#e7edf2}
.rh .on i{width:9px;height:9px;border-radius:2px;background:#7fd6f7;box-shadow:0 0 12px rgba(127,214,247,.8);display:block}
.row{display:grid;grid-template-columns:44px 1fr;align-items:start;padding:20px 0 21px;border-top:1px solid #1a1d22}
.row:last-child{border-bottom:1px solid #1a1d22}
.n{font:500 14px Mono;color:#4a5058;padding-top:6px;letter-spacing:.04em}
.k{font:500 13px Mono;letter-spacing:.14em;text-transform:uppercase;color:#747d88}
.v{font:500 36px Mono;letter-spacing:-.035em;margin-top:6px;line-height:1}
.s{font:400 15px Mono;color:#a2abb4;margin-top:10px;letter-spacing:-.01em}
.s b{color:#e7edf2;font-weight:500}
.s .ok{font-style:normal;color:#7fd6f7}
.meter{display:flex;gap:4px;margin-top:14px}
.meter i{flex:1;height:9px;border-radius:2px;background:#16191d}
.meter i.f{background:#e7edf2;opacity:.85}
.meter i.h{background:#7fd6f7;box-shadow:0 0 10px rgba(127,214,247,.7)}
</style></head><body><div class="art">
<canvas id="bg"></canvas>
<div class="win">
  <div class="bar">
    <div class="dots"><i></i><i></i><i></i></div>
    <div class="tab">${logo}<span class="t">cubit <span style="color:#4a5058">·</span> <em>mining</em></span><span class="live"></span><span class="x">×</span></div>
    <div class="plus">+</div>
  </div>
  <div class="body">
    <div class="glow"></div>
    <div class="cube"></div>
    <div class="cube b"></div>
    <div class="rig">
      <div class="rh"><span>Rig</span><span class="on"><i></i>Live</span></div>
      ${rows
        .map(
          ([n, k, v, s], i) => `<div class="row" data-i="${i}"><span class="n">${n}</span><div><div class="k">${k}</div><div class="v">${v}</div><div class="s">${s}</div>${
            i === 3 ? `<div class="meter">${Array.from({ length: 30 }, (_, j) => `<i class="${j < 8 ? 'f' : j === 8 ? 'h' : ''}"></i>`).join('')}</div>` : ''
          }</div></div>`,
        )
        .join('')}
    </div>
  </div>
</div>
</div>
<script>${glyph}</script>
<script>
document.fonts.load('600 20px Mono').then(() => document.fonts.ready).then(() => {
  const dpr = window.devicePixelRatio || 1
  const atlas = buildAtlas(96)
  // background: faint field of unlit glyph tiles, fog toward the edges, glow behind the window's cube
  const bg = document.getElementById('bg')
  const W = 1600, H = 900, p = 22
  bg.width = W * dpr; bg.height = H * dpr
  const g = bg.getContext('2d')
  const r = rng(41)
  for (let y = 0; y < H / p + 1; y++) for (let x = 0; x < W / p + 1; x++) {
    const px = x * p - 4, py = y * p - 6
    const dx = (px - 1050) / 900, dy = (py - 450) / 600
    const near = Math.max(0, 1 - Math.hypot(dx, dy))
    const edge = Math.min(1, Math.min(px + 20, W - px + 20, py + 20, H - py + 20) / 140)
    const a = (0.03 + 0.09 * near * near + (r() < 0.015 ? 0.1 : 0)) * edge
    const acc = r() < 0.04 * near
    g.globalAlpha = acc ? a * 2.2 : a
    g.drawImage(atlas.cv, atlas.cell * ((r() * 16) | 0), acc ? atlas.cell : 0, atlas.cell, atlas.cell, (px + 2) * dpr, (py + 2) * dpr, (p - 4) * dpr, (p - 4) * dpr)
  }
  g.globalAlpha = 1
  const rg = g.createRadialGradient(1060 * dpr, 470 * dpr, 0, 1060 * dpr, 470 * dpr, 640 * dpr)
  rg.addColorStop(0, 'rgba(127,214,247,.10)')
  rg.addColorStop(1, 'rgba(127,214,247,0)')
  g.fillStyle = rg
  g.fillRect(0, 0, bg.width, bg.height)

  window.__done = true
})
</script>
</body></html>`

fs.writeFileSync(path.join(here, 'meet.html'), html)
const browser = await chromium.launch()
const page = await (await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 })).newPage()
page.on('pageerror', (e) => console.log('pageerror', e.message))
await page.goto('file://' + path.join(here, 'meet.html'))
await page.waitForFunction(() => window.__done === true)
await page.waitForTimeout(200)
await page.screenshot({ path: outPng })
await browser.close()
console.log('ok', outPng)
