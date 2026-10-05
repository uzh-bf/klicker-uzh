import {
  createAdaptiveClient,
  type DecisionRequest,
} from '@klicker-uzh/adaptive-client'
import type {
  AdaptiveRuntimeDecision,
  AdaptiveRuntimeNode,
  AdaptiveRuntimePoolItem,
  AdaptiveRuntimeSettings,
  AdaptiveScaleDefinition,
  AdaptiveV2Decision,
  AdaptiveV2PoolItem,
  AdaptiveV2RuntimeSettings,
  AdaptiveV2SelectionContext,
} from '@klicker-uzh/adaptive-contract'
import { adaptivePracticeQuizError } from './adaptivePracticeQuizErrors.js'
import type {
  AdaptiveRuntimeLevel,
  AdaptiveRuntimeResponse,
  AdaptiveRuntimeRoutingPoolItem,
} from './adaptivePracticeQuizRuntime.js'
import type { AdaptiveV2RoutingPoolItem } from './adaptivePracticeQuizRuntimeV2.js'

export {
  ADAPTIVE_V2_CANDIDATE_SET_POLICY_VERSION,
  ADAPTIVE_V2_EXPOSURE_CEILING,
  ADAPTIVE_V2_FOCUSED_ROOT_BALANCED_PLACEMENT_STOPPING_POLICY_VERSION,
  ADAPTIVE_V2_OVERLAP_POLICY_VERSION,
  ADAPTIVE_V2_PLACEMENT_PILOT_STOPPING_POLICY_VERSION,
  ADAPTIVE_V2_RESEARCH_ALLOCATION_POLICY_VERSION,
  ADAPTIVE_V2_RESEARCH_ANCHOR_RESPONSES_PER_LEAF_LEVEL,
  ADAPTIVE_V2_RESEARCH_COLLECTION_VERSION,
  ADAPTIVE_V2_RESEARCH_FIELD_TEST_RESPONSES_PER_LEAF,
  ADAPTIVE_V2_RESEARCH_MINIMUM_DISTINCT_ANCHORS_PER_LEAF_LEVEL,
  ADAPTIVE_V2_RESEARCH_MINIMUM_DISTINCT_FIELD_TESTS_PER_LEAF,
  ADAPTIVE_V2_RESEARCH_SCORING_REDUNDANCY_PER_LEAF,
  ADAPTIVE_V2_ROOT_BALANCED_PLACEMENT_STOPPING_POLICY_VERSION,
  ADAPTIVE_V2_STOPPING_POLICY_VERSION,
} from './adaptivePracticeQuizEstimatorIdentity.js'

export type LoadedAdaptiveEstimator =
  | {
      measurementVersion: 'IRT_V1'
      algorithm: {
        nodes: AdaptiveRuntimeNode[]
        levels: AdaptiveRuntimeLevel[]
        pool: AdaptiveRuntimeRoutingPoolItem[]
        settings: AdaptiveRuntimeSettings
      }
    }
  | {
      measurementVersion: 'IRT_V2_EAP_GRID_1'
      algorithm: {
        nodes: AdaptiveRuntimeNode[]
        scale: AdaptiveScaleDefinition
        pool: AdaptiveV2PoolItem[]
        settings: AdaptiveV2RuntimeSettings
        poolById: ReadonlyMap<number, AdaptiveV2PoolItem>
      }
    }

export type LoadedAdaptiveDecision =
  | {
      measurementVersion: 'IRT_V1'
      decision: AdaptiveRuntimeDecision<AdaptiveRuntimeRoutingPoolItem>
    }
  | {
      measurementVersion: 'IRT_V2_EAP_GRID_1'
      decision: AdaptiveV2Decision
    }

