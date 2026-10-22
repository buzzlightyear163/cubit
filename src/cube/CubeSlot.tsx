import { useLayoutEffect, useRef, useSyncExternalStore } from 'react'
import { getCube, type Visuals } from './engine'

/** A place the persistent cube can live. Mounting a slot moves the cube into it. */
export function CubeSlot({ className }: { className: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    if (ref.current) getCube().mount(ref.current)
  }, [])
  return <div ref={ref} className={`cb-viz ${className}`} data-cube-slot="" />
}

export function useVisuals(): [Visuals, (v: Visuals) => void] {
  const cube = getCube()
  const v = useSyncExternalStore(
    (fn) => cube.subscribeVisuals(fn),
    () => cube.visuals,
    () => cube.visuals,
  )
  return [v, (x: Visuals) => cube.setVisuals(x)]
}
