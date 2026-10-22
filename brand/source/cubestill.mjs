// Stills of the site's cube canvas (transparent PNG) in mining mode, several moments.
import { chromium } from 'playwright'
import fs from 'fs'
const out = process.argv[2]
fs.mkdirSync(out, { recursive: true })
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 3 })
const page = await ctx.newPage()
page.on('pageerror', (e) => console.log('pageerror', e.message))
await page.clock.install({ time: new Date('2026-10-22T09:00:00Z') })
await page.goto('http://localhost:5174/', { waitUntil: 'networkidle' })
await page.clock.runFor(1500)
await page.evaluate(() => {
  const c = window.__cube
  Object.defineProperty(c, 'degrade', { get: () => 0, set: () => {} })
  c.setVisuals('full')
  for (const L of [c.a, c.b]) Object.defineProperty(L, 'dprCap', { get: () => 3, set() {} })
  c.setMode({ hashing: true, armed: true, load: 0.8 })
  c.pointer = [380, 290]
})
await page.clock.runFor(1800)
const proofs = [[0, true], [0.9, true], [1.8, true], [2.6, true], [3.5, true], [4.4, true]]
let pi = 0
for (let i = 0; i < 160; i++) {
  const t = i / 30
  while (pi < proofs.length && proofs[pi][0] <= t) { await page.evaluate((ok) => window.__cube.proof(ok), proofs[pi][1]); pi++ }
  await page.evaluate(() => { window.__cube.pointer = [380, 290] })
  await page.clock.runFor(33)
  if (i >= 40 && i % 6 === 0) {
    const d = await page.evaluate(() => {
      const cs = [...document.querySelectorAll('.cube-layer canvas')]
      const o = document.createElement('canvas'); o.width = cs[0].width; o.height = cs[0].height
      const g = o.getContext('2d'); for (const c of cs) g.drawImage(c, 0, 0, o.width, o.height)
      return [o.width, o.height, o.toDataURL('image/png'), cs.length, cs.map((c) => c.width + 'x' + c.height).join(' ')]
    })
    fs.writeFileSync(`${out}/cube_${i}.png`, Buffer.from(d[2].split(',')[1], 'base64'))
    if (i === 60) console.log('canvas', d[0], d[1], d[3], d[4])
  }
}
await browser.close()
