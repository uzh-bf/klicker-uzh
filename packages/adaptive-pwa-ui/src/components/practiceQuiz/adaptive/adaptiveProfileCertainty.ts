import {
  type AdaptiveResultLevelBand,
  findAdaptiveLevelBandLabel,
  prepareAdaptiveResultLevelBands,
} from '@klicker-uzh/adaptive-contract'
import { getAdaptiveLevelColorSpecs } from './adaptiveLevelPalette'

/**
 * Student-facing certainty for competence profile rows. Presentation only:
 * nothing here changes estimates, classification, stopping, or what counts as
 * a determined level. It only describes how wide the plausible range already
 * is, in plain words.
 *
 * Width is measured on the quiz's own level scale:
 * - `levelCount`: levels the plausible range touches (both ends included)
 * - `levelFraction`: levelCount / all levels on the scale
 * - `mainLevelCount`: distinct main levels touched (A2.1-A2.3 -> A2; an
 *   unprefixed level such as "Under A2", or every level of an ungrouped
 *   scale, counts as its own main level)
 *
 * Width certainty (ADAPTIVE_CERTAINTY_THRESHOLDS):
 * - HIGH: the range stays within one level, or it touches at most 20% of the
 *   levels and at most 2 main levels (16 CEFR sublevels: <= 3 sublevels,
 *   e.g. B1.2-B2.1)
 * - MEDIUM: at most 1/3 of the levels and at most 3 main levels
 *   (16 CEFR sublevels: <= 5 sublevels, e.g. B1.3-C1.1)
 * - LOW: anything wider
 */
export type AdaptiveCertaintyLevel = 'HIGH' | 'MEDIUM' | 'LOW'

export const ADAPTIVE_CERTAINTY_THRESHOLDS = {
  HIGH: { maxLevelFraction: 0.2, maxMainLevels: 2 },
  MEDIUM: { maxLevelFraction: 1 / 3, maxMainLevels: 3 },
} as const

const CERTAINTY_RANK: Record<AdaptiveCertaintyLevel, number> = {
  LOW: 0,
  MEDIUM: 1,
  HIGH: 2,
}

export type AdaptiveRangeWidth = {
  lowerLevelLabel: string
  upperLevelLabel: string
  levelCount: number
  totalLevels: number
  levelFraction: number
  mainLevelCount: number
}

/** Main-level key per prepared band (e.g. "B1" for "B1.3"). */
export function getAdaptiveMainLevelLabels(
  bands: ReadonlyArray<{ label: string }>
): string[] {
  const specs = getAdaptiveLevelColorSpecs(bands.map((band) => band.label))
  return bands.map((band, index) => specs[index]?.group ?? band.label)
}

function findBandIndex(position: number, bands: AdaptiveResultLevelBand[]) {
  const label = findAdaptiveLevelBandLabel(position, bands)
  return label === null ? -1 : bands.findIndex((band) => band.label === label)
}

export function getAdaptiveRangeWidth({
  lowerPosition,
  upperPosition,
  levelBands,
}: {
  lowerPosition?: number | null
  upperPosition?: number | null
  levelBands: AdaptiveResultLevelBand[]
}): AdaptiveRangeWidth | null {
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
  const lowerIndex = findBandIndex(
    Math.min(lowerPosition, upperPosition),
    bands
  )
  const upperIndex = findBandIndex(
    Math.max(lowerPosition, upperPosition),
    bands
  )
  if (lowerIndex < 0 || upperIndex < 0) return null

  const mainLevels = getAdaptiveMainLevelLabels(bands)
  const levelCount = upperIndex - lowerIndex + 1
  return {
    lowerLevelLabel: bands[lowerIndex]!.label,
    upperLevelLabel: bands[upperIndex]!.label,
    levelCount,
    totalLevels: bands.length,
    levelFraction: levelCount / bands.length,
    mainLevelCount: new Set(mainLevels.slice(lowerIndex, upperIndex + 1)).size,
  }
}

/** Certainty from the width of the plausible range alone. */
export function getAdaptiveWidthCertainty(
  width: Pick<
    AdaptiveRangeWidth,
    'levelCount' | 'levelFraction' | 'mainLevelCount'
  >
): AdaptiveCertaintyLevel {
  if (width.levelCount <= 1) return 'HIGH'
  for (const level of ['HIGH', 'MEDIUM'] as const) {
    const threshold = ADAPTIVE_CERTAINTY_THRESHOLDS[level]
    if (
      width.levelFraction <= threshold.maxLevelFraction + 1e-9 &&
      width.mainLevelCount <= threshold.maxMainLevels
    ) {
      return level
    }
  }
  return 'LOW'
}

