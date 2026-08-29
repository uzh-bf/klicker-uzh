import { useMutation, useQuery } from '@apollo/client'
import {
  MarkTourCompletedDocument,
  TourStatesDocument,
} from '@klicker-uzh/graphql/dist/ops'
import type { TourId } from '@klicker-uzh/product-tours'
import {
  type ProductTourStep,
  type UseProductTourResult,
  useProductTour,
} from '@klicker-uzh/product-tours/react'
import { useTranslations } from 'next-intl'
import { useCallback, useMemo } from 'react'
import { resolveFeatureTarget } from './featureTargets'

const PWA_ONBOARDING_TOUR_ID: TourId = 'pwa-onboarding-v1'

const TOUR_IDS = [PWA_ONBOARDING_TOUR_ID]

/**
 * Runs the student onboarding tour: a short walk over the overview page, the
 * place every student reaches after logging in.
 *
 * It starts on its own at most once per account — the account has no stored
 * completion — and at most once per browser tab across every overlay, which the
 * shared session slot in `@klicker-uzh/product-tours` enforces. Ending the tour
 * in any way counts as done, so nobody is walked through it twice; the replay
 * from the profile page ignores both caps and leaves the stored completion
 * untouched.
 *
 * The hook asks the backend about tour state as soon as it runs, so only a
 * surface that may show the tour is allowed to mount it. `PwaOnboardingTour`
 * is that gate, and it is the only caller.
 */
export function usePwaOnboardingTour(): UseProductTourResult {
  const t = useTranslations()

  const { data, loading, error } = useQuery(TourStatesDocument, {
    variables: { tourIds: TOUR_IDS },
    // The state is cookie-scoped and must never be server-rendered into a page
    // that another participant could receive from a cache.
    ssr: false,
  })

  const [markTourCompleted] = useMutation(MarkTourCompletedDocument)

  // A failed query answers with no rows, which is indistinguishable from an
  // account that has never seen the tour, so the tour stays closed for this
  // page view on error rather than guessing eligibility.
  const statesLoaded = !loading && !error
  const completed = Boolean(
    data?.tourStates.find((state) => state.tourId === PWA_ONBOARDING_TOUR_ID)
      ?.completedAt
  )

  const recordCompletion = useCallback(() => {
    void markTourCompleted({
      variables: { tourId: PWA_ONBOARDING_TOUR_ID },
      update: (cache, result) => {
        if (!result.data) return

        cache.updateQuery(
          { query: TourStatesDocument, variables: { tourIds: TOUR_IDS } },
          () => ({ tourStates: [result.data!.markTourCompleted] })
        )
      },
      // Tour state is a convenience, never a gate: a rejected write must not
      // break the page.
      onError: () => {},
    })
  }, [markTourCompleted])

  const steps = useMemo<ProductTourStep[]>(
    () => [
      {
        // No element: driver.js centers a step that names none, which is how
        // the tour opens with a welcome card instead of pointing somewhere.
        title: t('pwa.productTours.onboarding.welcomeTitle'),
        description: t('pwa.productTours.onboarding.welcomeBody'),
      },
      {
        element: () => resolveFeatureTarget('pwa-home-practice'),
        title: t('pwa.productTours.onboarding.practiceTitle'),
        description: t('pwa.productTours.onboarding.practiceBody'),
      },
      {
        element: () => resolveFeatureTarget('pwa-home-courses'),
        title: t('pwa.productTours.onboarding.coursesTitle'),
        description: t('pwa.productTours.onboarding.coursesBody'),
      },
      {
        element: () => resolveFeatureTarget('pwa-home-insights'),
        title: t('pwa.productTours.onboarding.insightsTitle'),
        description: t('pwa.productTours.onboarding.insightsBody'),
        // The insights section is the last one on the page, so a popover below
        // it would sit under the mobile menu bar or off the viewport.
        side: 'top',
      },
      {
        element: () => resolveFeatureTarget('pwa-header-product-updates'),
        title: t('pwa.productTours.onboarding.updatesTitle'),
        description: t('pwa.productTours.onboarding.updatesBody'),
        // Both header targets sit at the right edge, where a popover centered
        // under them would hang off a phone screen.
        align: 'end',
      },
      {
        element: () => resolveFeatureTarget('pwa-header-account'),
        title: t('pwa.productTours.onboarding.profileTitle'),
        description: t('pwa.productTours.onboarding.profileBody'),
        align: 'end',
      },
    ],
    [t]
  )

  const labels = useMemo(
    () => ({
      next: t('pwa.productTours.next'),
      previous: t('pwa.productTours.previous'),
      done: t('pwa.productTours.done'),
      // Driver.js fills its own counters into the rendered string, so the
      // markers travel through the translation as plain values.
      progress: t('pwa.productTours.progress', {
        current: '{{current}}',
        total: '{{total}}',
      }),
    }),
    [t]
  )

  return useProductTour({
    steps,
    labels,
    autoStart: statesLoaded ? !completed : error ? false : null,
    onComplete: recordCompletion,
    onSkip: recordCompletion,
    onDismiss: recordCompletion,
  })
}