export async function prepareLoadedAdaptiveEstimator(
  input:
    | {
        measurementVersion: 'IRT_V1'
        nodes: AdaptiveRuntimeNode[]
        levels: AdaptiveRuntimeLevel[]
        pool: AdaptiveRuntimeRoutingPoolItem[]
        settings: AdaptiveRuntimeSettings
      }
    | {
        measurementVersion: 'IRT_V2_EAP_GRID_1'
        nodes: AdaptiveRuntimeNode[]
        scale: AdaptiveScaleDefinition
        pool: AdaptiveV2RoutingPoolItem[]
        settings: AdaptiveV2RuntimeSettings
      }
): Promise<LoadedAdaptiveEstimator> {
  const runtime: LoadedAdaptiveEstimator =
    input.measurementVersion === 'IRT_V1'
      ? { measurementVersion: input.measurementVersion, algorithm: input }
      : {
          measurementVersion: input.measurementVersion,
          algorithm: {
            ...input,
            poolById: new Map(input.pool.map((item) => [item.id, item])),
          },
        }
  const baseUrl = process.env.ADAPTIVE_ENGINE_URL
  const token = process.env.ADAPTIVE_ENGINE_TOKEN
  if (!baseUrl || !token)
    throw adaptivePracticeQuizError(
      'The adaptive calculation service is not configured.',
      'ADAPTIVE_ENGINE_UNAVAILABLE'
    )
  const request = buildAdaptiveDecisionRequest({
    attemptId: '00000000-0000-4000-8000-000000000000',
    runtime,
    responses: [],
  })
  // Runtime validation must happen before persisted snapshots are used. Keep its
  // deadline below the decision deadline so both fit the host transaction budget.
  const {
    routingSeed: _routingSeed,
    terminalStopReason: _terminalStopReason,
    ...validation
  } = request
  const { selection: _selection, ...validationWithoutSelection } = {
    ...validation,
    selection: 'selection' in validation ? validation.selection : undefined,
  }
  await createAdaptiveClient({ baseUrl, token, timeoutMs: 4000 }).validate(
    validationWithoutSelection
  )
  return runtime
}

export async function advanceLoadedAdaptiveRuntime({
  attemptId,
  runtime,
  responses,
  selectionContext,
  terminalStopReason,
}: {
  attemptId: string
  runtime: LoadedAdaptiveEstimator
  responses: AdaptiveRuntimeResponse[]
  terminalStopReason?: 'INSUFFICIENT_DATA'
  selectionContext?: {
    isExposureEligible: AdaptiveV2SelectionContext['isExposureEligible']
    servedCountByPoolItem: ReadonlyMap<number, number>
    priorAttemptPoolItemIds: ReadonlySet<number>
  }
}): Promise<LoadedAdaptiveDecision> {
  const baseUrl = process.env.ADAPTIVE_ENGINE_URL
  const token = process.env.ADAPTIVE_ENGINE_TOKEN
  if (!baseUrl || !token) {
    throw adaptivePracticeQuizError(
      'The adaptive calculation service is not configured.',
      'ADAPTIVE_ENGINE_UNAVAILABLE'
    )
  }
  const request = buildAdaptiveDecisionRequest({
    attemptId,
    runtime,
    responses,
    selectionContext,
    terminalStopReason,
  })
  try {
    const result = await createAdaptiveClient({ baseUrl, token }).decide(
      request
    )
    if (
      result.measurementVersion === 'IRT_V1' &&
      runtime.measurementVersion === 'IRT_V1'
    ) {
      return {
        measurementVersion: 'IRT_V1',
        decision: {
          nextPoolItem:
            runtime.algorithm.pool.find(
              (item) => item.id === result.nextPoolItemId
            ) ?? null,
          stopReason: result.stopReason,
          estimates: {
            overall: result.estimates.overall,
            nodes: new Map(
              result.estimates.nodes.map((row) => [row.nodeId!, row])
            ),
          },
        },
      }
    }
    if (
      result.measurementVersion === 'IRT_V2_EAP_GRID_1' &&
      runtime.measurementVersion === 'IRT_V2_EAP_GRID_1'
    ) {
      return {
        measurementVersion: result.measurementVersion,
        decision: {
          nextPoolItem:
            result.nextPoolItemId === null
              ? null
              : runtime.algorithm.poolById.get(result.nextPoolItemId)!,
          stopReason: result.stopReason,
          resultStatus: result.resultStatus,
          selection: result.selection,
          estimates: {
            overall: result.estimates.overall,
            nodes: new Map(
              result.estimates.nodes.map((row) => [row.nodeId!, row])
            ),
          },
        },
      }
    }
    throw new Error('Estimator mismatch')
  } catch {
    throw adaptivePracticeQuizError(
      'The adaptive calculation service is unavailable. Please try again.',
      'ADAPTIVE_ENGINE_UNAVAILABLE'
    )
  }
}

