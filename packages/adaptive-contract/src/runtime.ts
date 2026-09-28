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

export type AdaptiveRuntimeEstimate = {
  nodeKind: 'OVERALL' | 'COMPETENCE' | 'SUBCOMPETENCE'
  nodeId: number | null
  theta: number | null
  standardError: number | null
  responseCount: number
  levelId: number | null
  stopReason: AdaptiveRuntimeStopReason | null
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
