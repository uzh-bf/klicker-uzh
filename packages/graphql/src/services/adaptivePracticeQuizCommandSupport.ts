import * as DB from '@klicker-uzh/prisma/client'
import { randomUUID } from 'node:crypto'
import type { ContextWithUser } from '../lib/context.js'
import { adaptivePracticeQuizError as runtimeError } from './adaptivePracticeQuizErrors.js'
import {
  sourceLevelIdForScaleLevel,
  toBandProbabilityRecord,
} from './adaptivePracticeQuizEstimatePersistence.js'
import { ADAPTIVE_V2_DIAGNOSTIC_RELEASE } from './adaptivePracticeQuizEstimatorIdentity.js'
import {
  advanceLoadedAdaptiveRuntime,
  type LoadedAdaptiveDecision,
  type LoadedAdaptiveEstimator,
} from './adaptivePracticeQuizEstimatorVersions.js'
import { emitAdaptiveOperationalEvent } from './adaptivePracticeQuizEvents.js'
import {
  serializeAdaptiveAttemptState as serializeAttemptState,
  type AdaptivePracticeQuizAttemptState,
} from './adaptivePracticeQuizParticipantViews.js'
import {
  type AdaptivePracticeQuizResponseInput,
  type AdaptiveRuntimePoolItem,
} from './adaptivePracticeQuizRuntime.js'
import {
  adaptiveAttemptRuntimeInclude as attemptRuntimeInclude,
  incrementAdaptiveV2Exposure,
  loadAdaptiveV2SelectionContext,
  type AdaptiveAttemptRuntimeRecord,
  type LoadedAdaptiveRuntime,
} from './adaptivePracticeQuizRuntimeData.js'

type AdaptiveV2DeliveryData = Pick<
  DB.Prisma.AdaptivePracticeQuizAttemptUncheckedCreateInput,
  | 'nextAdministrationProbability'
  | 'nextCollectionDesignVersion'
  | 'nextRandomizationVersion'
  | 'nextRandomDraw'
  | 'nextCandidateSetHash'
  | 'nextItemRole'
>

type LoadedRuntimeFor<
  Version extends LoadedAdaptiveEstimator['measurementVersion'],
> = LoadedAdaptiveRuntime & {
  estimator: Extract<LoadedAdaptiveEstimator, { measurementVersion: Version }>
}

export type AdvancedAdaptiveRuntime =
  | {
      measurementVersion: 'IRT_V1'
      runtime: LoadedRuntimeFor<'IRT_V1'>
      decision: Extract<
        LoadedAdaptiveDecision,
        { measurementVersion: 'IRT_V1' }
      >['decision']
    }
  | {
      measurementVersion: 'IRT_V2_EAP_GRID_1'
      runtime: LoadedRuntimeFor<'IRT_V2_EAP_GRID_1'>
      decision: Extract<
        LoadedAdaptiveDecision,
        { measurementVersion: 'IRT_V2_EAP_GRID_1' }
      >['decision']
    }

export function submittedChoiceFeedback(
  poolItem: AdaptiveRuntimePoolItem,
  response: AdaptivePracticeQuizResponseInput
) {
  if (
    poolItem.elementData.type !== DB.ElementType.SC &&
    poolItem.elementData.type !== DB.ElementType.MC &&
    poolItem.elementData.type !== DB.ElementType.KPRIM
  ) {
    return []
  }
  const selected = new Set(response.choiceIndices ?? [])
  return poolItem.elementData.options.choices.flatMap((choice) =>
    selected.has(choice.ix) && choice.feedback ? [choice.feedback] : []
  )
}

export async function createAdaptiveAttempt({
  prisma,
  runtime,
  participantId,
  participationId,
}: {
  prisma: DB.Prisma.TransactionClient
  runtime: LoadedAdaptiveRuntime
  participantId: string
  participationId: number
}): Promise<AdaptivePracticeQuizAttemptState> {
  assertAdaptiveV2DiagnosticAttemptStartEnabled(runtime)
  const attemptId = randomUUID()
  const selectionContext = await loadAdaptiveV2SelectionContext({
    prisma,
    runtime,
    participantId,
    attemptId,
    startingAttempt: true,
  })
  const loadedDecision = advanceAdaptiveRuntimeWithTelemetry({
    loadedRuntime: runtime,
    operation: 'START',
    input: {
      attemptId,
      responses: [],
      selectionContext,
    },
  })
  const decision = loadedDecision.decision
  if (!decision.nextPoolItem) {
    throw runtimeError(
      'The adaptive practice quiz has no deliverable item.',
      'ADAPTIVE_POOL_EXHAUSTED'
    )
  }
  const attempt = await prisma.adaptivePracticeQuizAttempt.create({
    data: {
      id: attemptId,
      configId: runtime.config.id,
      competenceTreeId: runtime.tree.id,
      publicationId: runtime.publication.id,
      scaleVersionId: runtime.publication.scaleVersionId,
      measurementVersion: runtime.publication.measurementVersion,
      estimatorImplementationVersion:
        runtime.publication.estimatorImplementationVersion,
      classificationPolicyVersion:
        runtime.publication.classificationPolicyVersion,
      calibrationPolicyVersion: runtime.publication.calibrationPolicyVersion,
      practiceQuizId: runtime.quiz.id,
      courseId: runtime.quiz.courseId,
      participantId,
      participationId,
      nextPoolItemId: decision.nextPoolItem.id,
      ...nextAdaptiveV2DeliveryData(loadedDecision),
    },
    include: attemptRuntimeInclude,
  })
  if (
    loadedDecision.measurementVersion ===
    DB.AdaptiveMeasurementVersion.IRT_V2_EAP_GRID_1
  ) {
    await incrementAdaptiveV2Exposure({
      prisma,
      publicationId: runtime.publication.id,
      poolItemId: decision.nextPoolItem.id,
      counter: 'servedCount',
    })
  }
  return serializeAttemptState(runtime, attempt)
}