export function buildAdaptiveDecisionRequest({
  attemptId,
  runtime,
  responses,
  selectionContext,
  terminalStopReason,
}: Omit<Parameters<typeof advanceLoadedAdaptiveRuntime>[0], 'responses'> & {
  responses: readonly Pick<
    AdaptiveRuntimeResponse,
    'order' | 'poolItemId' | 'correct'
  >[]
}): DecisionRequest {
  const algorithm = runtime.algorithm
  const common = {
    contractVersion: 1 as const,
    routingSeed: attemptId,
    nodes: algorithm.nodes.map(
      ({ id, parentId, kind, depth, order, enabled, weight, questionCap }) => ({
        id,
        parentId,
        kind,
        depth,
        order,
        enabled,
        weight,
        questionCap,
      })
    ),
    responses: responses.map(({ order, poolItemId, correct }) => ({
      order,
      poolItemId,
      correct,
    })),
    terminalStopReason,
  }
  const commonPool = (item: AdaptiveRuntimePoolItem) => ({
    id: item.id,
    leafNodeId: item.leafNodeId,
    nodePath: [...item.nodePath],
    levelId: item.levelId,
    discrimination: item.discrimination,
    difficulty: item.difficulty,
    guessing: item.guessing,
  })
  let request: DecisionRequest
  if (runtime.measurementVersion === 'IRT_V1') {
    request = {
      ...common,
      measurementVersion: runtime.measurementVersion,
      levels: runtime.algorithm.levels.map(({ id, order }) => ({
        id,
        label: `level-${order}`,
        order,
      })),
      pool: runtime.algorithm.pool.map((item) => ({
        ...commonPool(item),
        // Sent only when present, so single-leaf quizzes keep the exact
        // request shape accepted by engines without multi-leaf IRT_V1 support.
        ...(item.additionalLeafNodeIds?.length
          ? { additionalLeafNodeIds: [...item.additionalLeafNodeIds] }
          : {}),
      })),
      settings: v1EngineSettings(runtime.algorithm.settings),
    }
  } else {
    const algorithm = runtime.algorithm
    if (algorithm.scale.classificationPolicyVersion !== 1)
      throw adaptivePracticeQuizError(
        'Unsupported classification policy.',
        'ADAPTIVE_CLASSIFICATION_POLICY_MISMATCH'
      )
    request = {
      ...common,
      measurementVersion: runtime.measurementVersion,
      settings: algorithm.settings,
      scale: {
        ...algorithm.scale,
        classificationPolicyVersion: 1,
        levels: algorithm.scale.levels.map(
          ({ id, order, lowerBound, upperBound, itemDifficultyPrior }) => ({
            id,
            label: `level-${order}`,
            order,
            lowerBound: Number.isFinite(lowerBound) ? lowerBound : null,
            upperBound: Number.isFinite(upperBound) ? upperBound : null,
            itemDifficultyPrior,
          })
        ),
      },
      pool: algorithm.pool.map((item) => ({
        ...commonPool(item),
        additionalLeafNodeIds: item.additionalLeafNodeIds
          ? [...item.additionalLeafNodeIds]
          : undefined,
        itemType: item.itemType,
        choiceCount: item.choiceCount,
        model: item.model,
        calibrationId: item.calibrationId,
        contributesToEstimate: item.contributesToEstimate,
        role: item.role,
      })),
      selection: {
        eligiblePoolItemIds: algorithm.pool
          .filter(
            (item) =>
              !selectionContext?.isExposureEligible ||
              selectionContext.isExposureEligible(item)
          )
          .map((item) => item.id),
        servedCounts: [
          ...(selectionContext?.servedCountByPoolItem ??
            new Map<number, number>()),
        ],
        priorAttemptPoolItemIds: [
          ...(selectionContext?.priorAttemptPoolItemIds ?? []),
        ],
      },
    }
  }
  return request
}

/**
 * The classification tolerance is sent only when above 0: engines before
 * Catalyst SEQUENTIAL_ROOTS_V6 reject the field, and 0 is their exact rule.
 */
export function v1EngineSettings(
  settings: AdaptiveRuntimeSettings
): AdaptiveRuntimeSettings {
  const { classificationToleranceBands, ...exact } = settings
  return classificationToleranceBands && classificationToleranceBands > 0
    ? { ...exact, classificationToleranceBands }
    : exact
}
