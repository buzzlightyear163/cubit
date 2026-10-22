import { BRAND, ECON } from '../config/brand'
import { ChainLink, ConsoleAction, MetricRow, Odometer, SplitMeter } from '../components/ui'
import { PageFrame } from '../layouts/PageFrame'
import { count, shortAddr, sol, utc } from '../lib/format'
import { useStore } from '../lib/store'
import { net } from '../sim/network'

function Addr({ v }: { v: string }) {
  if (!v) return <span className="dim">set at launch</span>
  return <ChainLink value={v} short={shortAddr(v)} kind="account" />
}

export default function Vault() {
  const st = useStore(net)
  const reserve = 0.5 * 1e9
  const free = Math.max(0, st.rewardWallet - st.owed - reserve)
  const m = ECON.minerShareBps / 100
  const b = ECON.burnShareBps / 100
  const i = 100 - m - b
  return (
    <PageFrame sec="vault" title="Vault" lede="Where the SOL comes from and where it goes. Every movement is one transaction you can open.">
      <dl className="heroes" aria-label="Vault balances" data-n="4">
        <div data-tip="" data-tip-up="">
          <dt>Reward wallet</dt>
          <dd className="v">
            <Odometer value={sol(st.rewardWallet, 4)} />
          </dd>
          <dd className="u">SOL · slot {count(st.slot)}</dd>
        </div>
        <div data-tip="Open window pool, settled unpaid balances and payouts in flight." data-tip-up="">
          <dt>Owed to miners</dt>
          <dd className="v">{sol(st.owed, 4)}</dd>
          <dd className="u">SOL · not yet paid</dd>
        </div>
        <div data-tip="Reward wallet minus what is owed and a 0.5 SOL reserve." data-tip-up="">
          <dt>Free to pay out</dt>
          <dd className="v">{sol(free, 4)}</dd>
          <dd className="u">SOL · after debts</dd>
        </div>
        <div data-tip="" data-tip-up="">
          <dt>Paid to miners</dt>
          <dd className="v">
            <Odometer value={sol(st.totals.paidOut, 4)} />
          </dd>
          <dd className="u">SOL · to date</dd>
        </div>
      </dl>
      <div className="pf-row">
        <section className="pn" aria-labelledby="v-split">
          <h2 className="pn-h" id="v-split">
            <span>Every fee claim splits</span>
            <span className="pn-meta">on chain</span>
          </h2>
          <div className="pn-b">
            <SplitMeter cells={32} parts={[{ share: m, tone: 'bone' }, { share: b, tone: 'dim' }, { share: i, tone: 'faint' }]} />
            <ul className="split-list">
              <li data-tone="bone"><b>{m}%</b> miners</li>
              <li data-tone="dim"><b>{b}%</b> buyback and burn</li>
              <li data-tone="faint"><b>{i}%</b> infrastructure</li>
            </ul>
            <p className="pn-note">Only pump.fun creator fees already collected, split on chain.</p>
          </div>
        </section>
        <section className="pn" aria-labelledby="v-other">
          <h2 className="pn-h" id="v-other">
            <span>Other balances</span>
            <span className="pn-meta">read on chain</span>
          </h2>
          <div className="pn-b">
            <div className="metric-rows">
              <MetricRow label="Infrastructure" value={sol(st.totals.infra, 4)} unit="SOL" hint="Servers, proof checks and RPC." />
              <MetricRow label="Bought back" value={sol(st.totals.boughtBack, 4)} unit="SOL" hint="Spent from the burn share of creator fees." />
              <MetricRow label={`${BRAND.ticker} burned`} value={count(st.totals.burnedTokens)} unit="tokens" hint="Confirmed burns only." />
            </div>
          </div>
        </section>
      </div>
      <div className="pf-row">
        <section className="pn" aria-labelledby="v-in">
          <h2 className="pn-h" id="v-in">
            <span>Received</span>
            <span className="pn-meta">
              <ConsoleAction to="/ledger?show=claims" quiet small>
                every claim in the ledger
              </ConsoleAction>
            </span>
          </h2>
          <div className="pn-b pn-scroll" tabIndex={0} role="region" aria-labelledby="v-in">
            <div className="tbl-h g-rec">
              <span>UTC</span>
              <span>Signature</span>
              <span className="r">SOL</span>
            </div>
            {st.receipts.slice(0, 24).map((r) => (
              <div key={r.sig} className="tbl-r g-rec" title="creator fees into the reward wallet">
                <span className="t">{utc(r.at)}</span>
                <ChainLink value={r.sig} short={shortAddr(r.sig)} />
                <span className="r">+{sol(r.lamports, 3)}</span>
              </div>
            ))}
          </div>
        </section>
        <section className="pn" aria-labelledby="v-out">
          <h2 className="pn-h" id="v-out">
            <span>Paid out</span>
            <span className="pn-meta">to miners</span>
          </h2>
          <div className="pn-b pn-scroll" tabIndex={0} role="region" aria-labelledby="v-out">
            <div className="tbl-h g-rec">
              <span>UTC</span>
              <span>Signature</span>
              <span className="r">SOL</span>
            </div>
            {st.payouts.length === 0 ? <p className="pn-empty">No payouts yet.</p> : null}
            {st.payouts.slice(0, 24).map((p) => (
              <div key={p.sig} className="tbl-r g-rec" title={`miner payouts · ${p.wallets} wallet${p.wallets === 1 ? '' : 's'}`}>
                <span className="t">{utc(p.at)}</span>
                <ChainLink value={p.sig} short={shortAddr(p.sig)} />
                <span className="r">−{sol(p.lamports, 4)}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
      <section className="pn" aria-labelledby="v-wal">
        <h2 className="pn-h" id="v-wal">
          <span>Wallets</span>
          <span className="pn-meta">open any on the explorer</span>
        </h2>
        <div className="pn-b">
          <div className="metric-rows pairs">
            <MetricRow wide label="Token mint" value={<Addr v={BRAND.mint} />} />
            <MetricRow wide label="Reward wallet" value={<Addr v={BRAND.wallets.reward} />} hint="Receives the miners' share of creator fees and sends every payout." />
            <MetricRow wide label="Burn wallet" value={<Addr v={BRAND.wallets.burn} />} hint={`Buys back ${BRAND.ticker} with the burn share and burns it.`} />
            <MetricRow wide label="Infrastructure wallet" value={<Addr v={BRAND.wallets.infra} />} />
          </div>
        </div>
      </section>
    </PageFrame>
  )
}
