import {
  classificationIntervalWithinLevelBand,
  isNearLevelBoundary,
  mapLevelsToTheta,
  normalizeThetaForChart,
} from '@klicker-uzh/adaptive-learning'
import * as DB from '@klicker-uzh/prisma/client'
import { adaptivePracticeQuizError } from './adaptivePracticeQuizErrors.js'
import { getEffectivelyEnabledRuntimeNodes } from './adaptivePracticeQuizEstimatePersistence.js'
import { isAdaptiveRetakeCooldownElapsed } from './adaptivePracticeQuizRetakes.js'
import {
  MIN_REPORTING_RESPONSES,
  normalizeRuntimeEstimateForChart,
  serializeAdaptiveParticipantElement,
  type AdaptiveParticipantElement,
  type AdaptiveRuntimeLevel,
  type AdaptiveRuntimeNode,
  type AdaptiveRuntimeSettings,
} from './adaptivePracticeQuizRuntime.js'
import {
  toDeliveredRuntimePoolItem,
  type AdaptiveAttemptRuntimeRecord,
  type LoadedAdaptiveRuntime,
} from './adaptivePracticeQuizRuntimeData.js'

export type AdaptivePracticeQuizAttemptState = {
  attemptId: string
  practiceQuizId: string
  practiceQuizName: string
  status: DB.AdaptivePracticeQuizAttemptStatus
  stopReason: DB.AdaptivePracticeQuizStopReason | null
  answeredQuestions: number
  questionNumber: number | null
  maximumQuestions: number
  startedAt: Date
  completedAt: Date | null
  elapsedSeconds: number | null
  showTimer: boolean
  canStartNewAttempt: boolean
  submittedResponseFeedback: AdaptiveSubmittedResponseFeedback | null
  servedItem: AdaptiveParticipantElement | null
}

export type AdaptiveSubmittedResponseFeedback = {
  correct: boolean
  score: number
  feedback: string[]
}

export type AdaptiveResultConfidence =
  | 'HIGH'
  | 'MODERATE'
  | 'LOW'
  | 'INSUFFICIENT_DATA'

export type AdaptiveResultClassification = DB.AdaptiveResultStatus

export type AdaptiveResultLevelBand = {
  label: string
  order: number
  startPosition: number
  endPosition: number
}

export type AdaptiveResultTrajectoryPoint = {
  order: number
  position: number
  lowerPosition: number
  upperPosition: number
  levelLabel: string | null
}

export type AdaptiveStudentResultNode = {
  id: number
  name: string
  kind: DB.AdaptiveNodeKind
  order: number
  responseCount: number
  classification: AdaptiveResultClassification
  levelLabel: string | null
  leadingLevelLabels: string[]
  classificationProbability: number | null
  confidence: AdaptiveResultConfidence
  nearBoundary: boolean
  position: number | null
  lowerPosition: number | null
  upperPosition: number | null
  children: AdaptiveStudentResultNode[]
}

export type AdaptiveStudentResult = {
  attemptId: string
  practiceQuizId: string
  practiceQuizName: string
  stopReason: DB.AdaptivePracticeQuizStopReason
  answeredQuestions: number
  completedAt: Date
  levelInterpretation: DB.AdaptiveLevelMappingRule
  classification: AdaptiveResultClassification
  levelLabel: string | null
  leadingLevelLabels: string[]
  classificationProbability: number | null
  confidence: AdaptiveResultConfidence
  nearBoundary: boolean
  position: number | null
  lowerPosition: number | null
  upperPosition: number | null
  levelBands: AdaptiveResultLevelBand[]
  trajectory: AdaptiveResultTrajectoryPoint[]
  competenceProfile: AdaptiveStudentResultNode[]
}

