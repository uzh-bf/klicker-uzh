import type { FeatureFlagKey } from '@klicker-uzh/feature-flags'
import type {
  ProductUpdate,
  ProductUpdateAudience,
  ProductUpdateSurface,
} from './types'

export interface SelectEligibleUpdatesArgs {
  updates: ProductUpdate[]
  audience: ProductUpdateAudience
  surface: ProductUpdateSurface
  // Evaluated feature flags. A key that is missing or not exactly `true`
  // counts as disabled, matching the fail-closed fallback of the flag registry.
  flags?: Partial<Record<FeatureFlagKey, boolean>>
  now?: Date
  isAssessment?: boolean
}

function isWithinPublicationWindow(update: ProductUpdate, now: Date): boolean {
  const publishedAt = Date.parse(update.publishedAt)
  // An unparsable date is a content error that the validation suite catches at
  // build time; at runtime the entry is dropped rather than shown forever.
  if (Number.isNaN(publishedAt) || publishedAt > now.getTime()) return false

  if (update.expiresAt === undefined) return true

  const expiresAt = Date.parse(update.expiresAt)
  if (Number.isNaN(expiresAt)) return false

  return now.getTime() < expiresAt
}

/**
 * Filters the catalog down to the entries a given actor may currently be shown
 * on a given surface. Pure and side-effect free: presentation, read state, and
 * flag evaluation all happen in the calling application.
 *
 * The result keeps the catalog's newest-first order.
 */
export function selectEligibleUpdates({
  updates,
  audience,
  surface,
  flags = {},
  now = new Date(),
  isAssessment = false,
}: SelectEligibleUpdatesArgs): ProductUpdate[] {
  return updates.filter((update) => {
    if (isAssessment && update.suppressInAssessment) return false
    if (!update.audiences.includes(audience)) return false
    if (!update.surfaces.includes(surface)) return false
    if (!isWithinPublicationWindow(update, now)) return false

    // An entry without flag requirements is always eligible, so that retiring a
    // flag never removes an already announced entry.
    return (update.requiredFeatureFlags ?? []).every(
      (key) => flags[key] === true
    )
  })
}

export interface SelectLatestReleasedUpdateArgs {
  updates: ProductUpdate[]
  surface: ProductUpdateSurface
  now?: Date
}

/**
 * Returns the newest currently published entry with maturity `released` for a
 * surface that has no actor, such as the public documentation homepage. Entries
 * that require a feature flag are skipped, because an anonymous surface cannot
 * evaluate flags for anyone.
 *
 * The first match wins, so `updates` must already be ordered newest first.
 * `PRODUCT_UPDATES` satisfies that precondition and the catalog validation
 * suite enforces it.
 */
export function selectLatestReleasedUpdate({
  updates,
  surface,
  now = new Date(),
}: SelectLatestReleasedUpdateArgs): ProductUpdate | undefined {
  return updates.find(
    (update) =>
      update.maturity === 'released' &&
      update.surfaces.includes(surface) &&
      (update.requiredFeatureFlags ?? []).length === 0 &&
      isWithinPublicationWindow(update, now)
  )
}
