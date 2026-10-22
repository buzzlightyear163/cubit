// The cube has four layers plus a core. Each route owns one of them.
export type SectionId = 'core' | 'rewards' | 'vault' | 'ledger' | 'miners' | 'protocol'

export interface Section {
  id: SectionId
  label: string
  href: string
  what: string // short line under the label in menus
  layer: number | null // 0 = bottom layer … 3 = top layer; null = whole cube (core / protocol)
  glyph: string // label in the cube key
}

export const SECTIONS: Record<SectionId, Section> = {
  core: { id: 'core', label: 'Mine', href: '/', what: 'mine in this tab', layer: null, glyph: 'core' },
  rewards: { id: 'rewards', label: 'Rewards', href: '/rewards', what: 'your wallet', layer: 1, glyph: 'L2' },
  vault: { id: 'vault', label: 'Vault', href: '/vault', what: 'fees in, payouts out', layer: 2, glyph: 'L3' },
  ledger: { id: 'ledger', label: 'Ledger', href: '/ledger', what: 'every record', layer: 0, glyph: 'L1' },
  miners: { id: 'miners', label: 'Miners', href: '/miners', what: 'who is hashing', layer: 3, glyph: 'L4' },
  protocol: { id: 'protocol', label: 'Protocol', href: '/protocol', what: 'how it works', layer: null, glyph: 'core' },
}

export const NAV: SectionId[] = ['core', 'rewards', 'vault', 'ledger', 'miners', 'protocol']

/** Key in the page map: top layer first. */
export const KEY_ORDER: SectionId[] = ['miners', 'vault', 'rewards', 'ledger', 'core']

export const LAYER_SECTION: Record<number, SectionId> = { 0: 'ledger', 1: 'rewards', 2: 'vault', 3: 'miners' }

export function sectionForPath(path: string): SectionId {
  const hit = NAV.find((id) => id !== 'core' && path.startsWith(SECTIONS[id].href))
  return hit ?? 'core'
}
