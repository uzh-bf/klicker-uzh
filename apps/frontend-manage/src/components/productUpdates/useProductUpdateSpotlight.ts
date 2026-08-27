import type { ProductUpdate } from '@klicker-uzh/product-updates'
import { type Driver, driver } from 'driver.js'
import 'driver.js/dist/driver.css'
import { useRouter } from 'next/router'
import { useLocale, useTranslations } from 'next-intl'
import { useCallback, useEffect, useRef, useState } from 'react'
import { resolveSpotlightTarget } from './spotlightTargets'
import { trackProductUpdate } from './tracking'
import { useProductUpdates } from './useProductUpdates'

// A "browser session" is one tab: sessionStorage is per tab and disappears when
// the tab closes, which is the closest thing to a session the client can observe
// without another server round trip. Opening a second tab can therefore cost one
// more unsolicited spotlight, which is why the presentation counter caps the
// total independently of this guard.
const SESSION_GUARD_KEY = 'klicker-uzh.productUpdates.spotlightPresented'

// An entry stops presenting itself once it has been shown this often. The
// counter only moves when a presentation is explicitly recorded, so the cap is
// reached by two real appearances rather than by rerenders.
const MAX_UNSOLICITED_PRESENTATIONS = 2

function spotlightSeenThisSession(): boolean {
  try {
    return window.sessionStorage.getItem(SESSION_GUARD_KEY) === 'true'
  } catch {
    // Storage can be unavailable, for instance when the browser blocks it for
    // this origin. The cap cannot be honoured without it, and an uncapped
    // overlay is worse than a missing one, so nothing is presented.
    return true
  }
}

function rememberSpotlightThisSession() {
  try {
    window.sessionStorage.setItem(SESSION_GUARD_KEY, 'true')
  } catch {
    // See above: a session that cannot remember never presents again anyway.
  }
}

export type UseProductUpdateSpotlightResult = {
  replaySpotlight: (update: ProductUpdate) => void
}

/**
 * Runs the contextual spotlight: a Driver.js overlay that highlights the UI
 * element a product update announces and explains it in the reader's language.
 *
 * Exactly one mount may pass `autoPresent`, because the unsolicited spotlight
 * is capped per browser session and two mounts would both claim the same slot
 * in the same render pass. The manage header owns it; every other caller gets a
 * replay-only instance.
 *
 * Replays are what the reader explicitly asked for, so they ignore both caps.
 */
export function useProductUpdateSpotlight({
  autoPresent = false,
}: {
  autoPresent?: boolean
} = {}): UseProductUpdateSpotlightResult {
  const t = useTranslations()
  const locale = useLocale()
  const router = useRouter()
  const { entries, loading, recordPresentation, markRead, dismiss } =
    useProductUpdates()

  const language = locale === 'de' ? 'de' : 'en'

  // Driver.js takes over the whole document, so at most one overlay may live at
  // a time and it has to be torn down when this component goes away.
  const activeDriver = useRef<Driver | null>(null)
  const autoPresented = useRef(false)
  const [pendingReplay, setPendingReplay] = useState<ProductUpdate | null>(null)

  const present = useCallback(
    (update: ProductUpdate) => {
      const element = resolveSpotlightTarget(update.spotlightTarget)
      if (!element) return

      activeDriver.current?.destroy()

      const instance = driver({
        allowClose: true,
        stagePadding: 6,
        onDestroyed: () => {
          activeDriver.current = null
        },
      })
      activeDriver.current = instance

      instance.highlight({
        element,
        popover: {
          title: update.title[language],
          description: update.summary[language],
          // Driver.js offers three button slots. A one-step highlight has
          // nothing to go back to, so the previous slot carries the dismissal,
          // while the close icon means "not now" and leaves the entry alone.
          showButtons: ['next', 'previous', 'close'],
          nextBtnText: t('manage.productUpdates.spotlightConfirm'),
          prevBtnText: t('manage.productUpdates.spotlightDismiss'),
          onNextClick: () => {
            instance.destroy()
            markRead(update.id)

            if (!update.cta) return

            trackProductUpdate('CTA Clicked', update.id)

            if (update.cta.href.startsWith('/')) {
              void router.push(update.cta.href)
            } else {
              window.open(update.cta.href, '_blank', 'noopener,noreferrer')
            }
          },
          onPrevClick: () => {
            instance.destroy()
            trackProductUpdate('Spotlight Dismissed', update.id)
            dismiss(update.id)
          },
          onCloseClick: () => {
            instance.destroy()
          },
        },
      })

      // Recorded after the overlay is up, so the counter only ever grows for a
      // spotlight the reader actually saw.
      recordPresentation(update.id)
      trackProductUpdate('Spotlight Presented', update.id)
    },
    [dismiss, language, markRead, recordPresentation, router, t]
  )

  useEffect(() => {
    if (!autoPresent || loading || autoPresented.current) return
    if (spotlightSeenThisSession()) return

    const candidate = entries.find(
      (entry) =>
        entry.update.promotions.includes('spotlight') &&
        !entry.dismissed &&
        (entry.state?.presentationCount ?? 0) < MAX_UNSOLICITED_PRESENTATIONS &&
        resolveSpotlightTarget(entry.update.spotlightTarget) !== null
    )
    if (!candidate) return

    // The session slot is claimed before the overlay opens: if presenting fails
    // for any reason, the next page load must not try again, or the cap would
    // silently depend on render timing.
    autoPresented.current = true
    rememberSpotlightThisSession()
    present(candidate.update)
  }, [autoPresent, entries, loading, present])

  useEffect(() => {
    if (!pendingReplay) return

    // The feed modal that asked for this replay is still unmounting in the
    // current commit, and its focus trap would fight the popover. One frame
    // later the overlay has the page to itself.
    const frame = requestAnimationFrame(() => {
      present(pendingReplay)
      setPendingReplay(null)
    })

    return () => cancelAnimationFrame(frame)
  }, [pendingReplay, present])

  useEffect(
    () => () => {
      activeDriver.current?.destroy()
    },
    []
  )

  return {
    replaySpotlight: useCallback(
      (update: ProductUpdate) => setPendingReplay(update),
      []
    ),
  }
}