export function serializeAdaptiveAttemptState(
  runtime: LoadedAdaptiveRuntime,
  attempt: AdaptiveAttemptRuntimeRecord
): AdaptivePracticeQuizAttemptState {
  const nextPoolItem = attempt.nextPoolItem
    ? toDeliveredRuntimePoolItem(attempt.nextPoolItem)
    : null
  if (
    attempt.status === DB.AdaptivePracticeQuizAttemptStatus.IN_PROGRESS &&
    (!nextPoolItem || nextPoolItem.id !== attempt.nextPoolItemId)
  ) {
    throw adaptivePracticeQuizError(
      'The in-progress adaptive attempt has no valid served item.',
      'ADAPTIVE_ATTEMPT_DATA_INVALID'
    )
  }

  return {
    attemptId: attempt.id,
    practiceQuizId: attempt.practiceQuizId,
    practiceQuizName: runtime.quiz.displayName,
    status: attempt.status,
    stopReason: attempt.stopReason,
    answeredQuestions: attempt.responses.length,
    questionNumber: nextPoolItem ? attempt.responses.length + 1 : null,
    maximumQuestions: runtime.publication.totalQuestionCap,
    startedAt: attempt.startedAt,
    completedAt: attempt.completedAt,
    elapsedSeconds: attempt.elapsedSeconds,
    showTimer: runtime.publication.showTimer,
    canStartNewAttempt:
      attempt.status === DB.AdaptivePracticeQuizAttemptStatus.COMPLETED &&
      attempt.completedAt !== null &&
      runtime.publication.retakePolicy !==
        DB.AdaptiveAttemptSelectionPolicy.FIRST_COMPLETED &&
      isAdaptiveRetakeCooldownElapsed({
        completedAt: attempt.completedAt,
        cooldownDays: runtime.publication.retakeCooldownDays,
      }),
    submittedResponseFeedback: null,
    servedItem: nextPoolItem
      ? serializeAdaptiveParticipantElement(nextPoolItem)
      : null,
  }
}

