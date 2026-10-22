import { BRAND, ECON } from '../config/brand'
import { PageFrame, Ruler } from '../layouts/PageFrame'
import { bps, count, sol } from '../lib/format'

const RULER = [
  { id: 'p-how', label: 'How it works' },
  { id: 'p-algo', label: 'Algorithm' },
  { id: 'p-pay', label: 'Payouts' },
  { id: 'p-hold', label: 'Hold to mine' },
  { id: 'p-fees', label: 'Fees' },
  { id: 'p-rej', label: 'Rejected' },
]

const REJECTED: [string, string][] = [
  ['duplicate', 'Same challenge, wallet and nonce already submitted'],
  ['expired', 'Arrived after the challenge expired'],
  ['wrong wallet', 'The hash input uses a different public key than the submitter'],
  ['below target', 'The hash does not have enough leading zero bits'],
  ['unknown challenge', 'The challenge was never issued by the server'],
  ['challenge full', 'The miner asks for a new, harder challenge'],
  ['hash mismatch', 'Differs from the hash the server recomputes'],
  ['window closed', 'Arrived after its window settled'],
  ['not holding', 'The wallet fell below one hold unit after the challenge was issued'],
  ['holding unknown', "The wallet's last balance read failed; credit pauses until the next read"],
  ['malformed', 'A field is missing or not in the published format'],
]

export default function Protocol() {
  const t = sol(ECON.payoutThresholdLamports, 2)
  const m = ECON.minerShareBps / 100
  const b = ECON.burnShareBps / 100
  return (
    <PageFrame sec="protocol" title="Protocol" lede="The rules and the economics: how a proof turns into SOL, and what never counts.">
      <Ruler items={RULER} />
      <section className="pn" aria-labelledby="pr-how" id="p-how">
        <h2 className="pn-h" id="pr-how">
          <span>How it works</span>
          <span className="pn-meta">four steps, every window</span>
        </h2>
        <div className="pn-b">
          <ol className="pf-steps">
            <li>
              <b>Challenge</b>The server hands this tab a random challenge bound to your address.
            </li>
            <li>
              <b>Hash</b>Your browser searches for a nonce whose SHA-256 starts with enough zero bits.
            </li>
            <li>
              <b>Verify</b>The server recomputes every proof and credits only the ones that hold.
            </li>
            <li>
              <b>Settle</b>Each {ECON.windowSec} s window's pool is split by credited work, every wallet up to its cap.
            </li>
          </ol>
          <p className="pn-note">You need to hold {BRAND.ticker} to mine. Faster hardware does more verified work; it never makes the pool bigger.</p>
        </div>
      </section>
      <div className="pf-row">
        <section className="pn" aria-labelledby="pr-algo" id="p-algo">
          <h2 className="pn-h" id="pr-algo">
            <span>The algorithm</span>
            <span className="pn-meta">SHA-256</span>
          </h2>
          <div className="pn-b">
            <div className="algo" aria-label="Proof algorithm">
              <div><span>preimage</span> = challenge ‖ wallet ‖ nonce</div>
              <div><span>hash    </span> = SHA-256(preimage)</div>
              <div><span>valid   </span> = leading_zero_bits(hash) ≥ d</div>
              <div><span>credit  </span> = <em>2^d</em> hashes</div>
            </div>
            <p className="pn-note">32-byte challenge, 32-byte wallet key, 8-byte nonce. One bit harder counts twice as much. Until a window settles, what you see is an estimate.</p>
          </div>
        </section>
        <section className="pn" aria-labelledby="pr-pay" id="p-pay">
          <h2 className="pn-h" id="pr-pay">
            <span>Payouts</span>
            <span className="pn-meta">at {t} SOL</span>
          </h2>
          <div className="pn-b">
            <p className="pn-copy">
              Credit settles into your pending balance when each window closes. Once it passes {t} SOL it is sent from the reward wallet, and every transfer is listed on Rewards and the Ledger.
            </p>
            <p className="pn-copy">
              <b>When the pool can't pay.</b> A window pays only what the reward wallet can fund. If it can't, the window runs as a funding window: proofs still count on the leaderboard and nothing accrues. Balances already settled never change.
            </p>
          </div>
        </section>
      </div>
      <div className="pf-row">
        <section className="pn" aria-labelledby="pr-hold" id="p-hold">
          <h2 className="pn-h" id="pr-hold">
            <span>Hold to mine</span>
            <span className="pn-meta">cap up to {bps(ECON.walletCapBps)}</span>
          </h2>
          <div className="pn-b">
            <p className="pn-copy">
              Mining needs one hold unit, now {count(ECON.holdUnitTokens)} {BRAND.ticker}. The unit is priced in SOL: whenever one unit is worth more than {ECON.holdUnitBandSol[1]} SOL at the 24-hour median price, it halves (at most once a day) and never grows back. Each unit adds {bps(ECON.capPerUnitBps)} to your cap per window, up to {bps(ECON.walletCapBps)}. A holding counts after three matching balance reads. Holding never changes hash rate or the size of the pool.
            </p>
            <p className="pn-note">
              Cap per unit <b>{bps(ECON.capPerUnitBps)}</b> · wallet cap <b>{bps(ECON.walletCapBps)}</b> · unit priced at <b>{ECON.holdUnitBandSol[0].toFixed(2)}</b> to <b>{ECON.holdUnitBandSol[1].toFixed(2)}</b> SOL
            </p>
          </div>
        </section>
        <section className="pn" aria-labelledby="pr-fees" id="p-fees">
          <h2 className="pn-h" id="pr-fees">
            <span>Where the SOL comes from</span>
            <span className="pn-meta">creator fees</span>
          </h2>
          <div className="pn-b">
            <p className="pn-copy">
              pump.fun pays the token's creator fees. Each claim splits on chain: {m}% to the reward pool that pays miners, {b}% to buy back and burn {BRAND.ticker}, {100 - m - b}% to infrastructure. A window's pool follows the fee rate of the last 60 minutes, capped at {sol(ECON.maxPoolLamports, 0)} SOL; below {sol(ECON.fundingFloorLamports, 3)} SOL it is a funding window.
            </p>
          </div>
        </section>
      </div>
      <section className="pn" aria-labelledby="pr-rej" id="p-rej">
        <h2 className="pn-h" id="pr-rej">
          <span>What gets rejected</span>
          <span className="pn-meta">{REJECTED.length} reasons, no credit</span>
        </h2>
        <div className="pn-b">
          <dl className="rules-dl">
            {REJECTED.map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
    </PageFrame>
  )
}
