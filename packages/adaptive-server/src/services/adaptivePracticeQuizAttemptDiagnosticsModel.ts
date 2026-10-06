import { createHash } from 'node:crypto'
import { clamp } from '@klicker-uzh/adaptive-contract'
import type * as DB from '@klicker-uzh/prisma/client'
import {
  type AdaptiveAttemptRatingLevel,
  type AdaptiveAttemptRatingReason,
  type AdaptiveRatingCompetence,
  rateAdaptiveAttempt,
} from './adaptivePracticeQuizAttemptDiagnosticsRating.js'
import { mapLevelForTheta } from './adaptivePracticeQuizLegacyLevelScale.js'
import type {
  AdaptiveRuntimeLevel,
  AdaptiveRuntimeNode,
  AdaptiveRuntimeRoutingPoolItem,
  AdaptiveRuntimeSettings,
} from './adaptivePracticeQuizRuntime.js'

/**
 * Read model of the lecturer attempt diagnostics (testing environments only).
 * Pure: the service loads the runtime and the attempts, this module turns one
 * attempt into its summary, final node results and answer rows. Participants
 * appear only through pseudonymous codes.
 */

export function adaptivePseudonymCode(
  kind: 'attempt' | 'participant',
  id: string
) {
  return createHash('sha256').update(`${kind}:${id}`).digest('hex').slice(0, 8)
}

export type AdaptiveDiagnosticNodeResult = {
  nodeId: number | null
  parentId: number | null
  name: string
  kind: 'OVERALL' | 'COMPETENCE' | 'SUBCOMPETENCE'
  depth: number
  theta: number | null
  standardError: number | null
  levelLabel: string | null
  lowerLevelLabel: string | null
  upperLevelLabel: string | null
  responseCount: number
  determined: boolean
  coverageStatus: DB.AdaptiveLeafCoverageStatus | null
  weightShare: number | null
}

export type AdaptiveDiagnosticAnswer = {
  order: number
  competenceName: string | null
  subcompetenceName: string | null
  nodeNamePath: string[]
  elementTitle: string
  itemLevelLabel: string | null
  difficulty: number | null
  discrimination: number | null
  guessing: number | null
  correct: boolean
  score: number
  overallThetaAfter: number | null
  /** Item level minus the final competence level, in levels. */
  levelDistance: number | null
}

export type AdaptiveDiagnosticSummary = {
  attemptCode: string
  participantCode: string
  attemptNumber: number
  startedAt: Date
  completedAt: Date | null
  elapsedSeconds: number | null
  stopReason: DB.AdaptivePracticeQuizStopReason | null
  answerCount: number
  overall: AdaptiveDiagnosticNodeResult
  competences: AdaptiveDiagnosticNodeResult[]
  rating: AdaptiveAttemptRatingLevel | 'NOT_AVAILABLE'
  ratingReasons: AdaptiveAttemptRatingReason[]
}

export type AdaptiveDiagnosticAttemptRecord = {
  id: string
  participationId: number
  measurementVersion: DB.AdaptiveMeasurementVersion
  stopReason: DB.AdaptivePracticeQuizStopReason | null
  startedAt: Date
  completedAt: Date | null
  elapsedSeconds: number | null
  estimates: Array<{
    nodeKind: DB.AdaptiveEstimateNodeKind
    nodeId: number | null
    theta: number | null
    standardError: number | null
    responseCount: number
    stopReason: DB.AdaptivePracticeQuizStopReason | null
    coverageStatus: DB.AdaptiveLeafCoverageStatus | null
  }>
  responses: Array<{
    order: number
    poolItemId: number | null
    elementId: number
    correct: boolean
    score: number
    overallThetaAfter: number | null
  }>
}

export type AdaptiveDiagnosticContext = {
  nodes: AdaptiveRuntimeNode[]
  nodeNames: ReadonlyMap<number, string>
  levels: AdaptiveRuntimeLevel[]
  settings: AdaptiveRuntimeSettings
  poolById: ReadonlyMap<number, AdaptiveRuntimeRoutingPoolItem>
  levelIdsWithElements: ReadonlySet<number>
  weightShares: ReadonlyMap<number, number>
  /** Shared host level determination of the attempt (IRT_V1). */
  isDetermined: (
    nodeId: number | null,
    estimate: {
      theta: number
      standardError: number
      stopReason?: string | null
    }
  ) => boolean
}

