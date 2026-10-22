import { memo, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { BRAND, DEMO } from '../config/brand'
import type { Shape as ShapeKind } from '../sim/network'

export function Shape({ kind }: { kind: ShapeKind | 'live' }) {
  return (
    <i className="sh" data-k={kind} aria-hidden="true">
      {kind === 'error' ? '×' : null}
    </i>
  )
}

/** Brand mark: an isometric cube split into a 2×2×2 lattice with one lit cell. */
export function Logo({ size = 20 }: { size?: number }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden="true">
      <path d="M16 2.5 28 9.25v13.5L16 29.5 4 22.75V9.25Z" fill="#14171b" stroke="#2a2e35" strokeWidth="1" />
      <path d="M16 2.5 28 9.25 16 16 4 9.25Z" fill="#20252b" />
      <path d="M4 9.25 16 16v13.5L4 22.75Z" fill="#14181c" />
      <path d="M28 9.25 16 16v13.5l12-6.75Z" fill="#0d1013" />
      <path d="M16 9.25 22 12.625 16 16 10 12.625Z" fill="var(--acc, #7fd6f7)" />
      <path d="M10 12.625 16 16v6.75l-6-3.375Z" fill="#3c7f99" />
      <path d="M22 12.625 16 16v6.75l6-3.375Z" fill="#245466" />
      <path d="M16 2.5v6.75M4 9.25l6 3.375M28 9.25l-6 3.375M16 16v13.5M4 16l6 3.375M28 16l-6 3.375M10 5.875 22 12.625M22 5.875 10 12.625" stroke="#07090b" strokeWidth=".7" opacity=".55" />
    </svg>
  )
}

export function XIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}

const Arrow = () => (
  <svg viewBox="0 0 10 8" aria-hidden="true">
    <path d="M4.452.386h1.573L9.301 4 6.025 7.614H4.452l2.951-3.029H.695V3.428h6.721L4.452.386Z" fill="currentColor" />
  </svg>
)

export function ConsoleAction({ to, children, quiet, small }: { to: string; children: ReactNode; quiet?: boolean; small?: boolean }) {
  return (
    <Link className="cb-action" to={to} viewTransition data-v={quiet ? 'quiet' : undefined} data-size={small ? 'sm' : undefined}>
      <span className="cb-action-fill" aria-hidden="true" />
      <span className="cb-action-mask">
        <span className="cb-action-label">{children}</span>
      </span>
      <span className="cb-action-icon" aria-hidden="true">
        <span className="cb-action-tile" />
        <span className="cb-action-track">
          <Arrow />
          <Arrow />
        </span>
      </span>
    </Link>
  )
}

const HEX = '0123456789abcdef'

/** A row of hex digits used as a gauge: lit up to `value` (0..1). */
export const GlyphMeter = memo(function GlyphMeter({ value, cells = 16, signal, ticks = true }: { value: number; cells?: number; signal?: boolean; ticks?: boolean }) {
  const lit = Math.max(0, Math.min(cells, Math.round(value * cells)))
  return (
    <span className={`gm${ticks ? ' ticks' : ''}`} style={{ ['--gm-n' as string]: cells }} aria-hidden="true">
      {Array.from({ length: cells }, (_, i) => (
        <i key={i} data-on={i < lit ? '' : undefined} data-head={i === lit - 1 ? (signal ? 'signal' : '') : undefined}>
          {HEX[i % 16]}
        </i>
      ))}
    </span>
  )
})

export function SplitMeter({ parts, cells = 16 }: { parts: { share: number; tone: 'bone' | 'dim' | 'faint' }[]; cells?: number }) {
  const out: { tone: string; cut: boolean }[] = []
  let acc = 0
  parts.forEach((p, pi) => {
    const n = pi === parts.length - 1 ? cells - out.length : Math.round(((acc + p.share) / 100) * cells) - out.length
    for (let i = 0; i < n; i++) out.push({ tone: p.tone, cut: i === 0 && pi > 0 })
    acc += p.share
  })
  return (
    <span className="gm gm-split" style={{ ['--gm-n' as string]: cells }} aria-hidden="true">
      {out.map((c, i) => (
        <i key={i} data-on="" data-tone={c.tone} data-cut={c.cut ? '' : undefined}>
          {HEX[i % 16]}
        </i>
      ))}
    </span>
  )
}

/** Value that rolls when it changes (live = animate). */
export function LiveValue({ value, live = true }: { value: string; live?: boolean }) {
  const [state, setState] = useState({ cur: value, prev: null as string | null, key: 0 })
  if (value !== state.cur) setState((s) => ({ cur: value, prev: live ? s.cur : null, key: s.key + 1 }))
  return (
    <span className="lv lv-d">
      <span key={state.key} className={state.prev != null ? 'lv-in' : undefined}>
        {state.cur}
      </span>
      {state.prev != null ? (
        <span key={`o${state.key}`} className="lv-out" aria-hidden="true">
          {state.prev}
        </span>
      ) : null}
    </span>
  )
}

/** Rolling digits, like an odometer. */
export function Odometer({ value }: { value: string }) {
  const [lit, setLit] = useState(false)
  const prev = useRef(value)
  useEffect(() => {
    if (prev.current !== value) {
      prev.current = value
      setLit(true)
      const t = setTimeout(() => setLit(false), 700)
      return () => clearTimeout(t)
    }
  }, [value])
  return (
    <span className="odo" aria-label={value} role="img" data-lit={lit ? '' : undefined}>
      {[...value].map((ch, i) =>
        /\d/.test(ch) ? (
          <span key={i} className="odo-w" aria-hidden="true">
            <span className="odo-s" style={{ transform: `translateY(-${Number(ch) * 10}%)` }}>
              {'0123456789'.split('').map((d) => (
                <span key={d}>{d}</span>
              ))}
            </span>
          </span>
        ) : (
          <span key={i} aria-hidden="true">
            {ch}
          </span>
        ),
      )}
    </span>
  )
}

