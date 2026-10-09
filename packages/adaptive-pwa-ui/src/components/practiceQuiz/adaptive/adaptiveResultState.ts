import type { AdaptiveResultLevelBand } from '@klicker-uzh/adaptive-contract'
import {
  type AdaptiveRangeWidth,
  getAdaptiveRangeWidth,
  getAdaptiveRoughEstimateDisplay,
} from './adaptiveProfileCertainty'
import {
  type AdaptiveReportedLevelBand,
  getAdaptiveReportedLevelLabel,
} from './adaptiveReportedLevel'
import { getAdaptiveProfileIndication } from './adaptiveResultUncertainty'

/**
 * Presentation state of one result estimate (overall, competence or nested
 * node). Presentation only: classification and stopping are unchanged.
 *
 * - DETERMINED: the host determination classified the level (including the
 *   quiz tolerance).
 * - ESTIMATED: not determined, but an estimate with a usable range exists.
 *   Always the estimated level itself; the certainty badge and range
 *   sentence carry the uncertainty.
 * - NOT_ENOUGH_ANSWERS: no estimate at all (no answers or no range).
 * - OTHER: between levels, pool limited, research only (existing copy).
 */
export type AdaptiveResultState =
  | { kind: 'DETERMINED'; levelLabel: string; width: AdaptiveRangeWidth | null }
  | {
      kind: 'ESTIMATED'
      levelLabel: string
      width: AdaptiveRangeWidth
    }
  | { kind: 'NOT_ENOUGH_ANSWERS' }
  | { kind: 'OTHER'; width: AdaptiveRangeWidth | null }

export function getAdaptiveResultState({
  classification,
  levelLabel,
  roughLevelLabel,
  responseCount,
  position,
  lowerPosition,
  upperPosition,
  levelBands,
}: {
  classification: string
  levelLabel?: string | null
  roughLevelLabel?: string | null
  responseCount: number
  position?: number | null
  lowerPosition?: number | null
  upperPosition?: number | null
  levelBands: AdaptiveResultLevelBand[]
}): AdaptiveResultState {
  const width = getAdaptiveRangeWidth({
    lowerPosition,
    upperPosition,
    levelBands,
  })
  if (classification === 'CLASSIFIED') {
    return levelLabel
      ? { kind: 'DETERMINED', levelLabel, width }
      : { kind: 'NOT_ENOUGH_ANSWERS' }
  }
  if (classification !== 'INSUFFICIENT_EVIDENCE') {
    return { kind: 'OTHER', width }
  }
  const indication = getAdaptiveProfileIndication({
    responseCount,
    classification,
    position,
    lowerPosition,
    upperPosition,
    levelBands,
  })
  if (!indication || !width) return { kind: 'NOT_ENOUGH_ANSWERS' }
  const rough = getAdaptiveRoughEstimateDisplay({
    levelLabel: roughLevelLabel ?? indication.levelLabel,
    width,
    levelBands,
  })
  if (rough.kind === 'notEnoughAnswers') return { kind: 'NOT_ENOUGH_ANSWERS' }
  return { kind: 'ESTIMATED', levelLabel: rough.levelLabel, width }
}

/** True when a level lies beyond the bands with published elements. */
export function isAdaptiveLevelAtUnmeasuredEdge({
  levelLabel,
  levelBands,
}: {
  levelLabel: string
  levelBands: readonly AdaptiveReportedLevelBand[]
}) {
  const edge = measurableEdges(levelBands)
  const band = levelBands.find(({ label }) => label === levelLabel)
  return Boolean(
    edge &&
      band &&
      (band.order < edge.lowest.order || band.order > edge.highest.order)
  )
}

export type AdaptiveRangeText =
  | {
      key: 'pwa.practiceQuiz.adaptive.profile.likelyRange'
      values: { lower: string; upper: string }
    }
  | {
      key: 'pwa.practiceQuiz.adaptive.profile.likelyLevel'
      values: { level: string }
    }

/**
 * Range sentence with the real band names, including bands beyond the
 * levels with published elements ("Under A2 – A2.2"); the headline level
 * carries the note for an estimate outside that range.
 */
export function getAdaptiveRangeText({
  lowerLevelLabel,
  upperLevelLabel,
}: {
  lowerLevelLabel: string
  upperLevelLabel: string
  levelBands?: readonly AdaptiveReportedLevelBand[]
}): AdaptiveRangeText {
  return lowerLevelLabel === upperLevelLabel
    ? {
        key: 'pwa.practiceQuiz.adaptive.profile.likelyLevel',
        values: { level: lowerLevelLabel },
      }
    : {
        key: 'pwa.practiceQuiz.adaptive.profile.likelyRange',
        values: { lower: lowerLevelLabel, upper: upperLevelLabel },
      }
}

function measurableEdges(levelBands: readonly AdaptiveReportedLevelBand[]) {
  const measurable = levelBands
    .filter((band) => band.hasElements !== false)
    .sort((a, b) => a.order - b.order)
  const lowest = measurable[0]
  const highest = measurable.at(-1)
  return lowest && highest ? { lowest, highest } : null
}

export type AdaptiveEstimatedLevelText = {
  key:
    | 'pwa.practiceQuiz.adaptive.profile.estimatedLevel'
    | 'pwa.practiceQuiz.adaptive.profile.roughLevel'
  level: ReturnType<typeof getAdaptiveReportedLevelLabel>
}

/**
 * Label of an estimated (finished, not determined) row or headline:
 * "Estimated level: B1.2" ("Rough estimate: B1.2" for a node below the
 * reporting minimum), edge-aware ("A2.1 or below …").
 */
export function getAdaptiveEstimatedLevelText({
  state,
  levelBands,
  rough,
}: {
  state: Extract<AdaptiveResultState, { kind: 'ESTIMATED' }>
  levelBands: readonly AdaptiveReportedLevelBand[]
  rough: boolean
}): AdaptiveEstimatedLevelText {
  return {
    key: rough
      ? 'pwa.practiceQuiz.adaptive.profile.roughLevel'
      : 'pwa.practiceQuiz.adaptive.profile.estimatedLevel',
    level: getAdaptiveReportedLevelLabel({
      levelLabel: state.levelLabel,
      levelBands,
      classified: false,
    }),
  }
}