export function serializeAdaptiveStudentResult(
  runtime: LoadedAdaptiveRuntime,
  attempt: AdaptiveAttemptRuntimeRecord
): AdaptiveStudentResult {
  if (!attempt.stopReason || !attempt.completedAt) {
    throw adaptivePracticeQuizError(
      'The completed adaptive attempt has no terminal metadata.',
      'ADAPTIVE_ATTEMPT_DATA_INVALID'
    )
  }
  if (
    attempt.measurementVersion ===
    DB.AdaptiveMeasurementVersion.IRT_V2_EAP_GRID_1
  ) {
    return serializeAdaptiveV2StudentResult(runtime, attempt)
  }
  const settings = runtime.algorithm.settings
  const levelsById = new Map(
    runtime.algorithm.levels.map((level) => [level.id, level])
  )
  const estimatesByNode = new Map(
    attempt.estimates
      .filter((estimate) => estimate.nodeId !== null)
      .map((estimate) => [estimate.nodeId!, estimate])
  )
  const overall = attempt.estimates.find(
    (estimate) => estimate.nodeKind === DB.AdaptiveEstimateNodeKind.OVERALL
  )
  if (!overall) {
    throw adaptivePracticeQuizError(
      'The completed adaptive attempt has no overall estimate.',
      'ADAPTIVE_ATTEMPT_DATA_INVALID'
    )
  }
  if (overall.responseCount !== attempt.responses.length) {
    throw adaptivePracticeQuizError(
      'The completed adaptive attempt response evidence is inconsistent.',
      'ADAPTIVE_ATTEMPT_DATA_INVALID'
    )
  }
  const overallView = serializeEstimateView({
    estimate: overall,
    levelsById,
    settings,
  })
  const childrenByParent = new Map<number | null, AdaptiveRuntimeNode[]>()
  const effectiveNodes = getEffectivelyEnabledRuntimeNodes(
    runtime.algorithm.nodes
  )
  for (const node of effectiveNodes) {
    const siblings = childrenByParent.get(node.parentId) ?? []
    siblings.push(node)
    childrenByParent.set(node.parentId, siblings)
  }
  const buildNode = (node: AdaptiveRuntimeNode): AdaptiveStudentResultNode => {
    const estimate = estimatesByNode.get(node.id)
    const view = serializeEstimateView({
      estimate,
      levelsById,
      settings,
    })
    return {
      id: node.id,
      name: runtime.tree.nodes.find(({ id }) => id === node.id)!.name,
      kind: node.kind,
      order: node.order,
      responseCount: estimate?.responseCount ?? 0,
      classification: legacyClassification(
        view,
        estimate?.stopReason ?? attempt.stopReason!
      ),
      leadingLevelLabels: [],
      classificationProbability: null,
      ...view,
      children: (childrenByParent.get(node.id) ?? [])
        .slice()
        .sort((a, b) => a.order - b.order || a.id - b.id)
        .map(buildNode),
    }
  }
  const rootIds = effectiveNodes
    .filter(
      (node) =>
        node.parentId === null && node.kind === DB.AdaptiveNodeKind.COMPETENCE
    )
    .map(({ id }) => id)
  const trajectoryRootCounts = new Map<number, number>()
  const trajectory = attempt.responses.flatMap((response) => {
    const rootId = response.poolItem?.nodePath[0]
    if (typeof rootId === 'number') {
      trajectoryRootCounts.set(
        rootId,
        (trajectoryRootCounts.get(rootId) ?? 0) + 1
      )
    }
    if (
      response.overallThetaAfter === null ||
      response.overallStandardErrorAfter === null
    ) {
      return []
    }
    const normalized = normalizeRuntimeEstimateForChart({
      estimate: {
        theta: response.overallThetaAfter,
        standardError: response.overallStandardErrorAfter,
      },
      settings,
    })!
    const level = rootIds.every(
      (id) => (trajectoryRootCounts.get(id) ?? 0) >= MIN_REPORTING_RESPONSES
    )
      ? mapLevelForTheta(
          response.overallThetaAfter,
          runtime.algorithm.levels,
          settings
        )
      : null
    return [
      {
        order: response.order,
        ...normalized,
        levelLabel: level?.label ?? null,
      },
    ]
  })

  return {
    attemptId: attempt.id,
    practiceQuizId: attempt.practiceQuizId,
    practiceQuizName: runtime.quiz.displayName,
    stopReason: attempt.stopReason,
    answeredQuestions: attempt.responses.length,
    completedAt: attempt.completedAt,
    levelInterpretation: settings.levelMappingRule,
    classification: legacyClassification(overallView, attempt.stopReason),
    leadingLevelLabels: [],
    classificationProbability: null,
    ...overallView,
    levelBands: serializeLevelBands(runtime.algorithm.levels, settings),
    trajectory,
    competenceProfile: (childrenByParent.get(null) ?? [])
      .slice()
      .sort((a, b) => a.order - b.order || a.id - b.id)
      .map(buildNode),
  }
}

