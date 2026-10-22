import { memo, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BRAND, DEMO, ECON } from '../config/brand'
import { Flows } from '../components/Flows'
import { Burst, Shade } from '../components/Shade'
import { ChainLink, ConsoleAction, DemoChip, Disclosure, GlyphMeter, InlineStatus, LiveValue, MetricRow, Seg, Shape, Sparkline, SplitMeter } from '../components/ui'
import { CubeSlot, useVisuals } from '../cube/CubeSlot'
import { SECTIONS } from '../data/sections'
import { ago, bps, clock, count, hashRate, hashesShort, shortAddr, sol } from '../lib/format'
import { useMedia, useNow } from '../lib/hooks'
import { useHud, type Fig } from '../lib/hud'
import { useStore } from '../lib/store'
import { MINER_INFO, miner, setLoad, type Load } from '../miner/miner'
import { net } from '../sim/network'

const IDLE16 = '·'.repeat(16)
const TICKER = BRAND.ticker

function CA() {
  const [copied, setCopied] = useState(false)
  if (!BRAND.mint) return null
  const m = BRAND.mint
  return (
    <button
      type="button"
      className="mc-ca"
      title={m}
      aria-label={`Copy contract address ${m}`}
      onClick={() =>
        navigator.clipboard?.writeText(m).then(() => {
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        })
      }
    >
      <span>{copied ? 'copied' : 'ca'}</span>
      <b>{`${m.slice(0, 6)}…${m.slice(-4)}`}</b>
    </button>
  )
}

// ── left column (no wallet): how to mine ────────────────────
function Ladder() {
  const rows = Math.min(10, Math.ceil(ECON.walletCapBps / ECON.capPerUnitBps))
  return (
    <div className="mc-block mc-ladder">
      <h3>
        <span>cap per window</span>
        <span>share of the pool</span>
      </h3>
      <ol>
        {Array.from({ length: rows }, (_, i) => {
          const u = i + 1
          const cap = Math.min(ECON.walletCapBps, u * ECON.capPerUnitBps)
          return (
            <li key={u}>
              <span className="t">
                {u} {u === 1 ? 'unit' : 'units'}
              </span>
              <GlyphMeter value={cap / ECON.walletCapBps} cells={3 * rows} ticks={false} />
              <span className="r">{bps(cap)}</span>
            </li>
          )
        })}
      </ol>
      <p className="mc-note">Holding more raises the cap, never the hash rate.</p>
    </div>
  )
}

function Split() {
  const m = ECON.minerShareBps / 100
  const b = ECON.burnShareBps / 100
  const i = 100 - m - b
  return (
    <div className="mc-block mc-split">
      <h3>
        <span>where the SOL comes from</span>
        <span>per fee claim</span>
      </h3>
      <SplitMeter parts={[{ share: m, tone: 'bone' }, { share: b, tone: 'dim' }, { share: i, tone: 'faint' }]} />
      <ul className="split-list">
        <li data-tone="bone"><b>{m}%</b> miners</li>
        <li data-tone="dim"><b>{b}%</b> buyback and burn</li>
        <li data-tone="faint"><b>{i}%</b> infra</li>
      </ul>
      <p className="mc-note">Only pump.fun creator fees already collected, split on chain.</p>
    </div>
  )
}

function GuideCol() {
  const t = sol(ECON.payoutThresholdLamports, 2)
  return (
    <section className="mc-col mc-guide" aria-label="How to mine">
      <Shade side="l" />
      <div className="mc-head">
        <span>how to mine</span>
        <span className="dim">3 steps</span>
      </div>
      <div className="mc-body">
        <ol className="mc-steps">
          <li>
            <b>Connect a Solana wallet.</b>
            <span>Address only: no signature, no transaction.</span>
          </li>
          <li>
            <b>Hold one unit of {TICKER}.</b>
            <span>
              One unit is {count(ECON.holdUnitTokens)} {TICKER}, priced in SOL, and it halves as the price climbs. Each unit adds {bps(ECON.capPerUnitBps)} to your cap, up to {bps(ECON.walletCapBps)}.
            </span>
          </li>
          <li>
            <b>Start mining in this tab.</b>
            <span>Your CPU does the hashing. Payouts send on their own at {t} SOL.</span>
          </li>
        </ol>
        <Ladder />
        <Split />
      </div>
      <div className="mc-foot">
        <ConsoleAction to={SECTIONS.protocol.href}>Protocol</ConsoleAction>
        <span className="dim">Mining is free</span>
      </div>
    </section>
  )
}

