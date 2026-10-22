// Ordered-dither texture behind the side columns and as a burst behind fresh numbers.
// Rendered once to a data URL and cached, so it costs nothing per frame.
import { useEffect, useState } from 'react'
import { bus } from '../lib/bus'

const cache = new Map<string, string>()
const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]

function noise2(x: number, y: number) {
  // smooth value noise from a few sines — enough for a soft cloud field
  return (
    0.5 +
    0.25 * Math.sin(x * 0.021 + Math.sin(y * 0.013) * 2.1) +
    0.15 * Math.sin(y * 0.034 + x * 0.008 + 1.7) +
    0.1 * Math.sin((x + y) * 0.051 + 0.4)
  )
}

function render(kind: 'l' | 'r' | 'burst', w: number, h: number): string {
  const cv = document.createElement('canvas')
  cv.width = w
  cv.height = h
  const g = cv.getContext('2d')
  if (!g) return ''
  const img = g.createImageData(w, h)
  const px = 2
  for (let y = 0; y < h; y += px)
    for (let x = 0; x < w; x += px) {
      let v: number
      if (kind === 'burst') {
        const dx = x - w / 2
        const dy = y - h / 2
        const d = Math.sqrt(dx * dx + dy * dy) / (Math.min(w, h) / 2)
        v = 0.5 + 0.5 * Math.sin(Math.pow(d, 1.7) * 7 - 1.2)
      } else v = noise2(x, y + (kind === 'r' ? 400 : 0))
      const th = (BAYER4[((y / px) % 4) * 4 + ((x / px) % 4)] + 0.5) / 16
      if (v > th + 0.12) {
        for (let yy = 0; yy < px; yy++)
          for (let xx = 0; xx < px; xx++) {
            const i = ((y + yy) * w + x + xx) * 4
            img.data[i] = 231
            img.data[i + 1] = 237
            img.data[i + 2] = 242
            img.data[i + 3] = 255
          }
      }
    }
  g.putImageData(img, 0, 0)
  g.globalCompositeOperation = 'destination-in'
  if (kind === 'burst') {
    const r = Math.min(w, h) / 2
    const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, r)
    gr.addColorStop(0.3, 'rgba(0,0,0,1)')
    gr.addColorStop(1, 'rgba(0,0,0,0)')
    g.fillStyle = gr
  } else {
    const gr = g.createLinearGradient(kind === 'l' ? w : 0, 0, kind === 'l' ? 0 : w, 0)
    gr.addColorStop(0, 'rgba(0,0,0,0.16)')
    gr.addColorStop(0.45, 'rgba(0,0,0,0.056)')
    gr.addColorStop(0.85, 'rgba(0,0,0,0)')
    g.fillStyle = gr
  }
  g.fillRect(0, 0, w, h)
  return cv.toDataURL('image/png')
}

function useTexture(kind: 'l' | 'r' | 'burst') {
  const [url, setUrl] = useState(() => cache.get(kind) ?? null)
  useEffect(() => {
    if (url) return
    const id = requestIdleCallbackSafe(() => {
      const u = kind === 'burst' ? render(kind, 240, 120) : render(kind, 360, 960)
      cache.set(kind, u)
      setUrl(u)
    })
    return () => cancelIdle(id)
  }, [kind, url])
  return url
}

const hasIdle = typeof (window as { requestIdleCallback?: unknown }).requestIdleCallback === 'function'
const requestIdleCallbackSafe = (fn: () => void): number => (hasIdle ? window.requestIdleCallback(fn) : window.setTimeout(fn, 60))
const cancelIdle = (id: number) => (hasIdle ? window.cancelIdleCallback(id) : window.clearTimeout(id))

export function Shade({ side }: { side: 'l' | 'r' }) {
  const url = useTexture(side)
  return <div className="cb-shade" aria-hidden="true" style={url ? { backgroundImage: `url(${url})` } : undefined} />
}

/** Dithered ripple that flashes behind a block when an event fires (or `pulseKey` changes). */
export function Burst({ on, pulseKey }: { on?: 'merge' | 'fee'; pulseKey?: string | number | null }) {
  const url = useTexture('burst')
  const [n, setN] = useState(0)
  const [lastKey, setLastKey] = useState(pulseKey)
  if (pulseKey !== lastKey) {
    setLastKey(pulseKey)
    if (lastKey != null && pulseKey != null) setN((x) => x + 1)
  }
  useEffect(() => {
    if (!on) return
    return bus.on((e) => {
      if (e.type === on) setN((x) => x + 1)
    })
  }, [on])
  if (!url || !n) return <div className="cb-burst" aria-hidden="true" />
  return <div key={n} className="cb-burst" data-on="" aria-hidden="true" style={{ backgroundImage: `url(${url})` }} />
}
