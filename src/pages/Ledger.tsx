import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { BRAND } from '../config/brand'
import { ChainLink, Seg, Shape } from '../components/ui'
import { PageFrame } from '../layouts/PageFrame'
import { count, shortAddr, sol, utc } from '../lib/format'
import { useStore } from '../lib/store'
import { net, type LedgerRec } from '../sim/network'

type Filter = 'all' | 'claims' | 'payouts' | 'burns' | 'tab'
const FILTERS: { v: Filter; label: string }[] = [
  { v: 'all', label: 'All' },
  { v: 'claims', label: 'Claims' },
  { v: 'payouts', label: 'Payouts' },
  { v: 'burns', label: 'Burns' },
  { v: 'tab', label: 'This tab' },
]

function match(r: LedgerRec, f: Filter) {
  if (f === 'all') return true
  if (f === 'claims') return r.kind === 'claim'
  if (f === 'payouts') return r.kind === 'payout'
  if (f === 'burns') return r.kind === 'burn'
  return !!r.tab
}

function Row({ r }: { r: LedgerRec }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="lg-item" data-tab={r.tab ? '' : undefined}>
      <button type="button" className="lg-r" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <Shape kind={r.shape} />
        <span className="t">{utc(r.at)}</span>
        <span className="e">
          {r.title}
          <span> · {r.meta}</span>
        </span>
        <span className="v" data-tone={r.tone}>
          {r.amount}
        </span>
      </button>
      {open ? (
        <dl className="lg-kv">
          {r.kv.map((kv, i) => (
            <div key={i}>
              <dt>{kv.k}</dt>
              <dd>
                {kv.sigs && kv.sigs.length ? (
                  <span className="sigs">
                    {kv.sigs.map((s, j) => (
                      <span key={s}>
                        {j ? ', ' : ''}
                        <ChainLink value={s} short={shortAddr(s)} />
                      </span>
                    ))}
                  </span>
                ) : (
                  kv.v
                )}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  )
}

export default function Ledger() {
  const st = useStore(net)
  const [params, setParams] = useSearchParams()
  const f = (FILTERS.find((x) => x.v === params.get('show'))?.v ?? 'all') as Filter
  const rows = useMemo(() => st.ledger.filter((r) => match(r, f)).slice(0, 80), [st.ledger, f])
  return (
    <PageFrame sec="ledger" title="Ledger" lede="Every fee claim, payout, settled window, buyback and burn, each paired with what it funded or was funded by.">
      <dl className="heroes" aria-label="Ledger totals" data-n="4">
        <div data-tip="" data-tip-up="">
          <dt>Fees received</dt>
          <dd className="v">{sol(st.totals.feesIn, 4)}</dd>
          <dd className="u">SOL · creator fees</dd>
        </div>
        <div data-tip="" data-tip-up="">
          <dt>Paid to miners</dt>
          <dd className="v">{sol(st.totals.paidOut, 4)}</dd>
          <dd className="u">SOL · on chain</dd>
        </div>
        <div data-tip="" data-tip-up="">
          <dt>Bought back</dt>
          <dd className="v">{sol(st.totals.boughtBack, 4)}</dd>
          <dd className="u">SOL · burn share</dd>
        </div>
        <div data-tip="" data-tip-up="">
          <dt>Burned</dt>
          <dd className="v">{count(st.totals.burnedTokens)}</dd>
          <dd className="u">{BRAND.ticker} · confirmed</dd>
        </div>
      </dl>
      <section className="pn" aria-labelledby="lg-recs">
        <h2 className="pn-h" id="lg-recs">
          <span>Records</span>
          <span className="pn-meta">{rows.length} records, newest first</span>
        </h2>
        <div className="pn-b">
          <div className="pf-tools">
            <Seg
              label="Show"
              labelWidth="2.75rem"
              options={FILTERS.map((x) => ({
                label: x.label,
                on: f === x.v,
                fn: () => setParams(x.v === 'all' ? {} : { show: x.v }, { replace: true }),
              }))}
            />
            <div className="legend" aria-label="Where a record lives">
              <span><Shape kind="local" />This tab</span>
              <span><Shape kind="pending" />Pending</span>
              <span><Shape kind="server" />Server</span>
              <span><Shape kind="chain" />On chain</span>
              <span><Shape kind="error" />Rejected</span>
            </div>
          </div>
          <div className="lg-h">
            <span />
            <span>UTC</span>
            <span>Event</span>
            <span style={{ textAlign: 'right' }}>Amount</span>
          </div>
          <div className="lg-list" tabIndex={0} role="region" aria-label="Ledger records">
            {rows.length === 0 ? <p className="pn-empty">{f === 'tab' ? 'Nothing from this tab yet. Start mining on Mine.' : 'No records yet.'}</p> : null}
            {rows.map((r) => (
              <Row key={r.id} r={r} />
            ))}
          </div>
        </div>
      </section>
    </PageFrame>
  )
}
