import type * as DB from '@klicker-uzh/prisma/client'
import {
  type AdaptiveTestingAnswerResult,
  type AdaptiveTestingEstimateRecord,
  type AdaptiveTestingHistory,
  type AdaptiveTestingHistoryBand,
  type AdaptiveTestingLevelResolver,
  isAdaptiveTestingInfoEnabled,
  serializeAdaptiveTestingEstimate,
} from './adaptivePracticeQuizTestingInfo.js'

// Debug-only answer history for staging walkthroughs, attached to the testing
// info and therefore gated by the same ADAPTIVE_QUIZ_SHOW_SOLUTIONS flag. It
// only contains the participant's own attempt: item metadata, the graded
// result, and estimates that the runtime already persisted.
//
// Per-answer competence (root) estimates are not persisted: a response stores
// only the overall estimate after it (overallThetaAfter), and the attempt
// stores the current estimate per node. The history therefore shows the
// overall estimate after each answer where one exists and the CURRENT
// estimate per competence for comparison with the served item levels.

export type AdaptiveTestingHistoryResponse = Pick<
  DB.AdaptivePracticeQuizResponse,
  'order' | 'score' | 'correct' | 'elementId' | 'overallThetaAfter'
> & {
  poolItem: Pick<
    DB.PracticeQuizAdaptivePoolItem,
    'elementName' | 'nodePath' | 'nodeNamePath' | 'levelLabel'
  > | null
}

export function classifyAdaptiveTestingAnswer({
  correct,
  score,
}: {
  correct: boolean
  score: number
}): AdaptiveTestingAnswerResult {
  if (correct) return 'CORRECT'
  return Number.isFinite(score) && score > 0 ? 'PARTIALLY_CORRECT' : 'INCORRECT'
}

export function buildAdaptiveTestingHistory({
  responses,
  estimates,
  levelBands,
  normalizeTheta,
  resolver,
  showSolutions,
}: {
  responses: readonly AdaptiveTestingHistoryResponse[]
  estimates: readonly AdaptiveTestingEstimateRecord[]
  levelBands: readonly AdaptiveTestingHistoryBand[]
  normalizeTheta: (theta: number) => number
  resolver: AdaptiveTestingLevelResolver
  showSolutions: string | undefined
}): AdaptiveTestingHistory | null {
  if (!isAdaptiveTestingInfoEnabled(showSolutions)) return null

  const toPosition = (theta: number | null | undefined) =>
    typeof theta === 'number' && Number.isFinite(theta)
      ? normalizeTheta(theta)
      : null
  const bandCenter = (label: string | null) => {
    const band = label
      ? levelBands.find((candidate) => candidate.label === label)
      : undefined
    return band ? (band.startPosition + band.endPosition) / 2 : null
  }

  const ordered = responses.slice().sort((a, b) => a.order - b.order)
  const roots = new Map<number, string>()
  const entries = ordered.map((response) => {
    const rootId = response.poolItem?.nodePath[0]
    const rootName = response.poolItem?.nodeNamePath[0] ?? null
    if (typeof rootId === 'number' && rootName !== null && !roots.has(rootId)) {
      roots.set(rootId, rootName)
    }
    const itemLevelLabel = response.poolItem?.levelLabel ?? null
    return {
      order: response.order,
      elementTitle: response.poolItem?.elementName ?? `#${response.elementId}`,
      competenceName: rootName,
      subcompetenceName:
        (response.poolItem?.nodeNamePath.length ?? 0) > 1
          ? (response.poolItem?.nodeNamePath.at(-1) ?? null)
          : null,
      itemLevelLabel,
      itemLevelPosition: bandCenter(itemLevelLabel),
      result: classifyAdaptiveTestingAnswer(response),
      score: response.score,
      overallTheta: response.overallThetaAfter,
      overallPosition: toPosition(response.overallThetaAfter),
    }
  })

  const competenceEstimates = [...roots].flatMap(([rootId, name]) => {
    const record = estimates.find(
      (estimate) =>
        estimate.nodeKind !== 'OVERALL' && estimate.nodeId === rootId
    )
    const estimate = serializeAdaptiveTestingEstimate(record, resolver)
    if (!estimate) return []
    return [
      {
        name,
        responseCount: estimate.responseCount,
        theta: estimate.theta,
        levelLabel: estimate.levelLabel,
        levelIsTentative: estimate.levelIsTentative,
        position: toPosition(estimate.theta),
        lowerPosition: toPosition(estimate.lowerBound),
        upperPosition: toPosition(estimate.upperBound),
      },
    ]
  })

  return { levelBands: [...levelBands], entries, competenceEstimates }
}
