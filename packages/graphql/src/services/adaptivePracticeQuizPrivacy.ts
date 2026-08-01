export const ADAPTIVE_PRIVACY_MIN_CELL_SIZE = 5

export const ADAPTIVE_PRIVACY_FIELDS = [
  'DISTRIBUTION',
  'RESULT_CLASSIFICATION',
  'CLASSIFIED',
  'CAPPED',
  'POOL_EXHAUSTED',
  'STOPPED_INSUFFICIENT_DATA',
  'INSUFFICIENT_DATA',
  'NEAR_BOUNDARY',
  'QUESTION_COUNT_PERCENTILES',
  'DURATION_PERCENTILES',
  'RESPONSE_COUNT_MISMATCH',
  'DURATION_MISSING',
  'ITEM_EXPOSURE',
  'ITEM_ACCURACY',
  'ITEM_RESIDUAL',
] as const

export type AdaptivePrivacyField = (typeof ADAPTIVE_PRIVACY_FIELDS)[number]

export const ADAPTIVE_PRIVACY_SUPPRESSION_REASONS = [
  'BELOW_RELEASE_THRESHOLD',
  'SMALL_CELL_OR_COMPLEMENT',
  'SMALL_KNOWN_OR_MISSING_PARTITION',
  'MINIMUM_RESPONSES',
] as const

export type AdaptivePrivacySuppressionReason =
  (typeof ADAPTIVE_PRIVACY_SUPPRESSION_REASONS)[number]

export type AdaptivePrivacySuppression = {
  field: AdaptivePrivacyField
  reason: AdaptivePrivacySuppressionReason
}

export type AdaptivePrivacyRelease<T> = {
  value: T | null
  suppression: AdaptivePrivacySuppression | null
}

type AdaptivePrivacyDecision =
  | { allowed: true; reason: null }
  | { allowed: false; reason: AdaptivePrivacySuppressionReason }

export function decideAdaptivePrivacyPartition(
  cells: readonly number[],
  smallPartitionReason: AdaptivePrivacySuppressionReason = 'SMALL_CELL_OR_COMPLEMENT'
): AdaptivePrivacyDecision {
  if (cells.length < 2) {
    throw new Error('Adaptive privacy partitions require at least two cells.')
  }
  for (const count of cells) assertCount(count)

  const total = cells.reduce((sum, count) => sum + count, 0)
  if (total < ADAPTIVE_PRIVACY_MIN_CELL_SIZE) {
    return { allowed: false, reason: 'BELOW_RELEASE_THRESHOLD' }
  }
  if (
    cells.some((count) => count > 0 && count < ADAPTIVE_PRIVACY_MIN_CELL_SIZE)
  ) {
    return { allowed: false, reason: smallPartitionReason }
  }
  return { allowed: true, reason: null }
}

export function releaseAdaptiveCategoricalMetric<T>({
  field,
  cells,
  value,
}: {
  field: AdaptivePrivacyField
  cells: readonly number[]
  value: T
}): AdaptivePrivacyRelease<T> {
  return releaseAdaptiveMetric(
    field,
    value,
    decideAdaptivePrivacyPartition(cells)
  )
}

export function releaseAdaptiveBinaryMetric<T>({
  field,
  total,
  positive,
  value,
}: {
  field: AdaptivePrivacyField
  total: number
  positive: number
  value: T
}): AdaptivePrivacyRelease<T> {
  assertCount(total)
  assertCount(positive)
  if (positive > total) {
    throw new Error('Adaptive privacy count cannot exceed its population.')
  }
  return releaseAdaptiveMetric(
    field,
    value,
    decideAdaptivePrivacyPartition([positive, total - positive])
  )
}

export function releaseAdaptiveKnownMissingMetric<T>({
  field,
  total,
  known,
  value,
}: {
  field: AdaptivePrivacyField
  total: number
  known: number
  value: T
}): AdaptivePrivacyRelease<T> {
  assertCount(total)
  assertCount(known)
  if (known > total) {
    throw new Error(
      'Adaptive privacy known count cannot exceed its population.'
    )
  }
  return releaseAdaptiveMetric(
    field,
    value,
    decideAdaptivePrivacyPartition(
      [known, total - known],
      'SMALL_KNOWN_OR_MISSING_PARTITION'
    )
  )
}

export function suppressAdaptiveMetric<T>(
  field: AdaptivePrivacyField,
  reason: AdaptivePrivacySuppressionReason
): AdaptivePrivacyRelease<T> {
  return {
    value: null,
    suppression: { field, reason },
  }
}

export function compactAdaptivePrivacySuppressions(
  suppressions: readonly (AdaptivePrivacySuppression | null)[]
): AdaptivePrivacySuppression[] {
  return suppressions.filter(
    (suppression): suppression is AdaptivePrivacySuppression =>
      suppression !== null
  )
}

export function hasAdaptivePrivacyWithholding(
  suppressions: readonly AdaptivePrivacySuppression[]
) {
  return suppressions.some(({ reason }) => reason !== 'MINIMUM_RESPONSES')
}

function releaseAdaptiveMetric<T>(
  field: AdaptivePrivacyField,
  value: T,
  decision: AdaptivePrivacyDecision
): AdaptivePrivacyRelease<T> {
  return decision.allowed
    ? { value, suppression: null }
    : {
        value: null,
        suppression: { field, reason: decision.reason },
      }
}

function assertCount(count: number) {
  if (!Number.isSafeInteger(count) || count < 0) {
    throw new Error('Adaptive privacy counts must be non-negative integers.')
  }
}
