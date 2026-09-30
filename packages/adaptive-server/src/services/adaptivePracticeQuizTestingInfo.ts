import * as DB from '@klicker-uzh/prisma/client'
import type { ElementData } from '@klicker-uzh/types'

// Debug-only data for staging walkthroughs. Everything in this module is
// gated by ADAPTIVE_QUIZ_SHOW_SOLUTIONS === 'true' because it reveals answers,
// item mapping, and raw ability estimates that participants must not see.
export const ADAPTIVE_TESTING_INFO_FLAG = 'ADAPTIVE_QUIZ_SHOW_SOLUTIONS'

export function isAdaptiveTestingInfoEnabled(
  flag = process.env[ADAPTIVE_TESTING_INFO_FLAG]
) {
  return flag === 'true'
}

export type AdaptiveTestingSolution = {
  choiceIndices: number[]
  answers: string[]
}

export type AdaptiveTestingEstimate = {
  responseCount: number
  theta: number | null
  standardError: number | null
  lowerBound: number | null
  upperBound: number | null
  levelLabel: string | null
  // True when the label is a best guess (most probable band or theta mapping)
  // rather than the estimator's persisted classification.
  levelIsTentative: boolean
  resultStatus: DB.AdaptiveResultStatus | null
}

export type AdaptiveTestingInfo = {
  solution: AdaptiveTestingSolution
  elementId: number
  elementVersion: number
  elementTitle: string
  competencePath: string[]
  subcompetenceName: string | null
  itemLevelLabel: string
  overallEstimate: AdaptiveTestingEstimate | null
  competenceEstimate: AdaptiveTestingEstimate | null
  subcompetenceEstimate: AdaptiveTestingEstimate | null
  // Internal lookup keys; not exposed through GraphQL.
  leafNodeId: number
  rootNodeId: number | null
}

export type AdaptiveTestingPoolItem = {
  elementId: number
  elementVersion: number
  elementName: string
  elementData: ElementData
  nodePath: readonly number[]
  nodeNamePath: readonly string[]
  leafNodeId: number
  levelLabel: string
}

export type AdaptiveTestingEstimateRecord = Pick<
  DB.AdaptivePracticeQuizEstimate,
  | 'nodeKind'
  | 'nodeId'
  | 'theta'
  | 'standardError'
  | 'credibleLower'
  | 'credibleUpper'
  | 'responseCount'
  | 'levelId'
  | 'resultStatus'
  | 'bandProbabilities'
>

export type AdaptiveTestingLevelResolver = {
  // Label of a persisted estimate levelId (a competence tree level id).
  labelForLevelId: (levelId: number) => string | null
  // Best-guess label when no level is persisted yet.
  tentativeLabel: (estimate: AdaptiveTestingEstimateRecord) => string | null
  // z used for theta ± z·SE when the estimator stores no credible interval.
  intervalZ: number
}

export function buildAdaptiveTestingSolution(
  element: ElementData
): AdaptiveTestingSolution {
  return {
    choiceIndices:
      element.type === DB.ElementType.SC ||
      element.type === DB.ElementType.MC ||
      element.type === DB.ElementType.KPRIM
        ? element.options.choices
            .filter((choice) => choice.correct === true)
            .map((choice) => choice.ix)
        : [],
    answers:
      element.type === DB.ElementType.FREE_TEXT
        ? (element.options.solutions ?? [])
        : element.type === DB.ElementType.NUMERICAL
          ? [
              ...(element.options.exactSolutions ?? []).map(String),
              ...(element.options.solutionRanges ?? []).map(({ min, max }) =>
                min === max ? String(min) : `${min ?? '−∞'} – ${max ?? '∞'}`
              ),
            ]
          : [],
  }
}

