import { useRouter } from 'next/router'
import { useEffect, useRef } from 'react'
import { usePwaOnboardingTour } from './usePwaOnboardingTour'

/**
 * Asks the overview page to start the tour as soon as it has loaded. The tour
 * walks over the overview page, so a replay elsewhere in the app navigates
 * there first instead of showing the two or three steps that happen to exist on
 * the current page.
 */
export const TOUR_REPLAY_HREF = '/?tour=1'

const REPLAY_QUERY_PARAM = 'tour'

/**
 * Mounts the student onboarding tour on the page that hosts it.
 *
 * Mounting is the entire suppression decision: the layout renders this only for
 * a registered participant reading the loaded overview page, so every excluded
 * surface — the assessment build, an embedded page, a live quiz, a page where
 * questions are being answered, a temporary participant — asks the backend
 * nothing at all about tour state. It renders no markup of its own; the overlay
 * driver.js opens lives outside the React tree.
 */
function PwaOnboardingTour(): null {
  const router = useRouter()
  const { startTour } = usePwaOnboardingTour()
  // The replay request is spent on the first mount that sees it, so that
  // stripping it from the URL cannot start a second run.
  const replayStarted = useRef(false)

  const replayRequested = router.query[REPLAY_QUERY_PARAM] === '1'

  useEffect(() => {
    if (!replayRequested || replayStarted.current) return

    replayStarted.current = true
    startTour()

    // The parameter is an instruction, not a location: leaving it in the URL
    // would restart the tour on every reload and on every back navigation.
    const { [REPLAY_QUERY_PARAM]: _replay, ...remainingQuery } = router.query
    router.replace(
      { pathname: router.pathname, query: remainingQuery },
      undefined,
      {
        shallow: true,
      }
    )
  }, [replayRequested, router, startTour])

  return null
}

export default PwaOnboardingTour
