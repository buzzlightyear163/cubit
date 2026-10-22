// Deterministic capture of the site's cube for the launch video.
// usage: node capture.mjs <outdir> <width> <height> <dpr> <seconds> [stillAt]
import { chromium } from 'playwright'
import fs from 'fs'
const [outdir, w = '1920', h = '1080', dpr = '1', secs = '8', stillAt = ''] = process.argv.slice(2)
fs.mkdirSync(outdir, { recursive: true })
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: +dpr })
const page = await ctx.newPage()
page.on('pageerror', (e) => console.log('pageerror', e.message))
await page.clock.install({ time: new Date('2026-10-22T09:00:00Z') })
await page.goto('http://localhost:5174/', { waitUntil: 'networkidle' })
await page.addStyleTag({
  content: `
  .cb-head,.mc-lede,.mc-dock,.mc-col,.cb-flows,.cube-cap,.wallet-picker{display:none!important}
  html,body,.cb,.cb-main,.mc{background:#07090b!important;border:0!important}
  .mc-viz{position:fixed!important;inset:0!important;height:100vh!important;width:100vw!important;z-index:100;background:#07090b!important}
  `,
})
await page.clock.runFor(1500)
await page.evaluate(() => {
  const c = window.__cube
  Object.defineProperty(c, 'degrade', { get: () => 0, set: () => {} })
  c.setVisuals('full')
  c.a.dprCap = c.b.dprCap = 4
  c.setMode({ hashing: true, armed: true, load: 0.8 })
})
// let the layers lift into mining mode
await page.clock.runFor(1600)
const fps = 30
const N = Math.round(+secs * fps)
// proof schedule (seconds) — one shatters
const proofs = [[0.2, true], [1.5, true], [2.7, true], [3.9, false], [4.8, true], [6.0, true], [7.1, true], [8.3, true], [9.4, true]]
let pi = 0
for (let i = 0; i < N; i++) {
  const t = i / fps
  while (pi < proofs.length && proofs[pi][0] <= t) {
    await page.evaluate((ok) => window.__cube.proof(ok), proofs[pi][1])
    pi++
  }
  // slow camera drift: pointer moves across the logical 704×576 canvas
  const k = i / Math.max(1, N - 1)
  await page.evaluate(([x, y]) => { window.__cube.pointer = [x, y] }, [250 + 200 * (0.5 - 0.5 * Math.cos(Math.PI * k)), 300 - 20 * Math.sin(Math.PI * k)])
  await page.clock.runFor(i % 3 === 2 ? 34 : 33)
  if (!stillAt) await page.screenshot({ path: `${outdir}/f${String(i).padStart(4, '0')}.jpg`, type: 'jpeg', quality: 94 })
  else if (Math.abs(t - +stillAt) < 0.5 / fps) {
    await page.screenshot({ path: `${outdir}/still.png` })
    break
  }
}
await browser.close()
console.log('done', N)
