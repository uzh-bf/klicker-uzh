import type { AdaptivePresetName } from '@klicker-uzh/adaptive-contract'

export type AdaptiveConfiguredNode = {
  id: number
  parentId: number | null
  kind: 'COMPETENCE' | 'SUBCOMPETENCE'
  name: string
  depth: number
  enabled: boolean
  weight: number | null
  questionCap: number | null
}

export type AdaptiveConfiguredCoverage = {
  id: number
  leafNodeId: number
  levelId: number
  targetItemCount: number
  enabled: boolean
}

export type AdaptiveConfiguredLevel = {
  id: number
  theta: number
  lowerBound: number
  upperBound: number
}

export type AdaptiveConfiguredAssignment = {
  id: number
  elementId: number
  elementName: string
  elementType: string
  leafNodeId: number
  additionalLeafNodeIds?: number[]
  levelId: number
  enabled: boolean
  available: boolean
  availabilityReason?: 'DELETED' | 'OWNER_ACCESS_REVOKED' | null
  discrimination: number
  difficulty: number
  guessing: number
  controlledAnswerReady: boolean
}

export type AdaptiveConfiguredSettings = {
  preset: AdaptivePresetName
  rootBalancedPlacement?: boolean
  /**
   * Diagnostic subcompetence (matrix) sampling: a total cap below the
   * all-leaf minimum evidence is advisory as long as every root can receive
   * at least one leaf block. Requires the engine's sampled V1 routing.
   */
  subcompetenceSampling?: boolean
  totalQuestionCap: number
  perLeafQuestionCap: number | null
  minQuestionsPerLeaf: number
  /**
   * Minimum enabled elements per enabled leaf × level coverage cell for
   * product presets. Defaults to MIN_PRODUCT_ITEMS_PER_COVERAGE_CELL.
   */
  minItemsPerCoverageCell?: number
  classificationZ: number
  /** IRT_V1 classification tolerance in level bands (0 = exact level). */
  classificationToleranceBands?: number
  topInformationRatio: number
  defaultDiscrimination: number
}

export type AdaptiveReadinessIssue = {
  code: string
  message: string
  parameters: AdaptiveReadinessIssueParameters
  path?: string
  nodeId?: number
  leafNodeId?: number
  levelId?: number
  assignmentId?: number
}

export type AdaptiveReadinessIssueParameters = {
  nodeName?: string
  elementName?: string
  field?: string
  minimumValue?: number
  maximumValue?: number
  targetItemCount?: number
  enabledAssignmentCount?: number
  requiredQuestionCount?: number
  availableItemCount?: number
  effectiveQuestionCap?: number
  totalQuestionCap?: number
  classifiableLevelCount?: number
  levelCount?: number
  estimatedDurationMinutes?: number
  secondsPerItem?: number
  assignmentId?: number
  nodeId?: number
  scaleVersionId?: string
  calibrationStatus?: string
  elementVersion?: number
  rootName?: string
  leafName?: string
  leafOrder?: number
  levelLabel?: string
  levelOrder?: number
  allocatedQuestionCount?: number
  leafCount?: number
  coveredLeafCount?: number
  questionsPerLeaf?: number
}

export type AdaptiveCoverageReadiness = {
  coverageId: number
  leafNodeId: number
  levelId: number
  targetItemCount: number
  enabledAssignmentCount: number
  ready: boolean
}