export function buildAdaptiveTestingInfo(
  poolItem: AdaptiveTestingPoolItem,
  showSolutions: string | undefined
): AdaptiveTestingInfo | null {
  if (!isAdaptiveTestingInfoEnabled(showSolutions)) return null
  const rootNodeId = poolItem.nodePath[0] ?? null
  return {
    solution: buildAdaptiveTestingSolution(poolItem.elementData),
    elementId: poolItem.elementId,
    elementVersion: poolItem.elementVersion,
    elementTitle: poolItem.elementName,
    competencePath: [...poolItem.nodeNamePath],
    subcompetenceName: poolItem.nodeNamePath.at(-1) ?? null,
    itemLevelLabel: poolItem.levelLabel,
    // Estimates need the attempt; they are attached by the attempt view.
    overallEstimate: null,
    competenceEstimate: null,
    subcompetenceEstimate: null,
    leafNodeId: poolItem.leafNodeId,
    rootNodeId: rootNodeId === poolItem.leafNodeId ? null : rootNodeId,
  }
}

export function serializeAdaptiveTestingEstimate(
  estimate: AdaptiveTestingEstimateRecord | undefined,
  resolver: AdaptiveTestingLevelResolver
): AdaptiveTestingEstimate | null {
  if (!estimate || estimate.responseCount === 0) return null
  const persistedLabel =
    estimate.levelId === null
      ? null
      : resolver.labelForLevelId(estimate.levelId)
  const tentativeLabel =
    persistedLabel === null ? resolver.tentativeLabel(estimate) : null
  const hasInterval =
    estimate.credibleLower !== null && estimate.credibleUpper !== null
  const hasStandardError =
    estimate.theta !== null && estimate.standardError !== null
  return {
    responseCount: estimate.responseCount,
    theta: estimate.theta,
    standardError: estimate.standardError,
    lowerBound: hasInterval
      ? estimate.credibleLower
      : hasStandardError
        ? estimate.theta! - resolver.intervalZ * estimate.standardError!
        : null,
    upperBound: hasInterval
      ? estimate.credibleUpper
      : hasStandardError
        ? estimate.theta! + resolver.intervalZ * estimate.standardError!
        : null,
    levelLabel: persistedLabel ?? tentativeLabel,
    levelIsTentative: persistedLabel === null && tentativeLabel !== null,
    resultStatus: estimate.resultStatus,
  }
}

export function withAdaptiveTestingEstimates(
  info: AdaptiveTestingInfo,
  estimates: readonly AdaptiveTestingEstimateRecord[],
  resolver: AdaptiveTestingLevelResolver
): AdaptiveTestingInfo {
  const overall = estimates.find(
    ({ nodeKind }) => nodeKind === DB.AdaptiveEstimateNodeKind.OVERALL
  )
  const byNode = (nodeId: number | null) =>
    nodeId === null
      ? undefined
      : estimates.find(
          (estimate) =>
            estimate.nodeKind !== DB.AdaptiveEstimateNodeKind.OVERALL &&
            estimate.nodeId === nodeId
        )
  return {
    ...info,
    overallEstimate: serializeAdaptiveTestingEstimate(overall, resolver),
    competenceEstimate: serializeAdaptiveTestingEstimate(
      byNode(info.rootNodeId),
      resolver
    ),
    subcompetenceEstimate: serializeAdaptiveTestingEstimate(
      byNode(info.leafNodeId),
      resolver
    ),
  }
}

// Tags are not part of the immutable publication snapshot, so they are read
// from the live source element (one indexed lookup, testing mode only).
export async function loadAdaptiveTestingElementTags(
  prisma: Pick<DB.PrismaClient, 'element'>,
  elementId: number
): Promise<string[]> {
  const element = await prisma.element.findUnique({
    where: { id: elementId },
    select: { tags: { select: { name: true }, orderBy: { order: 'asc' } } },
  })
  return element?.tags.map(({ name }) => name) ?? []
}

// Picks the most probable band from a Bayesian posterior, keyed by scale level.
export function mostProbableBandLabel(
  bandProbabilities: DB.Prisma.JsonValue | null,
  levels: ReadonlyArray<{ scaleLevelId: number; label: string }>
): string | null {
  if (
    !bandProbabilities ||
    typeof bandProbabilities !== 'object' ||
    Array.isArray(bandProbabilities)
  ) {
    return null
  }
  const values = bandProbabilities as Record<string, unknown>
  let best: { label: string; probability: number } | null = null
  for (const level of levels) {
    const probability = values[String(level.scaleLevelId)]
    if (
      typeof probability === 'number' &&
      (best === null || probability > best.probability)
    ) {
      best = { label: level.label, probability }
    }
  }
  return best?.label ?? null
}