// ── left column (wallet): your rig ──────────────────────────
function HashTape() {
  const m = useStore(miner)
  const short = useMedia('(min-width: 900px) and (max-height: 1100px)')
  const [rows, setRows] = useState<{ hex: string; bits: number }[]>([])
  const [best, setBest] = useState<{ hex: string; bits: number } | null>(null)
  const [ticket, setTicket] = useState<string | null>(null)
  const running = m.on && m.status === 'running'
  useEffect(() => {
    if (!m.sample || !running) return
    const tid = m.ticket?.id ?? null
    setRows((r) => {
      const seen = new Set(r.map((x) => x.hex))
      const fresh = m.sample!.filter((x) => !seen.has(x.hex)).reverse()
      return [...fresh, ...r].slice(0, 8)
    })
    setBest((b) => {
      let o = ticket === tid ? b : null
      for (const s of m.sample!) if (!o || s.bits > o.bits) o = s
      return o
    })
    setTicket(tid)
  }, [m.sample]) // eslint-disable-line react-hooks/exhaustive-deps
  const d = m.ticket?.difficulty ?? 0
  const lead = (x: { bits: number }) => Math.floor(x.bits / 4)
  const Hex = ({ hex, l }: { hex: string; l: number }) => (
    <span className="cb-hex">
      {l ? <b>{hex.slice(0, l)}</b> : null}
      {hex.slice(l)}
    </span>
  )
  return (
    <div className="mc-block">
      <h3>
        <span>hashes · sampled</span>
        <span>{d ? `best ${best ? best.bits : '–'} · target ${d} bits` : 'no ticket'}</span>
      </h3>
      <div className="cb-best" data-idle={best ? undefined : ''} data-tip="The most leading zero bits among the hashes this panel sampled for the current ticket. The miner tries far more hashes than it samples.">
        <Hex hex={best ? best.hex : IDLE16} l={best ? lead(best) : 0} />
        <span className="b">{best ? best.bits : ''}</span>
      </div>
      {d ? (
        <span className="cb-bits" style={{ ['--n' as string]: d }} aria-hidden="true">
          {Array.from({ length: d }, (_, i) => (
            <i key={i} data-on={best && i < best.bits ? '' : undefined} data-goal={i === d - 1 ? '' : undefined} />
          ))}
        </span>
      ) : null}
      <ol className="cb-tape" data-live={running ? '' : undefined}>
        {Array.from({ length: short ? 3 : 8 }, (_, i) => {
          const r = rows[i]
          return r ? (
            <li key={r.hex}>
              <Hex hex={r.hex} l={lead(r)} />
              <span className="b">{r.bits}</span>
            </li>
          ) : (
            <li key={`idle-${i}`} data-idle="">
              <Hex hex={IDLE16} l={0} />
              <span className="b" />
            </li>
          )
        })}
      </ol>
    </div>
  )
}