export function buildAdaptiveAttemptDiagnostic(
  context: AdaptiveDiagnosticContext,
  attempt: AdaptiveDiagnosticAttemptRecord,
  attemptNumber: number
) {
  const { levels, settings } = context
  const sortedLevels = levels.slice().sort((a, b) => a.order - b.order)
  const levelIndex = new Map(
    sortedLevels.map((level, index) => [level.id, index])
  )
  const levelAt = (theta: number) =>
    mapLevelForTheta(clamp(theta, settings.thetaRange), levels, settings)

  const estimateFor = (nodeId: number | null) =>
    attempt.estimates.find((estimate) =>
      nodeId === null
        ? estimate.nodeKind === 'OVERALL'
        : estimate.nodeKind !== 'OVERALL' && estimate.nodeId === nodeId
    )

  const nodeResult = (
    node: AdaptiveRuntimeNode | null
  ): AdaptiveDiagnosticNodeResult => {
    const nodeId = node?.id ?? null
    const estimate = estimateFor(nodeId)
    const theta = estimate?.theta ?? null
    const standardError = estimate?.standardError ?? null
    const hasEstimate =
      theta !== null &&
      Number.isFinite(theta) &&
      standardError !== null &&
      Number.isFinite(standardError)
    const spread = hasEstimate ? settings.classificationZ * standardError! : 0
    return {
      nodeId,
      parentId: node?.parentId ?? null,
      name: node
        ? (context.nodeNames.get(node.id) ?? `#${node.id}`)
        : 'Overall',
      kind: node ? node.kind : 'OVERALL',
      depth: node?.depth ?? 0,
      theta,
      standardError,
      levelLabel: hasEstimate ? (levelAt(theta!)?.label ?? null) : null,
      lowerLevelLabel: hasEstimate
        ? (levelAt(theta! - spread)?.label ?? null)
        : null,
      upperLevelLabel: hasEstimate
        ? (levelAt(theta! + spread)?.label ?? null)
        : null,
      responseCount: estimate?.responseCount ?? 0,
      determined:
        hasEstimate &&
        attempt.measurementVersion === 'IRT_V1' &&
        context.isDetermined(nodeId, {
          theta: theta!,
          standardError: standardError!,
          stopReason: estimate?.stopReason,
        }),
      coverageStatus: estimate?.coverageStatus ?? null,
      weightShare:
        nodeId === null ? null : (context.weightShares.get(nodeId) ?? null),
    }
  }

  const overall = nodeResult(null)
  const nodes = context.nodes
    .slice()
    .sort((a, b) => a.depth - b.depth || a.order - b.order || a.id - b.id)
    .map(nodeResult)
  const competences = nodes.filter(({ parentId }) => parentId === null)
  const competenceLevelIndex = new Map(
    competences.map((competence) => {
      const level =
        competence.theta === null ? undefined : levelAt(competence.theta)
      return [competence.nodeId!, level ? levelIndex.get(level.id) : undefined]
    })
  )

  const answers: AdaptiveDiagnosticAnswer[] = attempt.responses
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((response) => {
      const item =
        response.poolItemId === null
          ? undefined
          : context.poolById.get(response.poolItemId)
      const rootId = item?.nodePath[0]
      const itemIndex = item ? levelIndex.get(item.levelId) : undefined
      const rootIndex =
        typeof rootId === 'number'
          ? competenceLevelIndex.get(rootId)
          : undefined
      return {
        order: response.order,
        competenceName: item?.nodeNamePath[0] ?? null,
        subcompetenceName:
          item && item.nodeNamePath.length > 1
            ? (item.nodeNamePath.at(-1) ?? null)
            : null,
        nodeNamePath: item ? [...item.nodeNamePath] : [],
        elementTitle: item?.elementName ?? `#${response.elementId}`,
        itemLevelLabel: item?.levelLabel ?? null,
        difficulty: item?.difficulty ?? null,
        discrimination: item?.discrimination ?? null,
        guessing: item?.guessing ?? null,
        correct: response.correct,
        score: response.score,
        overallThetaAfter: response.overallThetaAfter,
        levelDistance:
          itemIndex !== undefined && rootIndex !== undefined
            ? itemIndex - rootIndex
            : null,
      }
    })

  const ratingCompetences: AdaptiveRatingCompetence[] = competences.map(
    (competence) => {
      const level =
        competence.theta === null ? undefined : levelAt(competence.theta)
      return {
        name: competence.name,
        theta: competence.theta,
        responseCount: competence.responseCount,
        levelHasElements: level
          ? context.levelIdsWithElements.has(level.id)
          : true,
        answers: attempt.responses.flatMap((response) => {
          const item =
            response.poolItemId === null
              ? undefined
              : context.poolById.get(response.poolItemId)
          if (!item || item.nodePath[0] !== competence.nodeId) return []
          return [
            {
              item: {
                difficulty: item.difficulty,
                discrimination: item.discrimination,
                guessing: item.guessing,
              },
              correct: response.correct,
              levelDistance:
                answers.find(({ order }) => order === response.order)
                  ?.levelDistance ?? null,
            },
          ]
        }),
      }
    }
  )

  const overallLower = overall.lowerLevelLabel
    ? sortedLevels.findIndex(({ label }) => label === overall.lowerLevelLabel)
    : -1
  const overallUpper = overall.upperLevelLabel
    ? sortedLevels.findIndex(({ label }) => label === overall.upperLevelLabel)
    : -1
  const rating =
    attempt.measurementVersion === 'IRT_V1'
      ? rateAdaptiveAttempt({
          overallDetermined: overall.determined,
          overallRangeLevelCount:
            overallLower >= 0 && overallUpper >= 0
              ? Math.abs(overallUpper - overallLower) + 1
              : null,
          levelCount: sortedLevels.length,
          competences: ratingCompetences,
          thetaRange: settings.thetaRange,
        })
      : null

  const summary: AdaptiveDiagnosticSummary = {
    attemptCode: adaptivePseudonymCode('attempt', attempt.id),
    participantCode: adaptivePseudonymCode(
      'participant',
      String(attempt.participationId)
    ),
    attemptNumber,
    startedAt: attempt.startedAt,
    completedAt: attempt.completedAt,
    elapsedSeconds: attempt.elapsedSeconds,
    stopReason: attempt.stopReason,
    answerCount: attempt.responses.length,
    overall,
    competences,
    rating: rating?.level ?? 'NOT_AVAILABLE',
    ratingReasons: rating?.reasons ?? [],
  }
  return { summary, nodes, answers }
}
