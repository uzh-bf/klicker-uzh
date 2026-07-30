import {
  classificationIntervalWithinLevelBand,
  isNearLevelBoundary,
  mapLevelsToTheta,
  normalizeThetaForChart,
} from '@klicker-uzh/adaptive-learning'
import * as DB from '@klicker-uzh/prisma/client'
import { adaptivePracticeQuizError } from './adaptivePracticeQuizErrors.js'
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
  getEffectivelyEnabledRuntimeNodes,
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
  servedItem: AdaptiveParticipantElement | null
}

export type AdaptiveResultConfidence =
  | 'HIGH'
  | 'MODERATE'
  | 'LOW'
  | 'INSUFFICIENT_DATA'

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
  levelLabel: string | null
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
  levelLabel: string | null
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
    maximumQuestions: runtime.config.totalQuestionCap,
    startedAt: attempt.startedAt,
    completedAt: attempt.completedAt,
    elapsedSeconds: attempt.elapsedSeconds,
    showTimer: runtime.config.showTimer,
    canStartNewAttempt:
      attempt.status === DB.AdaptivePracticeQuizAttemptStatus.COMPLETED &&
      runtime.config.attemptSelectionPolicy !==
        DB.AdaptiveAttemptSelectionPolicy.FIRST_COMPLETED,
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
    ...overallView,
    levelBands: serializeLevelBands(runtime.algorithm.levels, settings),
    trajectory,
    competenceProfile: (childrenByParent.get(null) ?? [])
      .slice()
      .sort((a, b) => a.order - b.order || a.id - b.id)
      .map(buildNode),
  }
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