export function assertAdaptiveV2DiagnosticAttemptStartEnabled(
  runtime: Pick<LoadedAdaptiveRuntime, 'publication'>
) {
  if (
    runtime.publication.measurementVersion ===
      DB.AdaptiveMeasurementVersion.IRT_V2_EAP_GRID_1 &&
    runtime.publication.preset === DB.AdaptivePracticeQuizPreset.DIAGNOSTIC &&
    !ADAPTIVE_V2_DIAGNOSTIC_RELEASE.enabled
  ) {
    throw runtimeError(
      'IRT v2 Diagnostic attempts are not released.',
      'ADAPTIVE_V2_DIAGNOSTIC_RELEASE_DISABLED'
    )
  }
}

export function advanceAdaptiveRuntimeWithTelemetry({
  loadedRuntime,
  operation,
  input,
}: {
  loadedRuntime: LoadedAdaptiveRuntime
  operation: 'START' | 'ADVANCE'
  input: Omit<Parameters<typeof advanceLoadedAdaptiveRuntime>[0], 'runtime'>
}): AdvancedAdaptiveRuntime {
  try {
    const loadedDecision = advanceLoadedAdaptiveRuntime({
      ...input,
      runtime: loadedRuntime.estimator,
    })
    if (loadedDecision.measurementVersion === 'IRT_V1') {
      if (loadedRuntime.estimator.measurementVersion !== 'IRT_V1') {
        throw runtimeError(
          'Adaptive runtime and estimator decision versions disagree.',
          'ADAPTIVE_ESTIMATOR_RUNTIME_MISMATCH'
        )
      }
      return {
        ...loadedDecision,
        runtime: {
          ...loadedRuntime,
          estimator: loadedRuntime.estimator,
        },
      }
    }
    if (loadedRuntime.estimator.measurementVersion !== 'IRT_V2_EAP_GRID_1') {
      throw runtimeError(
        'Adaptive runtime and estimator decision versions disagree.',
        'ADAPTIVE_ESTIMATOR_RUNTIME_MISMATCH'
      )
    }
    return {
      ...loadedDecision,
      runtime: {
        ...loadedRuntime,
        estimator: loadedRuntime.estimator,
      },
    }
  } catch (error) {
    if (
      loadedRuntime.publication.measurementVersion ===
      DB.AdaptiveMeasurementVersion.IRT_V2_EAP_GRID_1
    ) {
      emitAdaptiveOperationalEvent({
        name: 'adaptive_estimator_failed',
        practiceQuizId: loadedRuntime.quiz.id,
        courseId: loadedRuntime.quiz.courseId,
        operation,
        estimatorImplementationVersion:
          loadedRuntime.publication.estimatorImplementationVersion,
        reason: 'COMPUTATION_REJECTED',
      })
    }
    throw error
  }
}

function nextAdaptiveV2DeliveryData(
  loadedDecision: ReturnType<typeof advanceLoadedAdaptiveRuntime>
): Partial<AdaptiveV2DeliveryData> {
  if (
    loadedDecision.measurementVersion !==
    DB.AdaptiveMeasurementVersion.IRT_V2_EAP_GRID_1
  ) {
    return {}
  }
  const { decision } = loadedDecision
  if (!decision.nextPoolItem || !decision.selection) {
    return clearAdaptiveDeliveryData()
  }
  return {
    nextAdministrationProbability:
      decision.selection.conditionalAdministrationProbability,
    nextCollectionDesignVersion: decision.selection.collectionDesignVersion,
    nextRandomizationVersion: decision.selection.randomizationVersion,
    nextRandomDraw: BigInt(decision.selection.randomDraw),
    nextCandidateSetHash: decision.selection.candidateSetHash,
    nextItemRole: DB.AdaptivePoolItemRole[decision.selection.role],
  }
}

