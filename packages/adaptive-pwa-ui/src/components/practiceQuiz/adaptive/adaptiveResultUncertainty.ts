import {
  type AdaptiveResultLevelBand,
  findAdaptiveLevelBandLabel,
  prepareAdaptiveResultLevelBands,
} from '@klicker-uzh/adaptive-contract'

export type AdaptiveEstimatedLevelRange = {
  lowerLevelLabel: string
  upperLevelLabel: string
}

/** Presentation only: this does not turn a provisional posterior into a classification. */
export function getAdaptiveProfileIndication({
  responseCount,
  classification,
  position,
  lowerPosition,
  upperPosition,
  levelBands,
}: {
  responseCount: number
  classification: string
  position?: number | null
  lowerPosition?: number | null
  upperPosition?: number | null
  levelBands: AdaptiveResultLevelBand[]
}) {
  if (
    responseCount < 1 ||
    !['CLASSIFIED', 'BETWEEN_LEVELS', 'INSUFFICIENT_EVIDENCE'].includes(
      classification
    ) ||
    typeof position !== 'number' ||
    !Number.isFinite(position)
  )
    return null

  const range = getAdaptiveEstimatedLevelRange({
    lowerPosition,
    upperPosition,
    levelBands,
  })
  const levelLabel = findAdaptiveLevelBandLabel(position, levelBands)
  return range && levelLabel ? { ...range, levelLabel } : null
}

export function getAdaptiveEstimatedLevelRange({
  lowerPosition,
  upperPosition,
  levelBands,
}: {
  lowerPosition?: number | null
  upperPosition?: number | null
  levelBands: AdaptiveResultLevelBand[]
}): AdaptiveEstimatedLevelRange | null {
  if (
    typeof lowerPosition !== 'number' ||
    typeof upperPosition !== 'number' ||
    !Number.isFinite(lowerPosition) ||
    !Number.isFinite(upperPosition)
  ) {
    return null
  }

  const bands = prepareAdaptiveResultLevelBands(levelBands)
  if (bands.length === 0) return null

  const lowerLevelLabel = findAdaptiveLevelBandLabel(
    Math.min(lowerPosition, upperPosition),
    bands
  )
  const upperLevelLabel = findAdaptiveLevelBandLabel(
    Math.max(lowerPosition, upperPosition),
    bands
  )

  if (!lowerLevelLabel || !upperLevelLabel) return null

  return { lowerLevelLabel, upperLevelLabel }
}
