import type { AdaptivePosterior } from './posterior.js'
import type {
  AdaptiveRuntimeSettings,
  AdaptiveRuntimeStopReason,
} from './runtime.js'
import type {
  AdaptiveV2Mode,
  AdaptiveV2PoolItem,
  AdaptiveV2ResearchPolicy,
} from './selectionV2.js'

export type AdaptiveV2RuntimeSettings = AdaptiveRuntimeSettings & {
  mode: AdaptiveV2Mode
  /**
   * A bounded diagnostic-only configuration for evaluating overall placement.
   * Omitted settings retain the regular diagnostic stop gate.
   */
  stoppingPolicy?:
    | 'OVERALL_PLACEMENT_PILOT'
    | 'ROOT_BALANCED_PLACEMENT'
    | 'FOCUSED_ROOT_BALANCED_PLACEMENT'
  credibleMass: number
  classificationProbabilityThreshold: number
  minimumRootResponses: number
  researchPolicy: AdaptiveV2ResearchPolicy | null
}

export type AdaptiveV2ResultStatus =
  | 'CLASSIFIED'
  | 'BETWEEN_LEVELS'
  | 'INSUFFICIENT_EVIDENCE'
  | 'POOL_LIMITED'
  | 'RESEARCH_ONLY'

export type AdaptiveV2Estimate = {
  nodeKind: 'OVERALL' | 'COMPETENCE' | 'SUBCOMPETENCE'
  nodeId: number | null
  posterior: AdaptivePosterior
  responseCount: number
  administeredResponseCount: number
  classifiedLevelId: number | null
  classificationProbability: number | null
  resultStatus: AdaptiveV2ResultStatus
  leadingLevelIds: number[]
  evidenceSatisfied: boolean
  evidenceReachable: boolean
  calibratedCoverageSatisfied: boolean
  stopReason: AdaptiveRuntimeStopReason | null
}

export type AdaptiveV2Estimates = {
  overall: AdaptiveV2Estimate
  nodes: Map<number, AdaptiveV2Estimate>
}

export type AdaptiveV2Decision = {
  nextPoolItem: AdaptiveV2PoolItem | null
  stopReason: AdaptiveRuntimeStopReason | null
  resultStatus: AdaptiveV2ResultStatus | null
  selection: {
    role: AdaptiveV2PoolItem['role']
    conditionalAdministrationProbability: number
    collectionDesignVersion: string | null
    randomizationVersion: string
    randomDraw: number
    candidateSetHash: string
  } | null
  estimates: AdaptiveV2Estimates
}
