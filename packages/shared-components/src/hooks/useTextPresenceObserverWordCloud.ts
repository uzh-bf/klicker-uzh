import { useEffect, useState } from 'react'

export function useTextPresenceObserverWordCloud(
  containerRef: React.RefObject<HTMLElement | null>,
  deps: any[] = []
) {
  const [hasText, setHasText] = useState(false)

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
  }, [containerRef, ...deps])

  return hasText
}
