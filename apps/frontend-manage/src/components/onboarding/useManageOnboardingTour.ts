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
import 'driver.js/dist/driver.css'
import { useRouter } from 'next/router'
import { useTranslations } from 'next-intl'
import { useCallback, useMemo } from 'react'
import { resolveFeatureTarget } from './featureTargets'
import { autoPresentSuppressed } from './suppressedRoutes'

const MANAGE_ONBOARDING_TOUR_ID: TourId = 'manage-onboarding-v1'

const TOUR_IDS = [MANAGE_ONBOARDING_TOUR_ID]

/**
 * Runs the lecturer onboarding tour: a short walk through the parts of the
 * manage interface that are on every page.
 *
 * It starts on its own at most once per account — the account has no stored
 * completion — and at most once per browser tab across every overlay, which the
 * shared session slot in `@klicker-uzh/product-tours` enforces. Ending the tour
 * in any way counts as done, so nobody is walked through it twice; the replay
 * from the support modal ignores both caps and leaves the stored completion
 * untouched.
 *
 * Exactly one mount may exist per page, because two would both claim the
 * session slot in the same render pass. The manage header owns it.
 */
export function useManageOnboardingTour(): UseProductTourResult {
  const t = useTranslations()
  const router = useRouter()

  const { data, loading, error } = useQuery(TourStatesDocument, {
    variables: { tourIds: TOUR_IDS },
    // The state is cookie-scoped and must never be server-rendered into a page
    // that another lecturer could receive from a cache.
    ssr: false,
  })

  const [markTourCompleted] = useMutation(MarkTourCompletedDocument)

  // A failed query answers with no rows, which is indistinguishable from an
  // account that has never seen the tour, so the tour stays closed for this
  // page view on error rather than guessing eligibility. That still resolves
  // `autoStart` (instead of leaving it unknown), so it no longer blocks the
  // shared spotlight slot for the rest of the page view.
  const statesLoaded = !loading && !error
  const completed = Boolean(
    data?.tourStates.find((state) => state.tourId === MANAGE_ONBOARDING_TOUR_ID)
      ?.completedAt
  )

  const recordCompletion = useCallback(() => {
    void markTourCompleted({
      variables: { tourId: MANAGE_ONBOARDING_TOUR_ID },
      update: (cache, result) => {
        if (!result.data) return

        cache.updateQuery(
          { query: TourStatesDocument, variables: { tourIds: TOUR_IDS } },
          () => ({ tourStates: [result.data!.markTourCompleted] })
        )
      },
      // Tour state is a convenience, never a gate: a rejected write — a
      // read-only delegated session, for instance — must not break the page.
      onError: () => {},
    })
  }, [markTourCompleted])

  const steps = useMemo<ProductTourStep[]>(
    () => [
      {
        // No element: driver.js centers a step that names none, which is how
        // the tour opens with a welcome card instead of pointing somewhere.
        title: t('manage.productTours.onboarding.welcomeTitle'),
        description: t('manage.productTours.onboarding.welcomeBody'),
      },
      {
        element: () => resolveFeatureTarget('manage-header-main-nav'),
        title: t('manage.productTours.onboarding.navigationTitle'),
        description: t('manage.productTours.onboarding.navigationBody'),
      },
      {
        element: () => resolveFeatureTarget('manage-header-analytics'),
        title: t('manage.productTours.onboarding.analyticsTitle'),
        description: t('manage.productTours.onboarding.analyticsBody'),
      },
      {
        element: () => resolveFeatureTarget('manage-header-product-updates'),
        title: t('manage.productTours.onboarding.updatesTitle'),
        description: t('manage.productTours.onboarding.updatesBody'),
        // The bell sits at the right edge, where a popover anchored below it
        // would hang off the window.
        align: 'end',
      },
      {
        element: () => resolveFeatureTarget('manage-header-account'),
        title: t('manage.productTours.onboarding.supportTitle'),
        description: t('manage.productTours.onboarding.supportBody'),
        align: 'end',
      },
    ],
    [t]
  )

  const labels = useMemo(
    () => ({
      next: t('manage.productTours.next'),
      previous: t('manage.productTours.previous'),
      done: t('manage.productTours.done'),
      // Driver.js fills its own counters into the rendered string, so the
      // markers travel through the translation as plain values.
      progress: t('manage.productTours.progress', {
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
    autoStartSuppressed: autoPresentSuppressed(router.pathname),
    onComplete: recordCompletion,
    onSkip: recordCompletion,
    onDismiss: recordCompletion,
  })
}
