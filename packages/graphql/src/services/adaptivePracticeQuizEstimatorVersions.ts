import {
  advanceAdaptiveRuntime,
  advanceAdaptiveV2Runtime,
  prepareAdaptiveRuntime,
  prepareAdaptiveV2Runtime,
  type AdaptiveRuntimeDecision,
  type AdaptiveRuntimeNode,
  type AdaptiveRuntimeSettings,
  type AdaptiveScaleDefinition,
  type AdaptiveV2Decision,
  type AdaptiveV2RuntimeSettings,
  type AdaptiveV2SelectionContext,
  type AdaptiveRuntimeResponse as CoreAdaptiveRuntimeResponse,
  type PreparedAdaptiveRuntime,
  type PreparedAdaptiveV2Runtime,
} from '@klicker-uzh/adaptive-learning'
import type {
  AdaptiveRuntimeLevel,
  AdaptiveRuntimeResponse,
  AdaptiveRuntimeRoutingPoolItem,
} from './adaptivePracticeQuizRuntime.js'
import type { AdaptiveV2RoutingPoolItem } from './adaptivePracticeQuizRuntimeV2.js'

export {
  ADAPTIVE_V2_CANDIDATE_SET_POLICY_VERSION,
  ADAPTIVE_V2_EXPOSURE_CEILING,
  ADAPTIVE_V2_OVERLAP_POLICY_VERSION,
  ADAPTIVE_V2_RESEARCH_ALLOCATION_POLICY_VERSION,
  ADAPTIVE_V2_RESEARCH_ANCHOR_RESPONSES_PER_LEAF_LEVEL,
  ADAPTIVE_V2_RESEARCH_COLLECTION_VERSION,
  ADAPTIVE_V2_RESEARCH_FIELD_TEST_RESPONSES_PER_LEAF,
  ADAPTIVE_V2_RESEARCH_MINIMUM_DISTINCT_ANCHORS_PER_LEAF_LEVEL,
  ADAPTIVE_V2_RESEARCH_MINIMUM_DISTINCT_FIELD_TESTS_PER_LEAF,
  ADAPTIVE_V2_RESEARCH_SCORING_REDUNDANCY_PER_LEAF,
  ADAPTIVE_V2_STOPPING_POLICY_VERSION,
} from './adaptivePracticeQuizEstimatorIdentity.js'

export type LoadedAdaptiveEstimator =
  | {
      measurementVersion: 'IRT_V1'
      algorithm: PreparedAdaptiveRuntime<AdaptiveRuntimeRoutingPoolItem>
    }
  | {
      measurementVersion: 'IRT_V2_EAP_GRID_1'
      algorithm: PreparedAdaptiveV2Runtime
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

export function prepareLoadedAdaptiveEstimator(
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
): LoadedAdaptiveEstimator {
  if (input.measurementVersion === 'IRT_V1') {
    return {
      measurementVersion: input.measurementVersion,
      algorithm: prepareAdaptiveRuntime(input),
    }
  }
  return {
    measurementVersion: input.measurementVersion,
    algorithm: prepareAdaptiveV2Runtime(input),
  }
}

export function advanceLoadedAdaptiveRuntime({
  attemptId,
  runtime,
  responses,
  selectionContext,
}: {
  attemptId: string
  runtime: LoadedAdaptiveEstimator
  responses: AdaptiveRuntimeResponse[]
  selectionContext?: {
    isExposureEligible: AdaptiveV2SelectionContext['isExposureEligible']
    servedCountByPoolItem: ReadonlyMap<number, number>
    priorAttemptPoolItemIds: ReadonlySet<number>
  }
}): LoadedAdaptiveDecision {
  if (runtime.measurementVersion === 'IRT_V1') {
    return {
      measurementVersion: runtime.measurementVersion,
      decision: advanceAdaptiveRuntime({
        attemptId,
        runtime: runtime.algorithm,
        responses,
      }),
    }
  }

  const canonicalResponses: CoreAdaptiveRuntimeResponse<AdaptiveV2RoutingPoolItem>[] =
    responses.map((response) => {
      const poolItem = runtime.algorithm.poolById.get(response.poolItemId) as
        | AdaptiveV2RoutingPoolItem
        | undefined
      if (!poolItem) {
        return response as CoreAdaptiveRuntimeResponse<AdaptiveV2RoutingPoolItem>
      }
      return { ...response, poolItem }
    })
  return {
    measurementVersion: runtime.measurementVersion,
    decision: advanceAdaptiveV2Runtime({
      attemptId,
      runtime: runtime.algorithm,
      responses: canonicalResponses,
      selectionContext,
    }),
  }
}
