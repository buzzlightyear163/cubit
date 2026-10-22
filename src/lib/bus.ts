// App-wide events the cube and panels react to.
export type BusEvent =
  | { type: 'proof'; ok: boolean } // a proof left this tab (cube: glyph gathers + rises)
  | { type: 'merge' } // cube: proof merged into the core
  | { type: 'reject' } // cube: proof shattered
  | { type: 'fee'; lamports: number } // creator fees landed in the reward wallet
  | { type: 'settle'; round: number } // a window closed
  | { type: 'sweep'; layer: number } // light sweep across a layer

type Fn = (e: BusEvent) => void
const subs = new Set<Fn>()

export const bus = {
  emit(e: BusEvent) {
    subs.forEach((f) => f(e))
  },
  on(fn: Fn) {
    subs.add(fn)
    return () => {
      subs.delete(fn)
    }
  },
}
