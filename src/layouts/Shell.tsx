import { useEffect } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Header } from '../components/Header'
import { getCube } from '../cube/engine'
import { SECTIONS, sectionForPath } from '../data/sections'
import { useStore } from '../lib/store'
import { miner } from '../miner/miner'
import { useWallet, WalletPicker } from '../wallet/wallet'

/** Keeps the persistent cube in sync with the route and the miner. */
function CubeDirector() {
  const loc = useLocation()
  const nav = useNavigate()
  const m = useStore(miner)
  const w = useWallet()
  useEffect(() => {
    getCube().setSection(sectionForPath(loc.pathname))
  }, [loc.pathname])
  useEffect(() => {
    getCube().setMode({ hashing: m.on && m.status === 'running', armed: !!w.address, load: m.load })
  }, [m.on, m.status, m.load, w.address])
  useEffect(() => {
    getCube().setOnSelect((id) => {
      if (sectionForPath(location.pathname) !== id) nav(SECTIONS[id].href, { viewTransition: true })
    })
  }, [nav])
  return null
}

export function Shell() {
  const loc = useLocation()
  const page = sectionForPath(loc.pathname) !== 'core' || (loc.pathname !== '/' && loc.pathname !== '')
  useEffect(() => {
    const s = SECTIONS[sectionForPath(loc.pathname)]
    document.title = s.id === 'core' ? 'cubit — mine from a browser tab' : `${s.label} · cubit`
  }, [loc.pathname])
  return (
    <div className="cb" data-page={page ? '' : undefined} data-screen-label={SECTIONS[sectionForPath(loc.pathname)].label}>
      <Header />
      <main className="cb-main">
        <Outlet />
      </main>
      <CubeDirector />
      <WalletPicker />
    </div>
  )
}
