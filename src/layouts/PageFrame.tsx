import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ConsoleAction, DemoChip, GlyphMeter, Odometer, Scramble, Shape } from '../components/ui'
import { CubeSlot } from '../cube/CubeSlot'
import { getCube } from '../cube/engine'
import { KEY_ORDER, SECTIONS, type SectionId } from '../data/sections'
import { useHud } from '../lib/hud'

function layerLabel(id: SectionId) {
  const l = SECTIONS[id].layer
  return l == null ? 'the core' : `layer ${l + 1} of 4`
}

function MapKey({ sec }: { sec: SectionId }) {
  return (
    <nav className="pf-key" aria-label="The cube's layers">
      <ol>
        {KEY_ORDER.map((id) => {
          const s = SECTIONS[id]
          return (
            <li key={id}>
              <Link to={s.href} viewTransition aria-current={id === sec ? 'page' : undefined}>
                <span className="g">{s.glyph}</span>
                <span className="l">{s.label}</span>
                <span className="w">{s.what}</span>
              </Link>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

function PageDock() {
  const h = useHud()
  const [a, b, c] = h.strip
  return (
    <section className="pf-dock" aria-label="Rewards and mining" data-on={h.w.address && h.m.on ? '' : undefined}>
      <div className="pf-dock-who">
        <span role="status">
          <Shape kind={h.status.mark} />
          {h.status.label}
        </span>
        <ConsoleAction to="/" quiet small>
          mining settings
        </ConsoleAction>
      </div>
      <dl className="pf-dock-figs">
        {[
          { ...a, k: 'this window' },
          { ...b, k: 'pending' },
          { ...c, k: 'paid' },
        ].map((f) => (
          <div key={f.k} data-tip={f.title ?? ''} data-tip-up="">
            <dt>{f.k}</dt>
            <dd className="v" style={f.c ? { color: f.c } : undefined}>
              {f.k === 'paid' && f.v !== '–' ? <Odometer value={f.v} /> : f.v}
            </dd>
            <dd className="u">{f.u}</dd>
          </div>
        ))}
      </dl>
      <div className="pf-dock-pay">
        <GlyphMeter value={h.pct / 100} ticks={false} signal />
        <span>
          <b>{h.pct}%</b> of {h.threshold} SOL, sent on its own
        </span>
      </div>
      <button type="button" className="mc-go" data-v={h.primary.ghost ? 'ghost' : undefined} onClick={h.primary.fn} disabled={h.primary.disabled}>
        <span key={h.primary.label}>
          {h.primary.dot ? <i aria-hidden="true" /> : null}
          {h.primary.label}
        </span>
      </button>
    </section>
  )
}

/** Thin line from the cube's top corner to the page title. */
function Leader({ frame }: { frame: React.RefObject<HTMLDivElement | null> }) {
  const [d, setD] = useState<{ path: string; end: [number, number] } | null>(null)
  useEffect(() => {
    let raf = 0
    let lastKey = ''
    const tick = () => {
      raf = requestAnimationFrame(tick)
      const f = frame.current
      const title = f?.querySelector('#page-title')
      const anc = getCube().anchor()
      if (!f || !title || !anc || innerWidth < 900) {
        if (lastKey) {
          lastKey = ''
          setD(null)
        }
        return
      }
      const fr = f.getBoundingClientRect()
      const tr = title.getBoundingClientRect()
      const sx = anc.top[0] - fr.left + 4
      const sy = anc.top[1] - fr.top - 4
      const ex = tr.left - fr.left - 10
      const ey = tr.top - fr.top + tr.height / 2
      if (tr.bottom < fr.top + 40 || ey < 30) {
        if (lastKey) {
          lastKey = ''
          setD(null)
        }
        return
      }
      const mx = ex - 18
      const key = [sx, sy, ex, ey].map((v) => Math.round(v)).join(',')
      if (key !== lastKey) {
        lastKey = key
        setD({ path: `M${sx.toFixed(1)},${sy.toFixed(1)} L${mx.toFixed(1)},${sy.toFixed(1)} L${mx.toFixed(1)},${ey.toFixed(1)} L${ex.toFixed(1)},${ey.toFixed(1)}`, end: [ex, ey] })
      }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [frame])
  return (
    <svg className="pf-leader" aria-hidden="true">
      {d ? (
        <>
          <path d={d.path} />
          <circle cx={d.end[0]} cy={d.end[1]} r="2" />
        </>
      ) : null}
    </svg>
  )
}

export function PageFrame({ sec, title, lede, children }: { sec: SectionId; title: string; lede: string; children: ReactNode }) {
  const frame = useRef<HTMLDivElement>(null)
  const s = SECTIONS[sec]
  return (
    <div className="pf" ref={frame} data-sheet={sec}>
      <aside className="pf-map" aria-label="Map and miner">
        <div className="mc-head pf-map-head">
          <span>map</span>
          <span className="dim">{layerLabel(sec)}</span>
        </div>
        <CubeSlot className="pf-viz" />
        <MapKey sec={sec} />
        <PageDock />
      </aside>
      <div className="pf-main">
        <div className="mc-head pf-main-head">
          <span>
            {s.label.toLowerCase()} <i className="dim">{layerLabel(sec)}</i>
          </span>
          <span className="live-chip" role="status">
            <Shape kind="live" />
            live
            <DemoChip />
          </span>
        </div>
        <div className="pf-page">
          <header className="pf-title">
            <h1 id="page-title">
              <Scramble text={title} />
            </h1>
            <p>{lede}</p>
          </header>
          <div className="pg">{children}</div>
        </div>
      </div>
      <Leader frame={frame} />
    </div>
  )
}

/** Sticky numbered section ruler with scroll-spy. */
export function Ruler({ items }: { items: { id: string; label: string }[] }) {
  const [cur, setCur] = useState(items[0]?.id)
  const lock = useRef(0)
  useEffect(() => {
    const els = items.map((i) => document.getElementById(i.id)).filter(Boolean) as HTMLElement[]
    const io = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (vis[0] && performance.now() > lock.current) setCur(vis[0].target.id)
      },
      { rootMargin: '-20% 0px -60% 0px' },
    )
    els.forEach((e) => io.observe(e))
    return () => io.disconnect()
  }, [items])
  return (
    <nav className="ruler" aria-label="Sections">
      <ol>
        {items.map((i) => (
          <li key={i.id}>
            <a
              href={`#${i.id}`}
              aria-current={cur === i.id ? 'location' : undefined}
              onClick={(e) => {
                e.preventDefault()
                document.getElementById(i.id)?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' })
                lock.current = performance.now() + 1200
                setCur(i.id)
              }}
            >
              {i.label}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  )
}
