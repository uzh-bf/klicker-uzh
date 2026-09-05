import type { ProductUpdate } from '@klicker-uzh/product-updates'
import { type Driver, driver } from 'driver.js'
import 'driver.js/dist/driver.css'
import { useRouter } from 'next/router'
import { useLocale, useTranslations } from 'next-intl'
import { useCallback, useEffect, useRef, useState } from 'react'
import { openProductUpdateCta } from './openCta'
import { resolveSpotlightTarget } from './spotlightTargets'
import { trackProductUpdate } from './tracking'
import type { UseProductUpdatesResult } from './useProductUpdates'

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

// Driver.js blocks pointer events on the entire document while an overlay is
// open. These are the routes where that would interrupt time-critical steering
// or grading work: the live quiz cockpit drives a running quiz, and the
// assessment live quiz page carries the point corrections. They show a
// spotlight only when the lecturer asks for one; the values are Next.js route
// patterns as reported by `router.pathname`.
const AUTO_PRESENT_SUPPRESSED_ROUTES = new Set([
  '/quizzes/[id]/cockpit',
  '/courses/[id]/assessment/liveQuiz/[quizId]',
])

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

// Driver.js writes every popover string into the DOM with innerHTML, unlike the
// feed card, where React escapes the same catalog text. A title such as
// "Faster grading (<2s)" would otherwise lose part of itself to the parser.
function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => HTML_ESCAPES[character]!)
}

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
 *
 * The caller passes in its own feed result rather than the hook reading the feed
 * again, so that a component showing both the cards and the spotlight keeps one
 * query and reports eligibility once.
 */
export function useProductUpdateSpotlight({
  updates,
  autoPresent = false,
}: {
  updates: UseProductUpdatesResult
  autoPresent?: boolean
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
    // Checked before the session slot is claimed, so leaving the live session
    // for an ordinary page still shows the spotlight there.
    if (AUTO_PRESENT_SUPPRESSED_ROUTES.has(router.pathname)) return
    if (spotlightSeenThisSession()) return

    const candidate = entries.find(
      (entry) =>
        entry.update.promotions.includes('spotlight') &&
        !entry.dismissed &&
        (entry.state?.presentationCount ?? 0) < MAX_UNSOLICITED_PRESENTATIONS &&
        resolveSpotlightTarget(entry.update.spotlightTarget) !== null
    )
    if (!candidate) return

    // Opening is deferred by one frame so that a mount which is undone straight
    // away — React's development double-invocation, or a layout that flips back
    // to its loading state — cannot burn the session's single spotlight on an
    // overlay that is torn down again immediately.
    const frame = requestAnimationFrame(() => {
      // The session slot is claimed before the overlay opens: if presenting
      // fails for any reason, the next page load must not try again, or the cap
      // would silently depend on render timing.
      autoPresented.current = true
      rememberSpotlightThisSession()
      present(candidate.update)
    })

    return () => cancelAnimationFrame(frame)
  }, [autoPresent, entries, statesLoaded, present, router.pathname])

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
