import {
  classificationIntervalWithinLevelBand,
  isNearLevelBoundary,
} from '@klicker-uzh/adaptive-contract'
import * as DB from '@klicker-uzh/prisma/client'
import { adaptivePracticeQuizError } from './adaptivePracticeQuizErrors.js'
import { getEffectivelyEnabledRuntimeNodes } from './adaptivePracticeQuizEstimatePersistence.js'
import {
  mapLevelForTheta,
  serializeLevelBands,
} from './adaptivePracticeQuizLegacyLevelScale.js'
import { createAdaptiveV1LevelDetermination } from './adaptivePracticeQuizLevelDetermination.js'
import {
  adaptiveRetakeAvailableAt,
  isAdaptiveRetakeCooldownElapsed,
} from './adaptivePracticeQuizRetakes.js'
import {
  resolveLegacyRoughEstimate,
  resolveV2RoughLevelLabel,
} from './adaptivePracticeQuizRoughEstimate.js'
import {
  type AdaptiveParticipantElement,
  type AdaptiveRuntimeLevel,
  type AdaptiveRuntimeNode,
  type AdaptiveRuntimeSettings,
  MIN_REPORTING_RESPONSES,
  normalizeRuntimeEstimateForChart,
  serializeAdaptiveParticipantElement,
} from './adaptivePracticeQuizRuntime.js'
import {
  type AdaptiveAttemptRuntimeRecord,
  type LoadedAdaptiveRuntime,
  toDeliveredRuntimePoolItem,
} from './adaptivePracticeQuizRuntimeData.js'
import { withAttemptTestingEstimates } from './adaptivePracticeQuizTestingAttemptView.js'
import {
  normalizeV2Position,
  serializeV2EstimateView,
  serializeV2LevelBands,
} from './adaptivePracticeQuizV2ParticipantViews.js'

export type AdaptivePracticeQuizAttemptState = {
  attemptId: string
  practiceQuizId: string
  practiceQuizName: string
  status: DB.AdaptivePracticeQuizAttemptStatus
  stopReason: DB.AdaptivePracticeQuizStopReason | null
  answeredQuestions: number
  questionNumber: number | null
  maximumQuestions: number
  timeLimitSeconds: number | null
  deadlineAt: Date | null
  startedAt: Date
  completedAt: Date | null
  elapsedSeconds: number | null
  showTimer: boolean
  canStartNewAttempt: boolean
  nextAttemptAvailableAt: Date | null
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
  // Whether the published pool has at least one element at this level, so
  // the result can mark estimates beyond the measurable range.
  hasElements?: boolean
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
  // Display-only best-guess level for a node with answers but no reported
  // level; never changes classification or what counts as determined.
  roughLevelLabel: string | null
  leadingLevelLabels: string[]
  classificationProbability: number | null
  confidence: AdaptiveResultConfidence
  nearBoundary: boolean
  position: number | null
  lowerPosition: number | null
  upperPosition: number | null
  // IRT_V1 engine leaf coverage of the persisted decision (subcompetences
  // only); null for other nodes, IRT v2 and older engines.
  coverageStatus: DB.AdaptiveLeafCoverageStatus | null
  children: AdaptiveStudentResultNode[]
}

