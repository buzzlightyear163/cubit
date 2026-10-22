// One view-model for "you": wallet + miner + network, shared by the Mine dock and the page dock.
import { ECON } from '../config/brand'
import { miner, start, stop } from '../miner/miner'
import { estimateYou, net } from '../sim/network'
import { openPicker, useWallet } from '../wallet/wallet'
import { sol } from './format'
import { useStore } from './store'
import type { Shape } from '../sim/network'

export interface Fig { v: string; u: string; title?: string; c?: string }

export function useHud() {
  const w = useWallet()
  const m = useStore(miner)
  const st = useStore(net)
  const you = st.you
  const cur = st.current

  const hashing = m.on && m.status === 'running'
  const status: { label: string; mark: Shape | 'live' } = !w.address
    ? { label: 'Not connected', mark: 'local' }
    : m.status === 'error'
      ? { label: 'Miner stopped', mark: 'error' }
      : m.on
        ? { label: m.status === 'running' ? `Mining · ${m.threads} thread${m.threads === 1 ? '' : 's'}` : 'Starting…', mark: 'live' }
        : w.holding.status === 'short'
          ? { label: 'Hold one unit to mine', mark: 'warn' }
          : { label: 'Ready to mine', mark: 'pending' }

  const estimate = estimateYou(st)
  const pending = you?.pending ?? 0
  const paid = you?.paid ?? 0
  const pct = Math.min(100, Math.round((pending / ECON.payoutThresholdLamports) * 100))
  const threshold = sol(ECON.payoutThresholdLamports, 2)

  const strip: [Fig, Fig, Fig] = [
    { v: you ? (estimate ? sol(estimate, 6) : '0.000000') : '–', u: 'SOL · estimate', title: 'Your share of this window so far, from credited proofs. Final when the window settles.' },
    { v: sol(pending, 5), u: 'SOL · not sent', title: `Settled credit waiting for the payout threshold, ${threshold} SOL.`, c: pending ? undefined : 'var(--mute)' },
    { v: you ? sol(paid, 4) : '–', u: 'SOL · on chain', title: 'Sent to this address so far.' },
  ]

  const primary = !w.address
    ? { label: w.connecting ? 'Connecting…' : 'Connect wallet', fn: openPicker, disabled: w.connecting, ghost: false, dot: false }
    : m.on
      ? { label: 'Stop mining', fn: stop, disabled: false, ghost: true, dot: true }
      : { label: 'Start mining', fn: start, disabled: w.holding.status === 'short' || w.holding.status === 'checking', ghost: false, dot: false }

  return { w, m, st, you, cur, hashing, status, strip, pct, threshold, primary, estimate }
}