function minCertainty(
  left: AdaptiveCertaintyLevel,
  right: AdaptiveCertaintyLevel
) {
  return CERTAINTY_RANK[left] <= CERTAINTY_RANK[right] ? left : right
}

function maxCertainty(
  left: AdaptiveCertaintyLevel,
  right: AdaptiveCertaintyLevel
) {
  return CERTAINTY_RANK[left] >= CERTAINTY_RANK[right] ? left : right
}

/**
 * Certainty shown on a profile row. The width decides, bounded by the
 * engine's own classification so the two never contradict each other:
 * - CLASSIFIED (level determined): at least MEDIUM
 * - BETWEEN_LEVELS: at most MEDIUM
 * - INSUFFICIENT_EVIDENCE (rough estimate below the reporting minimum):
 *   always LOW
 * - other classifications (no estimate): null
 */
export function getAdaptiveProfileCertainty({
  classification,
  width,
}: {
  classification: string
  width: AdaptiveRangeWidth | null
}): AdaptiveCertaintyLevel | null {
  if (!width) return null
  const fromWidth = getAdaptiveWidthCertainty(width)
  switch (classification) {
    case 'CLASSIFIED':
      return maxCertainty(fromWidth, 'MEDIUM')
    case 'BETWEEN_LEVELS':
      return minCertainty(fromWidth, 'MEDIUM')
    case 'INSUFFICIENT_EVIDENCE':
      return 'LOW'
    default:
      return null
  }
}

export type AdaptiveRoughEstimateDisplay =
  /** Narrow range: the rough sublevel itself is meaningful. */
  | { kind: 'level'; levelLabel: string }
  /** Moderately wide: only the main level ("around B1"). */
  | { kind: 'mainLevel'; levelLabel: string }
  /** Too wide: no level is shown at all. */
  | { kind: 'notEnoughAnswers' }

/**
 * What a rough estimate (answers, but below the reporting minimum) may show.
 * Uses the same width thresholds as the certainty indicator:
 * - width HIGH -> the rough sublevel (e.g. "B2.3")
 * - width MEDIUM -> the main level of the point estimate (e.g. "around B1")
 * - width LOW (more than 1/3 of the scale or 3+ main levels, e.g. "Under A2 -
 *   C2.3" after 2 answers) -> "not enough answers yet"; never an extreme
 *   sublevel from a handful of answers
 */
export function getAdaptiveRoughEstimateDisplay({
  levelLabel,
  width,
  levelBands,
}: {
  levelLabel?: string | null
  width: AdaptiveRangeWidth | null
  levelBands: AdaptiveResultLevelBand[]
}): AdaptiveRoughEstimateDisplay {
  if (!levelLabel || !width) return { kind: 'notEnoughAnswers' }
  const widthCertainty = getAdaptiveWidthCertainty(width)
  if (widthCertainty === 'HIGH') return { kind: 'level', levelLabel }
  if (widthCertainty === 'LOW') return { kind: 'notEnoughAnswers' }
  const bands = prepareAdaptiveResultLevelBands(levelBands)
  const index = bands.findIndex((band) => band.label === levelLabel)
  if (index < 0) return { kind: 'notEnoughAnswers' }
  return {
    kind: 'mainLevel',
    levelLabel: getAdaptiveMainLevelLabels(bands)[index]!,
  }
}

export type AdaptiveMainLevelSegment = {
  label: string
  /** False for unprefixed edge levels ("Under A2") and ungrouped scales. */
  grouped: boolean
  startIndex: number
  endIndex: number
}

/** Consecutive bands merged by main level, for the simplified track. */
export function getAdaptiveMainLevelSegments(
  bands: ReadonlyArray<{ label: string }>
): AdaptiveMainLevelSegment[] {
  const specs = getAdaptiveLevelColorSpecs(bands.map((band) => band.label))
  const segments: AdaptiveMainLevelSegment[] = []
  for (const [index, band] of bands.entries()) {
    const group = specs[index]?.group ?? null
    const last = segments.at(-1)
    if (group !== null && last?.grouped && last.label === group) {
      last.endIndex = index
      continue
    }
    segments.push({
      label: group ?? band.label,
      grouped: group !== null,
      startIndex: index,
      endIndex: index,
    })
  }
  return segments
}
