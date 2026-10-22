import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'

/** Current time, quantised to `step` ms, re-rendering every step. */
export function useNow(step = 1000): number {
  const sub = useCallback(
    (fn: () => void) => {
      const id = setInterval(fn, step)
      return () => clearInterval(id)
    },
    [step],
  )
  const get = useCallback(() => Math.floor(Date.now() / step) * step, [step])
  return useSyncExternalStore(sub, get, get)
}

export function useMedia(query: string): boolean {
  const [m, setM] = useState(() => (typeof matchMedia === 'function' ? matchMedia(query).matches : false))
  useEffect(() => {
    const mq = matchMedia(query)
    const on = () => setM(mq.matches)
    on()
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [query])
  return m
}

export const reducedMotion = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

/** localStorage that never throws. */
export const safeStorage = {
  get(k: string): string | null {
    try {
      return localStorage.getItem(k)
    } catch {
      return null
    }
  },
  set(k: string, v: string | null) {
    try {
      if (v == null) localStorage.removeItem(k)
      else localStorage.setItem(k, v)
    } catch {
      /* private mode etc. */
    }
  },
}