export type AdaptiveStudentResult = {
  isPlacementPilot: boolean
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
  // IRT_V1 classification tolerance in level bands (0 = exact level).
  classificationToleranceBands: number
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
    timeLimitSeconds: runtime.publication.timeLimitSeconds,
    deadlineAt:
      runtime.publication.timeLimitSeconds === null
        ? null
        : new Date(
            attempt.startedAt.getTime() +
              runtime.publication.timeLimitSeconds * 1_000
          ),
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
    nextAttemptAvailableAt:
      attempt.status === DB.AdaptivePracticeQuizAttemptStatus.COMPLETED &&
      attempt.completedAt !== null &&
      runtime.publication.retakePolicy !==
        DB.AdaptiveAttemptSelectionPolicy.FIRST_COMPLETED
        ? adaptiveRetakeAvailableAt({
            completedAt: attempt.completedAt,
            cooldownDays: runtime.publication.retakeCooldownDays,
          })
        : null,
    submittedResponseFeedback: null,
    servedItem: nextPoolItem
      ? withAttemptTestingEstimates(
          serializeAdaptiveParticipantElement(nextPoolItem),
          runtime,
          attempt
        )
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
  // A level is reported (and counted as classified) only when the host rule
  // shared with the lecturer cohort determines it, not whenever a level id
  // exists; otherwise it becomes a rough, display-only estimate.
  const determination = createAdaptiveV1LevelDetermination({
    runtime,
    answeredPoolItemIds: attempt.responses.map(({ poolItemId }) => poolItemId),
    coverageStatusByLeaf: new Map(
      attempt.estimates.flatMap((estimate) =>
        estimate.nodeKind === DB.AdaptiveEstimateNodeKind.SUBCOMPETENCE &&
        estimate.nodeId !== null
          ? [[estimate.nodeId, estimate.coverageStatus] as const]
          : []
      )
    ),
  })
  const reportedView = (
    nodeId: number | null,
    estimate: (typeof attempt.estimates)[number] | undefined
  ) => {
    const view = serializeEstimateView({ estimate, levelsById, settings })
    return view.levelLabel !== null &&
      estimate &&
      determination.isDetermined(nodeId, {
        theta: estimate.theta!,
        standardError: estimate.standardError!,
        stopReason: estimate.stopReason,
      })
      ? view
      : { ...view, levelLabel: null }
  }
  const overallView = reportedView(null, overall)
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
    const view = reportedView(node.id, estimate)
    const rough =
      view.levelLabel === null
        ? resolveLegacyRoughEstimate({
            estimate,
            levels: runtime.algorithm.levels,
            range: settings.thetaRange,
            mappingRule: settings.levelMappingRule,
            z: settings.classificationZ,
          })
        : null
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
      ...rough,
      roughLevelLabel: rough?.roughLevelLabel ?? null,
      coverageStatus:
        node.kind === DB.AdaptiveNodeKind.SUBCOMPETENCE
          ? (estimate?.coverageStatus ?? null)
          : null,
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
    isPlacementPilot: false,
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
    levelBands: withLevelBandElements(
      serializeLevelBands(runtime.algorithm.levels, settings),
      runtime.algorithm.levels.filter(({ id }) =>
        runtime.pool.some(({ levelId }) => levelId === id)
      )
    ),
    classificationToleranceBands: settings.classificationToleranceBands ?? 0,
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
    const view = serializeV2EstimateView({ estimate, levels, runtime })
    return {
      id: node.id,
      name,
      kind: node.kind,
      order: node.order,
      responseCount: estimate.responseCount,
      ...view,
      roughLevelLabel:
        view.classification === DB.AdaptiveResultStatus.INSUFFICIENT_EVIDENCE &&
        view.position !== null &&
        estimate.responseCount > 0
          ? resolveV2RoughLevelLabel({
              theta: estimate.theta,
              bandProbabilities: estimate.bandProbabilities,
              levels,
            })
          : null,
      coverageStatus: null,
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
    isPlacementPilot:
      runtime.publication.preset === DB.AdaptivePracticeQuizPreset.PLACEMENT,
    attemptId: attempt.id,
    practiceQuizId: attempt.practiceQuizId,
    practiceQuizName: runtime.quiz.displayName,
    stopReason,
    answeredQuestions: attempt.responses.length,
    completedAt,
    levelInterpretation:
      runtime.publication.evidenceMinimumSnapshot.levelMappingRule,
    ...overallView,
    levelBands: researchOnly
      ? []
      : withLevelBandElements(
          serializeV2LevelBands(runtime),
          runtime.publication.cutScoreSnapshot
            .filter(({ scaleLevelId }) =>
              runtime.pool.some(({ levelId }) => levelId === scaleLevelId)
            )
            .map(({ order }) => ({ order }))
        ),
    classificationToleranceBands: 0,
    trajectory,
    competenceProfile: (childrenByParent.get(null) ?? [])
      .slice()
      .sort((left, right) => left.order - right.order || left.id - right.id)
      .map(buildNode),
  }
}

function withLevelBandElements(
  bands: AdaptiveResultLevelBand[],
  coveredLevels: ReadonlyArray<{ order: number }>
): AdaptiveResultLevelBand[] {
  const covered = new Set(coveredLevels.map(({ order }) => order))
  return bands.map((band) => ({
    ...band,
    hasElements: covered.has(band.order),
  }))
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
    toleranceBands: settings.classificationToleranceBands ?? 0,
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