function serializeAdaptiveV2StudentResult(
  runtime: LoadedAdaptiveRuntime,
  attempt: AdaptiveAttemptRuntimeRecord
): AdaptiveStudentResult {
  const completedAt = attempt.completedAt!
  const stopReason = attempt.stopReason!
  const overall = attempt.estimates.find(
    (estimate) => estimate.nodeKind === DB.AdaptiveEstimateNodeKind.OVERALL
  )
  if (!overall || !attempt.resultStatus || !overall.resultStatus) {
    throw adaptivePracticeQuizError(
      'The completed Bayesian attempt has no result classification.',
      'ADAPTIVE_ATTEMPT_DATA_INVALID'
    )
  }
  if (attempt.resultStatus !== overall.resultStatus) {
    throw adaptivePracticeQuizError(
      'The Bayesian attempt and overall estimate classifications disagree.',
      'ADAPTIVE_ATTEMPT_DATA_INVALID'
    )
  }

  const levels = runtime.publication.cutScoreSnapshot
    .slice()
    .sort((left, right) => left.order - right.order)
  const overallView = serializeV2EstimateView({
    estimate: overall,
    levels,
    runtime,
  })
  const estimatesByNode = new Map(
    attempt.estimates
      .filter((estimate) => estimate.nodeId !== null)
      .map((estimate) => [estimate.nodeId!, estimate])
  )
  const childrenByParent = new Map<number | null, AdaptiveRuntimeNode[]>()
  const effectiveNodes = getEffectivelyEnabledRuntimeNodes(
    runtime.algorithm.nodes
  )
  for (const node of effectiveNodes) {
    const siblings = childrenByParent.get(node.parentId) ?? []
    siblings.push(node)
    childrenByParent.set(node.parentId, siblings)
  }
  const namesByNodeId = new Map(
    runtime.publication.hierarchicalWeightSnapshot.map(({ nodeId, name }) => [
      nodeId,
      name,
    ])
  )
  const buildNode = (node: AdaptiveRuntimeNode): AdaptiveStudentResultNode => {
    const estimate = estimatesByNode.get(node.id)
    if (!estimate) {
      throw adaptivePracticeQuizError(
        'The Bayesian result is missing a node estimate.',
        'ADAPTIVE_ATTEMPT_DATA_INVALID'
      )
    }
    const name = namesByNodeId.get(node.id)
    if (!name) {
      throw adaptivePracticeQuizError(
        'The adaptive publication is missing a node name.',
        'ADAPTIVE_PUBLICATION_SNAPSHOT_INVALID'
      )
    }
    return {
      id: node.id,
      name,
      kind: node.kind,
      order: node.order,
      responseCount: estimate.responseCount,
      ...serializeV2EstimateView({ estimate, levels, runtime }),
      children: (childrenByParent.get(node.id) ?? [])
        .slice()
        .sort((left, right) => left.order - right.order || left.id - right.id)
        .map(buildNode),
    }
  }
  const researchOnly =
    overall.resultStatus === DB.AdaptiveResultStatus.RESEARCH_ONLY
  const trajectory: AdaptiveResultTrajectoryPoint[] = researchOnly
    ? []
    : attempt.responses.flatMap((response) => {
        if (
          response.overallThetaAfter === null ||
          response.overallCredibleLowerAfter === null ||
          response.overallCredibleUpperAfter === null
        ) {
          return []
        }
        return [
          {
            order: response.order,
            position: normalizeV2Position(response.overallThetaAfter, runtime),
            lowerPosition: normalizeV2Position(
              response.overallCredibleLowerAfter,
              runtime
            ),
            upperPosition: normalizeV2Position(
              response.overallCredibleUpperAfter,
              runtime
            ),
            levelLabel: null,
          },
        ]
      })
  const lastPoint = trajectory.at(-1)
  if (lastPoint) {
    lastPoint.levelLabel = overallView.levelLabel
    if (
      overallView.position === null ||
      Math.abs(lastPoint.position - overallView.position) > 1e-12 ||
      Math.abs(lastPoint.lowerPosition - overallView.lowerPosition!) > 1e-12 ||
      Math.abs(lastPoint.upperPosition - overallView.upperPosition!) > 1e-12
    ) {
      throw adaptivePracticeQuizError(
        'The Bayesian trajectory endpoint disagrees with the final estimate.',
        'ADAPTIVE_ATTEMPT_DATA_INVALID'
      )
    }
  }

  return {
    attemptId: attempt.id,
    practiceQuizId: attempt.practiceQuizId,
    practiceQuizName: runtime.quiz.displayName,
    stopReason,
    answeredQuestions: attempt.responses.length,
    completedAt,
    levelInterpretation:
      runtime.publication.evidenceMinimumSnapshot.levelMappingRule,
    ...overallView,
    levelBands: researchOnly ? [] : serializeV2LevelBands(runtime),
    trajectory,
    competenceProfile: (childrenByParent.get(null) ?? [])
      .slice()
      .sort((left, right) => left.order - right.order || left.id - right.id)
      .map(buildNode),
  }
}

