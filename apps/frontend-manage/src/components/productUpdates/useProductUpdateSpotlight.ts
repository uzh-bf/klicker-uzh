import { escapeHtml } from '@klicker-uzh/product-tours'
import {
  claimUnsolicitedOverlaySlot,
  deferToNextFrame,
  unsolicitedOverlayShownThisSession,
} from '@klicker-uzh/product-tours/react'
import type { ProductUpdate } from '@klicker-uzh/product-updates'
import { type Driver, driver } from 'driver.js'
import 'driver.js/dist/driver.css'
import { useRouter } from 'next/router'
import { useLocale, useTranslations } from 'next-intl'
import { useCallback, useEffect, useRef, useState } from 'react'
import { resolveFeatureTarget } from '../onboarding/featureTargets'
import { autoPresentSuppressed } from '../onboarding/suppressedRoutes'
import { openProductUpdateCta } from './openCta'
import { trackProductUpdate } from './tracking'
import type { UseProductUpdatesResult } from './useProductUpdates'

// An entry stops presenting itself once it has been shown this often. The
// counter only moves when a presentation is explicitly recorded, so the cap is
// reached by two real appearances rather than by rerenders.
const MAX_UNSOLICITED_PRESENTATIONS = 2

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
 * replay-only instance. That slot is shared with the onboarding tour, so a
 * lecturer never gets two overlays in one tab.
 *
 * Replays are what the reader explicitly asked for, so they ignore both caps.
 *
 * The caller passes in its own feed result rather than the hook reading the feed
 * again, so that a component showing both the cards and the spotlight keeps one
 * query and reports eligibility once.
 */
export function useProductUpdateSpotlight({
  updates,
  autoPresent = false,
  autoPresentReady = true,
}: {
  updates: UseProductUpdatesResult
  autoPresent?: boolean
  // False while another overlay may still claim the session slot. The
  // onboarding tour decides first, so a lecturer who has never seen it is
  // walked through the interface instead of being shown a single feature.
  autoPresentReady?: boolean
}): UseProductUpdateSpotlightResult {
  const t = useTranslations()
  const locale = useLocale()
  const router = useRouter()
  // Destructured once: the individual callbacks keep a stable identity across
  // renders, while the result object itself does not.
  const { entries, statesLoaded, recordPresentation, markRead, dismiss } =
    updates

  const language = locale === 'de' ? 'de' : 'en'

  // Driver.js tears the overlay down when this component goes away. The ref is
  // per instance rather than global; two instances triggering at once cannot
  // interleave anyway, because the first overlay blocks the page.
  const activeDriver = useRef<Driver | null>(null)
  const autoPresented = useRef(false)
  const [pendingReplay, setPendingReplay] = useState<ProductUpdate | null>(null)

  const present = useCallback(
    (update: ProductUpdate) => {
      const element = resolveFeatureTarget(update.spotlightTarget)
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
          title: escapeHtml(update.title[language]),
          description: escapeHtml(update.summary[language]),
          // Driver.js offers three button slots. A one-step highlight has
          // nothing to go back to, so the previous slot carries the dismissal,
          // while the close icon means "not now" and leaves the entry alone.
          showButtons: ['next', 'previous', 'close'],
          // The next slot doubles as the call to action, so its label has to
          // follow the entry. An entry without a CTA has nothing left to do
          // once the element is highlighted, and offering to show what is
          // already on screen reads as a button that does nothing.
          nextBtnText: escapeHtml(
            t(
              update.cta
                ? 'manage.productUpdates.spotlightConfirm'
                : 'shared.generic.ok'
            )
          ),
          prevBtnText: escapeHtml(t('manage.productUpdates.spotlightDismiss')),
          onNextClick: () => {
            instance.destroy()
            markRead(update.id)

            if (!update.cta) return

            trackProductUpdate('CTA Clicked', update.id)
            openProductUpdateCta(update.cta, router)
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
    // Waiting for `statesLoaded` rather than for the plain loading flag keeps a
    // failed states query from looking like an actor who has never dismissed or
    // seen anything, which would let a dismissed entry return.
    if (!autoPresent || !statesLoaded || autoPresented.current) return
    if (!autoPresentReady) return
    // Checked before the session slot is claimed, so leaving the live session
    // for an ordinary page still shows the spotlight there.
    if (autoPresentSuppressed(router.pathname)) return
    if (unsolicitedOverlayShownThisSession()) return

    const candidate = entries.find(
      (entry) =>
        entry.update.promotions.includes('spotlight') &&
        !entry.dismissed &&
        (entry.state?.presentationCount ?? 0) < MAX_UNSOLICITED_PRESENTATIONS &&
        resolveFeatureTarget(entry.update.spotlightTarget) !== null
    )
    if (!candidate) return

    return deferToNextFrame(() => {
      // The session slot is claimed before the overlay opens: if presenting
      // fails for any reason, the next page load must not try again, or the cap
      // would silently depend on render timing.
      autoPresented.current = true
      claimUnsolicitedOverlaySlot()
      present(candidate.update)
    })
  }, [
    autoPresent,
    autoPresentReady,
    entries,
    statesLoaded,
    present,
    router.pathname,
  ])

  useEffect(() => {
    if (!pendingReplay) return

    // The feed modal that asked for this replay is still unmounting in the
    // current commit, and its focus trap would fight the popover. One frame
    // later the overlay has the page to itself.
    return deferToNextFrame(() => {
      present(pendingReplay)
      setPendingReplay(null)
    })
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
