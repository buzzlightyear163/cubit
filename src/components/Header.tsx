import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { BRAND, X_URL } from '../config/brand'
import { NAV, SECTIONS } from '../data/sections'
import { sol, shortAddr } from '../lib/format'
import { useStore } from '../lib/store'
import { net } from '../sim/network'
import { disconnect, openPicker, useWallet } from '../wallet/wallet'
import { Logo, XIcon } from './ui'

function WalletButton() {
  const w = useWallet()
  const st = useStore(net)
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const off = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', off)
    window.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', off)
      window.removeEventListener('keydown', esc)
    }
  }, [open])

  if (!w.address) {
    return (
      <div className="cb-wallet">
        <button type="button" className="cb-wallet-btn" onClick={openPicker} disabled={w.connecting}>
          <span>
            {w.connecting ? 'Connecting…' : 'Connect'}
            {!w.connecting ? <span className="cb-wallet-more"> wallet</span> : null}
          </span>
        </button>
      </div>
    )
  }
  const you = st.you
  return (
    <div className="cb-wallet" ref={ref}>
      <button type="button" className="cb-wallet-btn" data-on="" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <i aria-hidden="true" />
        {shortAddr(w.address)}
      </button>
      {open ? (
        <div className="cb-wallet-pop" role="dialog" aria-label="Wallet">
          <div className="cb-wallet-pop-head">
            <span>{w.via === 'address' ? 'pasted address' : w.via}</span>
            <button
              type="button"
              className="cb-copy"
              onClick={() =>
                navigator.clipboard?.writeText(w.address!).then(() => {
                  setCopied(true)
                  setTimeout(() => setCopied(false), 1400)
                })
              }
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <div className="addr">{w.address}</div>
          <dl>
            <div>
              <dt>pending</dt>
              <dd>{sol(you?.pending ?? 0, 5)}</dd>
            </div>
            <div>
              <dt>paid</dt>
              <dd>{sol(you?.paid ?? 0, 4)}</dd>
            </div>
            <div>
              <dt>cap</dt>
              <dd>{(w.holding.capBps / 100).toFixed(0)}%</dd>
            </div>
          </dl>
          <div className="cb-wallet-pop-act">
            <Link to={SECTIONS.rewards.href} viewTransition onClick={() => setOpen(false)}>
              Rewards
            </Link>
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                disconnect()
              }}
            >
              Disconnect
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export function Header() {
  const [open, setOpen] = useState(false)
  const loc = useLocation()
  useEffect(() => setOpen(false), [loc.pathname])
  useEffect(() => {
    if (!open) return
    const k = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [open])

  return (
    <>
      <header className="cb-head">
        <div className="cb-bar" data-open={open ? '' : undefined}>
          <button type="button" className="cb-menu" aria-expanded={open} aria-controls="cb-menu-panel" onClick={() => setOpen((v) => !v)}>
            <span className="cb-menu-lines" aria-hidden="true">
              <i />
              <i />
            </span>
            <span>{open ? 'Close' : 'Menu'}</span>
          </button>
          <Link className="cb-brand" to="/" viewTransition aria-label={`${BRAND.name}, mine`}>
            <Logo />
            <b>{BRAND.wordmark}</b>
          </Link>
          <nav className="cb-nav" aria-label="Sections">
            {NAV.map((id) => {
              const s = SECTIONS[id]
              return (
                <NavLink key={id} to={s.href} end={id === 'core'} viewTransition>
                  {({ isActive }) => (
                    <>
                      <span className="cb-tab-t" data-text={s.label}>
                        {s.label}
                      </span>
                      {isActive ? <i aria-hidden="true" /> : null}
                    </>
                  )}
                </NavLink>
              )
            })}
          </nav>
          <div className="cb-bar-end">
            <a className="cb-x" href={X_URL} target="_blank" rel="noreferrer" aria-label={`@${BRAND.xHandle} on X`}>
              <XIcon />
            </a>
            <WalletButton />
          </div>
          <div className="cb-menu-panel" id="cb-menu-panel" inert={!open} aria-hidden={!open}>
            <div className="cb-menu-inner">
              <ol>
                {NAV.map((id, i) => {
                  const s = SECTIONS[id]
                  return (
                    <li key={id} style={{ ['--i' as string]: i }}>
                      <NavLink to={s.href} end={id === 'core'} viewTransition>
                        <span>{s.label}</span>
                        <i>{s.what}</i>
                      </NavLink>
                    </li>
                  )
                })}
              </ol>
              <a className="cb-menu-x" href={X_URL} target="_blank" rel="noreferrer" style={{ ['--i' as string]: NAV.length }}>
                <XIcon />
                <span>@{BRAND.xHandle} on X</span>
              </a>
            </div>
          </div>
        </div>
      </header>
      {open ? <div className="cb-scrim" onClick={() => setOpen(false)} /> : null}
    </>
  )
}