function serializeV2EstimateView({
  estimate,
  levels,
  runtime,
}: {
  estimate: DB.AdaptivePracticeQuizEstimate
  levels: LoadedAdaptiveRuntime['publication']['cutScoreSnapshot']
  runtime: LoadedAdaptiveRuntime
}) {
  const classification = estimate.resultStatus
  if (!classification) {
    throw adaptivePracticeQuizError(
      'The Bayesian estimate has no result classification.',
      'ADAPTIVE_ATTEMPT_DATA_INVALID'
    )
  }
  const researchOnly = classification === DB.AdaptiveResultStatus.RESEARCH_ONLY
  const hasPosition =
    !researchOnly &&
    estimate.theta !== null &&
    estimate.credibleLower !== null &&
    estimate.credibleUpper !== null
  const level =
    classification === DB.AdaptiveResultStatus.CLASSIFIED
      ? levels.find(({ sourceLevelId }) => sourceLevelId === estimate.levelId)
      : null
  const leadingLevelLabels =
    classification === DB.AdaptiveResultStatus.BETWEEN_LEVELS
      ? leadingAdjacentLevelLabels(estimate.bandProbabilities, levels)
      : []
  return {
    classification,
    levelLabel: level?.label ?? null,
    leadingLevelLabels,
    classificationProbability:
      classification === DB.AdaptiveResultStatus.CLASSIFIED ||
      classification === DB.AdaptiveResultStatus.BETWEEN_LEVELS
        ? estimate.classificationProbability
        : null,
    confidence:
      classification === DB.AdaptiveResultStatus.CLASSIFIED
        ? ('HIGH' as const)
        : classification === DB.AdaptiveResultStatus.BETWEEN_LEVELS
          ? ('LOW' as const)
          : ('INSUFFICIENT_DATA' as const),
    nearBoundary: classification === DB.AdaptiveResultStatus.BETWEEN_LEVELS,
    position: hasPosition
      ? normalizeV2Position(estimate.theta!, runtime)
      : null,
    lowerPosition: hasPosition
      ? normalizeV2Position(estimate.credibleLower!, runtime)
      : null,
    upperPosition: hasPosition
      ? normalizeV2Position(estimate.credibleUpper!, runtime)
      : null,
  }
}

function leadingAdjacentLevelLabels(
  probabilities: DB.Prisma.JsonValue | null,
  levels: LoadedAdaptiveRuntime['publication']['cutScoreSnapshot']
) {
  if (!probabilities || typeof probabilities !== 'object') return []
  const values = probabilities as Record<string, number>
  const ordered = levels.slice().sort((left, right) => left.order - right.order)
  const topIndex = ordered.reduce(
    (best, level, index) =>
      (values[String(level.scaleLevelId)] ?? 0) >
      (values[String(ordered[best]!.scaleLevelId)] ?? 0)
        ? index
        : best,
    0
  )
  const neighborIndices = [topIndex - 1, topIndex + 1].filter(
    (index) => index >= 0 && index < ordered.length
  )
  const neighborIndex = neighborIndices.sort(
    (left, right) =>
      (values[String(ordered[right]!.scaleLevelId)] ?? 0) -
      (values[String(ordered[left]!.scaleLevelId)] ?? 0)
  )[0]
  return [topIndex, neighborIndex]
    .filter((index): index is number => typeof index === 'number')
    .sort((left, right) => left - right)
    .map((index) => ordered[index]!.label)
}

function serializeV2LevelBands(runtime: LoadedAdaptiveRuntime) {
  const levels = runtime.publication.cutScoreSnapshot
    .slice()
    .sort((left, right) => left.order - right.order)
  return levels.map((level, index) => ({
    label: level.label,
    order: level.order,
    startPosition: normalizeV2Position(
      index === 0
        ? runtime.publication.gridMin
        : (level.lowerBound ?? runtime.publication.gridMin),
      runtime
    ),
    endPosition: normalizeV2Position(
      index === levels.length - 1
        ? runtime.publication.gridMax
        : (levels[index + 1]!.lowerBound ?? runtime.publication.gridMax),
      runtime
    ),
  }))
}