function ProofMarks() {
  const m = useStore(miner)
  const [pulse, setPulse] = useState(-1)
  useEffect(() => {
    if (!m.accepted) return
    setPulse(m.accepted)
    const t = setTimeout(() => setPulse(-1), 700)
    return () => clearTimeout(t)
  }, [m.accepted])
  const marks = [...Array(Math.min(m.accepted, 96)).fill(true), ...Array(Math.min(m.rejected, 24)).fill(false)]
  const extra = m.accepted + m.rejected - marks.length
  return (
    <div className="mc-block">
      <h3>
        <span>proofs</span>
        <span data-tip="This window, this tab." data-tip-end="">
          <b>{m.accepted}</b> credited · <b>{m.rejected}</b> rejected
        </span>
      </h3>
      <Link to="/ledger?show=tab" viewTransition className="cb-proofs" aria-label={`${m.accepted} proofs credited and ${m.rejected} rejected in this window. Open the ledger.`}>
        {extra > 0 ? <span className="more">+{extra}</span> : null}
        {marks.length === 0 ? <span className="none">No proofs yet in this window.</span> : null}
        {marks.map((ok, i) => (
          <i key={i} data-ok={ok ? '' : undefined} data-pulse={ok && i === m.accepted - 1 && pulse === m.accepted ? '' : undefined} />
        ))}
      </Link>
    </div>
  )
}

function ShareBar() {
  const st = useStore(net)
  const you = st.you
  const work = you?.workNow ?? 0
  const share = work > 0 ? Math.round((work / (st.current.work + work)) * 10000) : 0
  const cap = you?.capBps ?? 0
  const max = Math.max(ECON.walletCapBps, share, cap, 1)
  const pct = (b: number) => `${Math.min(100, (b / max) * 100)}%`
  const paid = Math.min(share, cap)
  const over = share > cap
  return (
    <div className="mc-block">
      <h3>
        <span data-tip="Your share of this window's work, and the most of the pool your holding lets you take.">share of work · cap</span>
        <span>
          <b>{you ? bps(share) : '–'}</b> of <b>{you ? bps(cap) : '–'}</b>
        </span>
      </h3>
      <span className="cb-share" aria-hidden="true">
        <span className="f" style={{ transform: `scaleX(${Math.min(1, paid / max)})` }} />
        {over ? <span className="o" style={{ left: pct(paid), width: `calc(${pct(share)} - ${pct(paid)})` }} /> : null}
        {you ? <span className="cap" style={{ left: pct(cap) }} /> : null}
      </span>
      {over ? <p className="mc-note">Work above the cap is not paid this window.</p> : null}
    </div>
  )
}

const HashRate = memo(function HashRate() {
  const m = useStore(miner)
  const [hist, setHist] = useState<number[]>([])
  const running = m.on && m.status === 'running'
  useEffect(() => {
    if (!running) return
    const id = setInterval(() => setHist((h) => [...h, miner.get().hashRate].slice(-60)), 1000)
    return () => clearInterval(id)
  }, [running])
  const r = hashRate(running ? m.hashRate : 0)
  return (
    <div className="mc-block mc-live" data-live={running ? '' : undefined}>
      <h3>
        <span>hash rate</span>
        <span data-tip-end="" data-tip="Hashes tried this session in this tab. The trace is the last 60 seconds, one sample a second.">
          ~{hashesShort(m.sessionHashes)} hashed
        </span>
      </h3>
      <div className="cb-rate">
        <span className="v">
          <LiveValue value={r.v} live={false} />
          <small>{r.u}</small>
        </span>
        <Sparkline values={hist} />
      </div>
    </div>
  )
})

