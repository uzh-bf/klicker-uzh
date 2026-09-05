import { push } from '@socialgouv/matomo-next'

// The adoption funnel is read as one Matomo category, so every step shares it
// and carries the catalog id as the event name.
const PRODUCT_UPDATE_CATEGORY = 'Product Update'

export type ProductUpdateAction =
  | 'Eligible'
  | 'Presented'
  | 'Opened'
  | 'Dismissed'
  | 'CTA Clicked'
  | 'Details Opened'

export function trackProductUpdate(
  action: ProductUpdateAction,
  updateId: string
) {
  push(['trackEvent', PRODUCT_UPDATE_CATEGORY, action, updateId])
}

// Eligibility is recomputed on every render and in every component that reads
// the feed, while the funnel wants one entry per update and page load. The set
// lives at module scope so that the header and the updates page agree, and it
// resets with the next full page load.
const eligibilityTracked = new Set<string>()

export function trackProductUpdateEligibility(updateIds: string[]) {
  for (const updateId of updateIds) {
    if (eligibilityTracked.has(updateId)) continue

    eligibilityTracked.add(updateId)
    trackProductUpdate('Eligible', updateId)
  }
}
