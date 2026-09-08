import { createContext, useContext, useEffect, useState } from 'react'

/**
 * The admin panel is styled with inline objects rather than CSS classes, so
 * media queries can't reach most of it. This hook is the bridge: components
 * branch on it to pick a phone layout or a desktop one.
 *
 * 768px is the breakpoint below which the leads table stops fitting and the
 * header stops fitting on one line.
 */
const QUERY = '(max-width: 768px)'

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(QUERY).matches,
  )

  useEffect(() => {
    const mql = window.matchMedia(QUERY)
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    // Keep in sync with rotation and desktop window resizing.
    mql.addEventListener('change', onChange)
    setIsMobile(mql.matches)
    return () => mql.removeEventListener('change', onChange)
  }, [])

  return isMobile
}

/**
 * The same value, shared by context.
 *
 * The pricing editor renders ~40 numeric inputs. If each called `useIsMobile()`
 * itself that would be 40 matchMedia listeners and 40 independent setState
 * calls on every rotation, so the editor reads the hook once and provides it.
 */
export const MobileContext = createContext(false)

export const useMobileValue = () => useContext(MobileContext)