function Events() {
  const m = useStore(miner)
  const lines = m.log.slice(-5).reverse()
  return (
    <div className="mc-block">
      <h3>
        <span>events · this tab</span>
        <ConsoleAction to="/ledger?show=tab" quiet small>
          ledger
        </ConsoleAction>
      </h3>
      <ol className="cb-feed" role="log" aria-live="polite" aria-relevant="additions">
        {lines.length === 0 ? <li data-idle="">No events yet.</li> : null}
        {lines.map((e, i) => (
          <li key={`${e.time}${e.text}${m.log.length - i}`} data-tone={e.tone} data-new={i === 0 ? '' : undefined}>
            <span>{e.time}</span>
            <span title={e.text}>{e.text}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}

const VIS = [
  { v: 'auto', label: 'Auto', title: 'Full, or Lite on a modest machine.' },
  { v: 'full', label: 'Full', title: 'Every effect.' },
  { v: 'lite', label: 'Lite', title: 'No bloom, fewer glyphs, a lower frame rate.' },
  { v: 'off', label: 'Off', title: 'The cube is not drawn.' },
] as const

function Controls() {
  const m = useStore(miner)
  const [vis, setVis] = useVisuals()
  const loads: Load[] = [0.25, 0.5, 0.75, 1]
  const gpu = 'gpu' in navigator
  return (
    <div className="mc-controls">
      <Seg
        label="device"
        labelWidth="4rem"
        options={[
          { label: 'CPU', on: true, fn: () => undefined },
          { label: 'GPU', on: false, fn: () => undefined, disabled: true, title: gpu ? 'WebGPU miner is in beta and switched off in this build.' : 'This browser has no WebGPU.' },
        ]}
      />
      <Seg label="cpu load" labelWidth="4rem" options={loads.map((l) => ({ label: `${l * 100}%`, on: m.load === l, fn: () => setLoad(l), title: `${MINER_INFO.threadsFor(l)} of ${MINER_INFO.cores()} threads` }))} />
      <Seg label="visuals" labelWidth="4rem" options={VIS.map((x) => ({ label: x.label, title: x.title, on: vis === x.v, fn: () => setVis(x.v) }))} />
      <p className="mc-note mc-gpu-note mc-visuals-note">The cube shares this machine with the miner. Lite and Off give hash rate back.</p>
    </div>
  )
}

function Notices() {
  const h = useHud()
  const out = []
  if (h.m.selfTest === false) out.push(<InlineStatus key="st" tone="error" title="SHA-256 self-test failed" sub="This browser computed a different hash than WebCrypto. Mining is unsafe here." />)
  if (h.m.error) out.push(<InlineStatus key="er" tone="error" title={h.m.error} sub="Press Start mining to try again." />)
  if (h.w.holding.status === 'short')
    out.push(
      <InlineStatus
        key="short"
        tone="warn"
        title={`Hold one unit of ${TICKER} to mine`}
        sub={
          <>
            You hold <b>{count(h.w.holding.balance ?? 0)}</b> of <b>{count(ECON.holdUnitTokens)}</b> {TICKER}.
          </>
        }
      />,
    )
  else if (h.w.holding.status === 'demo') out.push(<InlineStatus key="demo" tone="info" title="Holding check runs at launch" sub={`Until the mint is set, this tab mines at a ${bps(h.w.holding.capBps)} cap.`} />)
  else if (h.w.holding.status === 'unknown') out.push(<InlineStatus key="unk" tone="warn" title="Balance read failed" sub="Credit pauses until the next read succeeds." />)
  if (DEMO && h.you && h.you.pending >= ECON.payoutThresholdLamports)
    out.push(<InlineStatus key="pay" tone="ok" title={`Payout threshold reached · ${sol(h.you.pending, 4)} SOL`} sub="This build does not send SOL yet. Once the backend is live, the reward wallet sends it on its own." />)
  return <>{out}</>
}

function MoreBlock() {
  const [open, setOpen] = useState(false)
  const h = useHud()
  const m = h.m
  return (
    <div className="mc-block mc-more">
      <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span>holding, balance, ticket</span>
        <span aria-hidden="true">{open ? '−' : '+'}</span>
      </button>
      {open ? (
        <>
          <div className="metric-rows">
            <MetricRow label="Holding" value={h.w.holding.status === 'demo' ? 'demo' : h.w.holding.balance != null ? count(h.w.holding.balance) : '–'} unit={BRAND.symbol} hint="Read from chain once the mint is set." />
            <MetricRow label="Units" value={String(h.w.holding.units)} hint={`One unit is ${count(ECON.holdUnitTokens)} ${TICKER}.`} />
            <MetricRow label="Cap" value={bps(h.w.holding.capBps)} hint="The most of a window's pool this wallet can take." />
          </div>
          <Disclosure
            label="Technical details"
            rows={[
              { k: 'Ticket', v: m.ticket ? m.ticket.id : '–' },
              { k: 'Target', v: m.ticket ? `${m.ticket.difficulty} bits` : '–' },
              { k: 'Credit / proof', v: m.ticket ? `2^${m.ticket.difficulty} hashes` : '–' },
              { k: 'Threads', v: String(m.threads) },
              { k: 'Self-test', v: m.selfTest == null ? '–' : m.selfTest ? 'SHA-256 ok' : 'failed' },
              { k: 'Proofs total', v: String(m.acceptedTotal) },
            ]}
          />
        </>
      ) : null}
    </div>
  )
}

function RigCol() {
  const h = useHud()
  return (
    <section className="mc-col mc-guide mc-rig" aria-label="Your rig">
      <Shade side="l" />
      <div className="mc-head">
        <span>your rig</span>
        <span className="mono" title={h.w.address ?? ''}>
          {shortAddr(h.w.address)}
        </span>
      </div>
      <div className="mc-body">
        <Controls />
        <Notices />
        <HashRate />
        <HashTape />
        <ProofMarks />
        <ShareBar />
        <Events />
        <MoreBlock />
      </div>
      <div className="mc-foot">
        <ConsoleAction to={SECTIONS.rewards.href}>Rewards</ConsoleAction>
        <ConsoleAction to={SECTIONS.protocol.href} quiet>
          Protocol
        </ConsoleAction>
      </div>
    </section>
  )
}

// ── right column: network ───────────────────────────────────
function NetCol({ live }: { live: boolean }) {
  const st = useStore(net)
  const now = useNow(1000)
  const cur = st.current
  const r = hashRate(st.live.workPerSec)
  const regs = [
    { k: 'pool pace', v: cur.funding ? 'funding' : sol(st.live.poolPerMin, 4), u: cur.funding ? 'not paying' : 'SOL/min' },
    { k: 'miners', v: String(st.live.miners), u: 'active, last min' },
    { k: 'network rate', v: r.v, u: r.u },
    { k: 'proofs', v: String(st.live.proofsPerMin), u: 'per min' },
  ]
  const left = Math.max(0, cur.closesAt - now)
  const frac = 1 - left / (cur.closesAt - cur.opensAt)
  const rounds = st.rounds.slice(0, 4)
  const fees = st.receipts.slice(0, 3)
  return (
    <section className="mc-col mc-net" aria-label="Network">
      <Shade side="r" />
      <div className="mc-head">
        <span>network</span>
        <span role="status">
          <Shape kind="chain" />
          Live
          <DemoChip />
        </span>
      </div>
      <div className="mc-body">
        <dl className="mc-regs" data-flow="network">
          {regs.map((x) => (
            <div key={x.k}>
              <dt>{x.k}</dt>
              <dd className="v">
                <LiveValue value={x.v} live={live} />
              </dd>
              <dd className="u">{x.u}</dd>
            </div>
          ))}
        </dl>
        <div className="mc-block">
          <h3>
            <span>
              window <b>#{cur.round}</b>
            </span>
            <span>
              <b>{clock(left)}</b> left
            </span>
          </h3>
          <GlyphMeter value={frac} />
          <p className="mc-note">
            <span>{cur.funding ? 'pool funding' : <>pool <LiveValue value={sol(cur.poolLamports, 4)} live={live} /> SOL</>}</span>
            <span>pays by credited work</span>
          </p>
        </div>
        <div className="mc-block mc-fees">
          <Burst pulseKey={fees[0]?.sig ?? null} />
          <h3>
            <span>creator fees in</span>
            <span>on chain</span>
          </h3>
          {fees.length === 0 ? <span className="mc-empty">No creator fees received yet.</span> : null}
          <ul className="mc-tape" data-live="">
            {fees.map((f) => (
              <li key={f.sig}>
                <span className="t">{ago(f.at, now)}</span>
                <ChainLink value={f.sig} short={shortAddr(f.sig)} />
                <span className="r">+{sol(f.lamports, 4)}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="mc-block">
          <h3>
            <span>last windows</span>
            <span>pool, SOL</span>
          </h3>
          {rounds.length === 0 ? <span className="mc-empty">No settled windows yet.</span> : null}
          {rounds.map((w) => (
            <Link key={w.round} to={SECTIONS.ledger.href} viewTransition className="mc-win">
              <span className="t">#{w.round}</span>
              <span className="s">
                {w.miners} miners · {hashesShort(w.work)}
              </span>
              <span className="r">{w.funding ? 'funding' : sol(w.poolLamports, 4)}</span>
            </Link>
          ))}
        </div>
      </div>
      <div className="mc-foot">
        <ConsoleAction to={SECTIONS.miners.href}>Leaderboard</ConsoleAction>
        <ConsoleAction to={SECTIONS.vault.href} quiet>
          Vault
        </ConsoleAction>
      </div>
    </section>
  )
}

// ── dock under the cube ─────────────────────────────────────
function DockFig({ k, f, live, burst, meter }: { k: string; f: Fig; live: boolean; burst?: boolean; meter?: number }) {
  return (
    <div data-tip={f.title ?? ''} data-tip-up="">
      {burst ? <Burst on="merge" /> : null}
      <dt>{k}</dt>
      <dd className="v" style={f.c ? { color: f.c } : undefined}>
        <LiveValue value={f.v} live={live} />
      </dd>
      {meter != null ? (
        <dd className="m">
          <GlyphMeter value={meter / 100} signal ticks={false} />
        </dd>
      ) : (
        <dd className="u">{f.u}</dd>
      )}
    </div>
  )
}

function Dock() {
  const h = useHud()
  const [a, b, c] = h.strip
  const live = h.hashing
  return (
    <div className="mc-dock" data-flow="wallet" data-wallet={h.w.address ? '' : undefined} data-on={h.w.address && h.m.on ? '' : undefined}>
      {h.w.address ? (
        <>
          <dl className="mc-figs" data-side="l">
            <DockFig k="this window" f={a} live={live} burst />
            <DockFig k="pending" f={b} live={live} />
          </dl>
          <dl className="mc-figs" data-side="r">
            <DockFig k="paid" f={c} live={live} />
            <DockFig k="next payout" f={{ v: `${h.pct}%`, u: '', title: `Pending is sent automatically once it reaches ${h.threshold} SOL.` }} live={live} meter={h.pct} />
          </dl>
        </>
      ) : (
        <>
          <p className="mc-dock-copy" data-side="l">
            <b>Address only.</b> No signature, no transaction.
          </p>
          <p className="mc-dock-copy" data-side="r">
            <b>Mining is free.</b> Auto-paid at {h.threshold} SOL.
          </p>
        </>
      )}
      <button type="button" className="mc-go" data-v={h.primary.ghost ? 'ghost' : undefined} onClick={h.primary.fn} disabled={h.primary.disabled}>
        <span key={h.primary.label}>
          {h.primary.dot ? <i aria-hidden="true" /> : null}
          {h.primary.label}
        </span>
      </button>
    </div>
  )
}

export default function Mine() {
  const h = useHud()
  return (
    <>
      <div className="mc">
        <header className="mc-lede">
          <div className="mc-head">
            <span>this tab</span>
            <CA />
            <span role="status">
              <Shape kind={h.status.mark} />
              {h.status.label}
            </span>
          </div>
          <h1 className="sr-only">{BRAND.headline.join(' ')}</h1>
        </header>
        <CubeSlot className="mc-viz" />
        <Dock />
        {h.w.address ? <RigCol /> : <GuideCol />}
        <NetCol live={h.hashing} />
      </div>
      <Flows />
    </>
  )
}