export function clearAdaptiveDeliveryData(): AdaptiveV2DeliveryData {
  return {
    nextAdministrationProbability: null,
    nextCollectionDesignVersion: null,
    nextRandomizationVersion: null,
    nextRandomDraw: null,
    nextCandidateSetHash: null,
    nextItemRole: null,
  }
}

export function adaptiveV2ResponseAuditData(
  attempt: AdaptiveAttemptRuntimeRecord,
  loadedDecision: Extract<
    ReturnType<typeof advanceLoadedAdaptiveRuntime>,
    { measurementVersion: 'IRT_V2_EAP_GRID_1' }
  >
): Pick<
  DB.Prisma.AdaptivePracticeQuizResponseUncheckedCreateInput,
  | 'overallCredibleLowerAfter'
  | 'overallCredibleUpperAfter'
  | 'overallBandProbabilitiesAfter'
  | 'administrationProbability'
  | 'collectionDesignVersion'
  | 'randomizationVersion'
  | 'randomDraw'
  | 'candidateSetHash'
  | 'itemRole'
  | 'isCalibrationAnchor'
> {
  if (
    attempt.nextAdministrationProbability === null ||
    attempt.nextRandomizationVersion === null ||
    attempt.nextRandomDraw === null ||
    attempt.nextCandidateSetHash === null ||
    attempt.nextItemRole === null
  ) {
    throw runtimeError(
      'The served Bayesian item has incomplete delivery audit data.',
      'ADAPTIVE_ATTEMPT_DATA_INVALID'
    )
  }
  const posterior = loadedDecision.decision.estimates.overall.posterior
  return {
    overallCredibleLowerAfter: posterior.credibleLower,
    overallCredibleUpperAfter: posterior.credibleUpper,
    overallBandProbabilitiesAfter: toBandProbabilityRecord(
      posterior.bandProbabilities
    ),
    administrationProbability: attempt.nextAdministrationProbability,
    collectionDesignVersion: attempt.nextCollectionDesignVersion,
    randomizationVersion: attempt.nextRandomizationVersion,
    randomDraw: attempt.nextRandomDraw,
    candidateSetHash: attempt.nextCandidateSetHash,
    itemRole: attempt.nextItemRole,
    isCalibrationAnchor:
      attempt.nextItemRole === DB.AdaptivePoolItemRole.ANCHOR,
  }
}

export function adaptiveV2AttemptUpdateData({
  runtime,
  loadedDecision,
  terminalStopReason,
  totalElapsedSeconds,
  completedAt,
}: {
  runtime: LoadedAdaptiveRuntime
  loadedDecision: Extract<
    ReturnType<typeof advanceLoadedAdaptiveRuntime>,
    { measurementVersion: 'IRT_V2_EAP_GRID_1' }
  >
  terminalStopReason: DB.AdaptivePracticeQuizStopReason | null
  totalElapsedSeconds: number | null
  completedAt: Date
}): DB.Prisma.AdaptivePracticeQuizAttemptUncheckedUpdateInput {
  const { decision } = loadedDecision
  const overall = decision.estimates.overall
  const posterior = overall.posterior
  const terminal = terminalStopReason !== null
  return {
    nextPoolItemId: decision.nextPoolItem?.id ?? null,
    ...nextAdaptiveV2DeliveryData(loadedDecision),
    currentTheta: posterior.mean,
    currentStandardError: posterior.standardDeviation,
    credibleLower: posterior.credibleLower,
    credibleUpper: posterior.credibleUpper,
    bandProbabilities: toBandProbabilityRecord(posterior.bandProbabilities),
    elapsedSeconds: totalElapsedSeconds,
    ...(terminal
      ? {
          status: DB.AdaptivePracticeQuizAttemptStatus.COMPLETED,
          stopReason: terminalStopReason,
          resultStatus:
            decision.resultStatus === null
              ? DB.AdaptiveResultStatus.POOL_LIMITED
              : DB.AdaptiveResultStatus[decision.resultStatus],
          finalTheta: posterior.mean,
          finalStandardError: posterior.standardDeviation,
          finalScaleLevelId: overall.classifiedLevelId,
          finalLevelId: sourceLevelIdForScaleLevel(
            runtime,
            overall.classifiedLevelId
          ),
          finalBandProbability: overall.classificationProbability,
          completedAt,
        }
      : {}),
  }
}

export function assertParticipant(ctx: ContextWithUser) {
  if (ctx.user.role !== DB.UserRole.PARTICIPANT) {
    throw runtimeError(
      'Adaptive attempts require participant authentication.',
      'ADAPTIVE_PARTICIPANT_REQUIRED'
    )
  }
}
