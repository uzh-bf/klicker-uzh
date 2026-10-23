import type { LevelDefinition, LevelMappingRule, ThetaRange } from './core.js'

export const MIN_ADAPTIVE_REPORTING_RESPONSES = 4

export type AdaptiveRuntimeStopReason =
  | 'CLASSIFIED'
  | 'ALL_ROOTS_CLASSIFIED'
  | 'TOTAL_QUESTION_CAP'
  | 'NODE_QUESTION_CAP'
  | 'POOL_EXHAUSTED'
  | 'INSUFFICIENT_DATA'
  | 'ABANDONED'

export type AdaptiveRuntimeSettings = {
  totalQuestionCap: number
  perLeafQuestionCap: number | null
  minQuestionsPerLeaf: number
  classificationZ: number
  topInformationRatio: number
  levelMappingRule: LevelMappingRule
  thetaRange: ThetaRange
  /**
   * IRT_V1 only: classify within ±t bands of the band containing θ (Catalyst
   * SEQUENTIAL_ROOTS_V6). Absent or 0 is the exact rule; never sent as 0.
   */
  classificationToleranceBands?: number
}

export type AdaptiveRuntimeLevel = LevelDefinition & {
  id: number
}

export type AdaptiveRuntimeNode = {
  id: number
  parentId: number | null
  kind: 'COMPETENCE' | 'SUBCOMPETENCE'
  depth: number
  order: number
  enabled: boolean
  weight: number | null
  questionCap: number | null
}

export type AdaptiveRuntimePoolItem = {
  id: number
  leafNodeId: number
  nodePath: readonly number[]
  /**
   * Other subcompetences (leaves) in the same root competence that this one
   * item also measures. The item is still asked at most once; its answer
   * counts once for every node on the union of the mapped paths.
   */
  additionalLeafNodeIds?: readonly number[]
  levelId: number
  discrimination: number
  difficulty: number
  guessing: number
}

export type AdaptiveRuntimeResponse<
  TPoolItem extends AdaptiveRuntimePoolItem = AdaptiveRuntimePoolItem,
> = {
  order: number
  poolItemId: number
  correct: boolean
  poolItem: TPoolItem
}

/**
 * IRT_V1 leaf coverage reported by the engine for the decision state an
 * estimate belongs to: COVERED (>= minQuestionsPerLeaf answers), OUT_OF_RANGE
 * (no eligible item difficulty within the root's interval), SAMPLED_PENDING
 * (required, still below the minimum) or NOT_SAMPLED (not chosen by
 * subcompetence sampling).
 */
export type AdaptiveLeafCoverageStatus =
  | 'COVERED'
  | 'OUT_OF_RANGE'
  | 'SAMPLED_PENDING'
  | 'NOT_SAMPLED'

export type AdaptiveRuntimeEstimate = {
  nodeKind: 'OVERALL' | 'COMPETENCE' | 'SUBCOMPETENCE'
  nodeId: number | null
  theta: number | null
  standardError: number | null
  responseCount: number
  levelId: number | null
  stopReason: AdaptiveRuntimeStopReason | null
  /** Leaf (SUBCOMPETENCE) nodes only; absent from engines that predate it. */
  coverageStatus?: AdaptiveLeafCoverageStatus | null
}

export type AdaptiveRuntimeEstimates = {
  overall: AdaptiveRuntimeEstimate
  nodes: Map<number, AdaptiveRuntimeEstimate>
}

export type AdaptiveRuntimeDecision<
  TPoolItem extends AdaptiveRuntimePoolItem = AdaptiveRuntimePoolItem,
> = {
  nextPoolItem: TPoolItem | null
  stopReason: AdaptiveRuntimeStopReason | null
  estimates: AdaptiveRuntimeEstimates
}

/** Host publication-validation failures use the same stable application codes. */
export class AdaptiveRuntimeConfigurationError extends Error {
  readonly code: string
  constructor(message: string, code: string) {
    super(message)
    this.name = 'AdaptiveRuntimeConfigurationError'
    this.code = code
  }
}