function normalizeV2Position(theta: number, runtime: LoadedAdaptiveRuntime) {
  return normalizeThetaForChart(theta, {
    min: runtime.publication.gridMin,
    max: runtime.publication.gridMax,
  })
}

function legacyClassification(
  view: ReturnType<typeof serializeEstimateView>,
  stopReason: DB.AdaptivePracticeQuizStopReason
): AdaptiveResultClassification {
  if (view.levelLabel) return DB.AdaptiveResultStatus.CLASSIFIED
  return stopReason === DB.AdaptivePracticeQuizStopReason.POOL_EXHAUSTED
    ? DB.AdaptiveResultStatus.POOL_LIMITED
    : DB.AdaptiveResultStatus.INSUFFICIENT_EVIDENCE
}

function serializeEstimateView({
  estimate,
  levelsById,
  settings,
}: {
  estimate:
    | Pick<
        DB.AdaptivePracticeQuizEstimate,
        'theta' | 'standardError' | 'responseCount' | 'levelId'
      >
    | undefined
  levelsById: Map<number, AdaptiveRuntimeLevel>
  settings: AdaptiveRuntimeSettings
}) {
  if (
    !estimate ||
    estimate.responseCount < MIN_REPORTING_RESPONSES ||
    estimate.theta === null ||
    estimate.standardError === null ||
    estimate.levelId === null
  ) {
    return {
      levelLabel: null,
      confidence: 'INSUFFICIENT_DATA' as const,
      nearBoundary: false,
      position: null,
      lowerPosition: null,
      upperPosition: null,
    }
  }
  const level = levelsById.get(estimate.levelId)
  const normalized = normalizeRuntimeEstimateForChart({ estimate, settings })!
  const classified = classificationIntervalWithinLevelBand({
    theta: estimate.theta,
    standardError: estimate.standardError,
    levels: [...levelsById.values()],
    range: settings.thetaRange,
    mappingRule: settings.levelMappingRule,
    z: settings.classificationZ,
  })
  const nearBoundary = isNearLevelBoundary({
    theta: estimate.theta,
    levels: [...levelsById.values()],
    range: settings.thetaRange,
    mappingRule: settings.levelMappingRule,
    margin: settings.classificationZ * estimate.standardError,
  })
  return {
    levelLabel: level?.label ?? null,
    confidence: classified
      ? ('HIGH' as const)
      : nearBoundary
        ? ('LOW' as const)
        : ('MODERATE' as const),
    nearBoundary,
    ...normalized,
  }
}

function serializeLevelBands(
  levels: AdaptiveRuntimeLevel[],
  settings: AdaptiveRuntimeSettings
) {
  return mapLevelsToTheta(
    levels,
    settings.thetaRange,
    settings.levelMappingRule
  ).map((level) => ({
    label: level.label,
    order: level.order,
    startPosition: normalizeThetaForChart(
      Number.isFinite(level.lowerBound)
        ? level.lowerBound
        : settings.thetaRange.min,
      settings.thetaRange
    ),
    endPosition: normalizeThetaForChart(
      Number.isFinite(level.upperBound)
        ? level.upperBound
        : settings.thetaRange.max,
      settings.thetaRange
    ),
  }))
}

function mapLevelForTheta(
  theta: number,
  levels: AdaptiveRuntimeLevel[],
  settings: AdaptiveRuntimeSettings
) {
  const mapped = mapLevelsToTheta(
    levels,
    settings.thetaRange,
    settings.levelMappingRule
  ).find((level) => theta >= level.lowerBound && theta < level.upperBound)
  return mapped
    ? levels.find(
        (level) => level.label === mapped.label && level.order === mapped.order
      )
    : levels.at(-1)
}