/** Title that resolves out of random hex digits. */
export function Scramble({ text }: { text: string }) {
  const [shown, setShown] = useState<string | null>(() => [...text].map((c, i) => (c === ' ' ? c : HEX[(7 * c.charCodeAt(0) + 5 * i) % 16])).join(''))
  useEffect(() => {
    let raf = 0
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      raf = requestAnimationFrame(() => setShown(null))
      return () => cancelAnimationFrame(raf)
    }
    const t0 = performance.now()
    const tick = (now: number) => {
      const k = (now - t0) / 420
      if (k >= 1) {
        setShown(null)
        return
      }
      let s = ''
      for (let i = 0; i < text.length; i++) s += text[i] === ' ' || k >= (i + 1) / (text.length + 1) ? text[i] : HEX[(Math.random() * 16) | 0]
      setShown(s)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [text])
  return (
    <span aria-label={text}>
      <span aria-hidden="true">{shown ?? text}</span>
    </span>
  )
}

export function MetricRow({ label, value, unit, hint, tone, wide }: { label: string; value: ReactNode; unit?: string; hint?: string; tone?: 'dim' | 'acc'; wide?: boolean }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  return (
    <div className={wide ? 'metric wide' : 'metric'}>
      <span>
        {label}
        {hint ? (
          <button type="button" className="q" aria-label={`About ${label}`} aria-expanded={open} aria-describedby={id} onClick={() => setOpen((v) => !v)} onBlur={() => setOpen(false)}>
            ?
          </button>
        ) : null}
      </span>
      <span className="val" data-tone={tone}>
        {value}
      </span>
      <span className="unit">{unit}</span>
      {hint ? (
        <div role="tooltip" id={id} className="tip">
          {hint}
        </div>
      ) : null}
    </div>
  )
}

export interface SegOption { label: string; on: boolean; fn: () => void; disabled?: boolean; title?: string }
export function Seg({ label, options, labelWidth, bare }: { label?: string; options: SegOption[]; labelWidth?: string; bare?: boolean }) {
  return (
    <div role="group" aria-label={label} className={bare ? 'seg bare' : 'seg'} style={labelWidth ? ({ ['--seg-label' as string]: labelWidth } as React.CSSProperties) : undefined}>
      {label && !bare ? <span>{label}</span> : null}
      <div>
        {options.map((o) => (
          <button key={o.label} type="button" aria-pressed={o.on} disabled={o.disabled} title={o.title} onClick={o.fn}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export function InlineStatus({ title, sub, tone = 'info' }: { title: ReactNode; sub?: ReactNode; tone?: 'info' | 'warn' | 'ok' | 'error' }) {
  return (
    <div role="status" className="inline-status" data-tone={tone}>
      <Shape kind={tone === 'ok' ? 'chain' : tone} />
      <span>
        <span className="t">{title}</span>
        {sub ? <span className="s">{sub}</span> : null}
      </span>
    </div>
  )
}

/** A signature / address. Real ones link to the explorer; demo ones are plain text. `real` = always link (config addresses). */
export function ChainLink({ value, short, kind = 'tx', real }: { value: string; short: string; kind?: 'tx' | 'account' | 'token'; real?: boolean }) {
  if ((DEMO && !real) || !value) return <span className="sig" title={value}>{short}</span>
  return (
    <a href={`${BRAND.explorer}/${kind}/${value}`} target="_blank" rel="noopener noreferrer" title={value}>
      {short}
    </a>
  )
}

export function Disclosure({ label, rows }: { label: string; rows: { k: string; v: string }[] }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="disclosure">
      <div>
        <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          <span aria-hidden="true">{open ? '−' : '+'}</span>
          {label}
        </button>
      </div>
      {open ? (
        <dl>
          {rows.map((r) => (
            <div key={r.k}>
              <dt>{r.k}</dt>
              <dd>{r.v}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  )
}

export function Sparkline({ values }: { values: number[] }) {
  const id = useId().replace(/:/g, '')
  const n = values.length
  const max = n ? Math.max(...values) : 0
  const min = n ? Math.min(...values) : 0
  const x = (i: number) => ((60 - n + i) / 59) * 100
  const y = (v: number) => (max > min ? 84 - ((v - min) / (max - min)) * 68 : 50)
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(2)},${y(v).toFixed(2)}`).join('')
  const last = n ? values[n - 1] : 0
  return (
    <span className="spark" aria-hidden="true">
      {n > 1 ? (
        <svg viewBox="0 0 100 100" preserveAspectRatio="none">
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="currentColor" stopOpacity="0.14" />
              <stop offset="1" stopColor="currentColor" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={`${d}L100,100L${x(0).toFixed(2)},100Z`} fill={`url(#${id})`} />
          <path className="l" d={d} vectorEffect="non-scaling-stroke" />
        </svg>
      ) : null}
      {n ? <i style={{ bottom: `${100 - y(last)}%` }} /> : null}
    </span>
  )
}

export function DemoChip() {
  if (!DEMO) return null
  return (
    <em className="demo-chip" data-tip="Network figures are simulated in this build. Your own mining is real." data-tip-end="">
      demo
    </em>
  )
}
