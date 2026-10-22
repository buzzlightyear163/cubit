import { useMemo, useState } from 'react'
import { BRAND, ECON } from '../config/brand'
import { ChainLink, MetricRow, Seg } from '../components/ui'
import { PageFrame, Ruler } from '../layouts/PageFrame'
import { bps, count, hashRate, hashesShort, shortAddr, sol } from '../lib/format'
import { useStore } from '../lib/store'
import { net } from '../sim/network'
import { useMarket } from '../lib/market'

type Period = 'window' | 'day' | 'all'
const RULER = [
  { id: 'p-live', label: 'Live' },
  { id: 'p-leaders', label: 'Leaders' },
  { id: 'p-token', label: 'Token' },
]

interface Leader { wallet: string; work: number; you: boolean; capBps: number; pending: number }

function LeaderRow({ r, i, total }: { r: Leader; i: number; total: number }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="lb-item" data-you={r.you ? '' : undefined}>
      <button type="button" className="lb-r" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span>{String(i + 1).padStart(2, '0')}</span>
        <span className="w">
          <span>{shortAddr(r.wallet)}</span>
          {r.you ? <em>you</em> : null}
        </span>
        <span className="r">{hashesShort(r.work)}</span>
        <span className="r s">{total ? ((r.work / total) * 100).toFixed(1) : '0.0'}%</span>
      </button>
      {open ? (
        <dl className="lg-kv">
          <div>
            <dt>Wallet</dt>
            <dd>
              <ChainLink value={r.wallet} short={r.wallet} kind="account" />
            </dd>
          </div>
          <div>
            <dt>Cap</dt>
            <dd>{bps(r.capBps)}</dd>
          </div>
          <div>
            <dt>Pending</dt>
            <dd>{sol(r.pending, 5)} SOL</dd>
          </div>
        </dl>
      ) : null}
    </div>
  )
}

export default function Miners() {
  const st = useStore(net)
  const mk = useMarket()
  const [period, setPeriod] = useState<Period>('window')
  const r = hashRate(st.live.workPerSec)
  const capOf = (u: number) => Math.min(ECON.walletCapBps, u * ECON.capPerUnitBps)

  const rows = useMemo<Leader[]>(() => {
    const active = st.roster.filter((m) => m.active)
    const totalHps = active.reduce((s, m) => s + m.hps, 0) || 1
    const base: Leader[] =
      period === 'window'
        ? active.map((m) => ({ wallet: m.wallet, work: (m.hps / totalHps) * st.current.work, you: false, capBps: capOf(m.units), pending: m.pending }))
        : st.roster.map((m) => ({ wallet: m.wallet, work: period === 'day' ? m.day + m.hps * 3600 * 6 : m.all + m.hps * 3600 * 70, you: false, capBps: capOf(m.units), pending: m.pending }))
    if (st.you) {
      const yw = period === 'window' ? st.you.workNow : st.you.rounds.reduce((s, x) => s + x.work, 0) + st.you.workNow
      if (yw > 0) base.push({ wallet: st.you.wallet, work: yw, you: true, capBps: st.you.capBps, pending: st.you.pending })
    }
    return base.sort((a, b) => b.work - a.work)
  }, [st, period])
  const total = rows.reduce((s, x) => s + x.work, 0)

  return (
    <PageFrame sec="miners" title="Miners" lede="Who is hashing right now, and how each window's work is shared.">
      <Ruler items={RULER} />
      <div id="p-live">
        <dl className="heroes" aria-label="The network now" data-n="4">
          <div data-tip="" data-tip-up="">
            <dt>Pool pace</dt>
            <dd className="v">{sol(st.live.poolPerMin, 4)}</dd>
            <dd className="u">SOL/min</dd>
          </div>
          <div data-tip="" data-tip-up="">
            <dt>Miners</dt>
            <dd className="v">{st.live.miners}</dd>
            <dd className="u">active, last min</dd>
          </div>
          <div data-tip="" data-tip-up="">
            <dt>Network rate</dt>
            <dd className="v">{r.v}</dd>
            <dd className="u">{r.u}</dd>
          </div>
          <div data-tip="" data-tip-up="">
            <dt>Proofs</dt>
            <dd className="v">{st.live.proofsPerMin}</dd>
            <dd className="u">per min</dd>
          </div>
        </dl>
      </div>
      <div className="pf-row lead">
        <section className="pn" aria-labelledby="mn-lead" id="p-leaders">
          <h2 className="pn-h" id="mn-lead">
            <span>Leaders · {period === 'window' ? `window #${st.current.round}` : period === 'day' ? 'last 24 h' : 'all time'}</span>
            <span className="pn-meta">
              {rows.length} miners · {hashesShort(total)} hashes
            </span>
          </h2>
          <div className="pn-b">
            <div className="pf-tools">
              <Seg
                label="Period"
                labelWidth="3.25rem"
                options={[
                  { label: 'Window', on: period === 'window', fn: () => setPeriod('window') },
                  { label: '24 h', on: period === 'day', fn: () => setPeriod('day') },
                  { label: 'All time', on: period === 'all', fn: () => setPeriod('all') },
                ]}
              />
            </div>
            <div className="lb-list" tabIndex={0} role="region" aria-label="Leaderboard">
              <div className="lb-h">
                <span>#</span>
                <span>Wallet</span>
                <span className="r">Work, hashes</span>
                <span className="r">Share</span>
              </div>
              {rows.map((x, i) => (
                <LeaderRow key={x.wallet} r={x} i={i} total={total} />
              ))}
            </div>
            <p className="pn-note">
              Share is work in the period ÷ all work. Rewards follow work within holding caps; anything above a cap is shared by work among uncapped wallets, and what nobody can take stays in the reward wallet.
            </p>
          </div>
        </section>
        <section className="pn" aria-labelledby="mn-token" id="p-token">
          <h2 className="pn-h" id="mn-token">
            <span>{BRAND.ticker} token</span>
            <span className="pn-meta">on chain</span>
          </h2>
          <div className="pn-b">
            <div className="metric-rows">
              <MetricRow wide label="Mint" value={BRAND.mint ? <ChainLink value={BRAND.mint} short={shortAddr(BRAND.mint)} kind="token" real /> : <span className="dim">set at launch</span>} hint="You need one hold unit of this token to mine." />
              <MetricRow label="Hold unit" value={count(st.token.holdUnit)} unit="tokens" hint={`Priced in SOL: halves whenever one unit is worth more than ${ECON.holdUnitBandSol[1]} SOL at the 24-hour median, at most once a day. Each unit adds ${bps(ECON.capPerUnitBps)} to a wallet's cap, up to ${bps(ECON.walletCapBps)}.`} />
              <MetricRow label="Price" value={mk ? `$${mk.priceUsd < 0.01 ? mk.priceUsd.toPrecision(3) : mk.priceUsd.toFixed(4)}` : '–'} tone={mk ? undefined : 'dim'} hint={mk ? `From ${mk.source}.` : 'Shows once the first trades are indexed.'} />
              <MetricRow label="Market cap" value={mk ? count(mk.mcapUsd) : '–'} unit={mk ? 'USD' : ''} tone={mk ? undefined : 'dim'} />
              <MetricRow
                label="Holders"
                value={
                  BRAND.mint ? (
                    <a href={`${BRAND.explorer}/token/${BRAND.mint}#holders`} target="_blank" rel="noopener noreferrer">
                      view on Solscan
                    </a>
                  ) : (
                    '–'
                  )
                }
              />
            </div>
          </div>
        </section>
      </div>
    </PageFrame>
  )
}
