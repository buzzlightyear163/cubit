import { ECON } from '../config/brand'
import { MetricRow, Odometer } from '../components/ui'
import { PageFrame } from '../layouts/PageFrame'
import { bps, hashesShort, sol, utc } from '../lib/format'
import { useHud } from '../lib/hud'
import { openPicker } from '../wallet/wallet'

export default function Rewards() {
  const h = useHud()
  const you = h.you
  return (
    <PageFrame sec="rewards" title="Rewards" lede="What this wallet has earned, what is on its way, and the window behind every credit.">
      {!you ? (
        <section className="pf-ask" aria-labelledby="rw-ask">
          <h2 id="rw-ask">Connect the wallet you mine with</h2>
          <p>Address only: no signature, no transaction. Once it is connected, this page shows:</p>
          <ul>
            <li>Pending, paid and lifetime SOL</li>
            <li>Progress to the next payout</li>
            <li>Every payout with its signature</li>
            <li>Each settled window and your share</li>
          </ul>
          <button type="button" className="pf-btn" onClick={openPicker}>
            Connect wallet
          </button>
        </section>
      ) : (
        <>
          <dl className="heroes" aria-label="Your rewards" data-n="4">
            <div data-tip="Settled credit that has not been sent yet." data-tip-up="">
              <dt>Pending</dt>
              <dd className="v" data-dim={you.pending ? undefined : ''}>
                <Odometer value={sol(you.pending, 5)} />
              </dd>
              <dd className="u">SOL · not sent</dd>
            </div>
            <div data-tip="" data-tip-up="">
              <dt>Paid</dt>
              <dd className="v">{sol(you.paid, 4)}</dd>
              <dd className="u">SOL · on chain</dd>
            </div>
            <div data-tip="Everything this address has been credited." data-tip-up="">
              <dt>Lifetime</dt>
              <dd className="v">{sol(you.lifetime, 5)}</dd>
              <dd className="u">SOL · credited</dd>
            </div>
            <div data-tip="" data-tip-up="">
              <dt>This window</dt>
              <dd className="v">{h.estimate ? sol(h.estimate, 6) : '0.000000'}</dd>
              <dd className="u">SOL · estimate</dd>
            </div>
          </dl>
          <div className="prog">
            <div className="prog-row">
              <span>Next payout</span>
              <span>
                <b>{h.pct}%</b> of {h.threshold} SOL
              </span>
            </div>
            <div className="bar">
              <div style={{ transform: `scaleX(${h.pct / 100})` }} />
            </div>
          </div>
          <div className="pf-row">
            <section className="pn" aria-labelledby="rw-pay">
              <h2 className="pn-h" id="rw-pay">
                <span>Payouts</span>
                <span className="pn-meta">from the reward wallet</span>
              </h2>
              <div className="pn-b">
                <p className="pn-empty">No payouts to this address yet.</p>
                <p className="pn-note">
                  Pending is sent automatically once it passes <b>{h.threshold} SOL</b>. Every payout is one on-chain transfer and appears here with its signature.
                </p>
              </div>
            </section>
            <section className="pn" aria-labelledby="rw-hold">
              <h2 className="pn-h" id="rw-hold">
                <span>Holding</span>
                <span className="pn-meta">{h.w.holding.status === 'demo' ? 'checked at launch' : 'read on chain'}</span>
              </h2>
              <div className="pn-b">
                <div className="metric-rows">
                  <MetricRow label="Hold units" value={String(h.w.holding.units)} hint={`One unit is ${ECON.holdUnitTokens.toLocaleString('en-US')} tokens.`} />
                  <MetricRow label="Cap per window" value={bps(h.w.holding.capBps)} hint="The most of one window's pool this wallet can take." />
                  <MetricRow label="Proofs this session" value={String(h.m.acceptedTotal)} />
                </div>
              </div>
            </section>
          </div>
          <section className="pn" aria-labelledby="rw-win">
            <h2 className="pn-h" id="rw-win">
              <span>Windows you worked in</span>
              <span className="pn-meta">{you.rounds.length} settled, newest first</span>
            </h2>
            <div className="pn-b pn-scroll" tabIndex={0} role="region" aria-labelledby="rw-win">
              <div className="tbl-h g-win">
                <span>Window</span>
                <span>Work</span>
                <span className="r">Share</span>
                <span className="r">SOL</span>
              </div>
              {you.rounds.length === 0 ? <p className="pn-empty">Start mining on Mine; each settled window lands here.</p> : null}
              {you.rounds.map((r) => (
                <div key={r.round} className="tbl-r g-win" title={`closed ${utc(r.at)} UTC · cap ${bps(r.capBps)}`}>
                  <span className="t">#{r.round}</span>
                  <span>{hashesShort(r.work)} hashes</span>
                  <span className="r">{bps(r.shareBps)}</span>
                  <span className="r">+{sol(r.lamports, 6)}</span>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </PageFrame>
  )
}
