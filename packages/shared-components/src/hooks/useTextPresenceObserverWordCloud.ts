import type { DependencyList, RefObject } from 'react'
import { useEffect, useState } from 'react'

export function useTextPresenceObserverWordCloud(
  containerRef: RefObject<HTMLElement | null>,
  deps: DependencyList = []
): boolean {
  const [hasText, setHasText] = useState<boolean>(false)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const read = () => {
      const present = !!el.textContent?.trim().length
      setHasText((prev) => (prev !== present ? present : prev))
    }
    read()

    const mo = new MutationObserver(() => {
      requestAnimationFrame(read)
    })
    mo.observe(el, { childList: true, subtree: true, characterData: true })

    return () => mo.disconnect()
  }, [containerRef.current, ...deps])

  return hasText
}
