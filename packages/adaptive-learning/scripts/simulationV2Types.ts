import type {
  AdaptiveItemType,
  AdaptivePosterior,
  AdaptiveRuntimeNode,
  AdaptiveRuntimeStopReason,
  AdaptiveScaleDefinition,
  AdaptiveV2PoolItem,
  classifyPosterior,
} from '../src/index.js'
import type {
  AdaptiveV2ReleaseGate,
  AdaptiveV2ReleasePolicy,
  AdaptiveV2SimulationMetrics,
} from './simulationV2Gates.js'

export type AdaptiveV2SimulationItem = AdaptiveV2PoolItem & {
  trueDiscrimination: number
  trueDifficulty: number
  trueGuessing: number
}

export type AdaptiveV2SimulationInput = {
  label: string
  evidenceProfile: 'CONTRACT' | 'RELEASE'
  estimatorVersion: 'IRT_V2_EAP_GRID_1'
  seed: string
  scale: AdaptiveScaleDefinition
  nodes: AdaptiveRuntimeNode[]
  pool: AdaptiveV2SimulationItem[]
  rootWeights: Array<{ rootId: number; weight: number }>
  policy: AdaptiveV2ReleasePolicy
  learnersPerBand: number
  itemsPerAttempt: number
  courseCohorts: readonly string[]
  retainedTraceLimit: number
  scenarioSet: readonly unknown[]
  scenarioPolicy: {
    modelLearnersPerTheta: number
    modelThetaValues: readonly number[]
    difLearnersPerTheta: number
    cutExploratoryLearnersPerTheta: number
    cutSideOffset: number
    capLearnersPerLevel: number
    researchInclusionDraws: number
    difBootstrapReplicates: number
    difBootstrapUnit: 'LEARNER_CLUSTER_V1'
    minimumDifResidualContrast: number
  }
  runtimeSettings: {
    perLeafQuestionCap: number | null
    minQuestionsPerLeaf: number
    classificationZ: number
    topInformationRatio: number
    levelMappingRule: 'NEAREST'
    thetaRange: { min: number; max: number }
    mode: 'DIAGNOSTIC'
    minimumRootResponses: number
  }
  simulationSettings: {
    bootstrapReplicates: number
    wilsonZ: number
    nearCutLearnersPerBand: number
    cutSideOffset: number
    interiorThetaJitter: number
    interiorThetaCells: Array<{
      levelId: number
      values: number[]
    }>
    itemTypeLearnersPerType: number
    retakeLearnersPerThreshold: number
    pairwiseFormSampleSize: number
    secondsPerItem: number
    overlapDefinitionVersion: string
    retakeSamplingVersion: 'STRATIFIED_BAND_CUT_COHORT_V1'
  }
  scenarioReleaseGates: Array<
    AdaptiveV2ReleaseGate & { probabilityThreshold: number }
  >
}

export type AdaptiveV2SimulationTrace = {
  learnerId: string
  trueTheta: number
  trueLevelId: number
  courseCohort: string
  cutDistance: 'NEAR_CUT' | 'INTERIOR'
  thetaCellKey: string | null
  selectedItemIds: number[]
  responseBits: string
  posteriorMean: number
  credibleLower: number
  credibleUpper: number
  resultStatus: string
  stopReason: AdaptiveRuntimeStopReason
}

export type AdaptiveV2SimulationReport = {
  schemaVersion: 1
  evidenceProfile: 'CONTRACT' | 'RELEASE'
  inputFingerprint: string
  estimatorVersion: 'IRT_V2_EAP_GRID_1'
  policyVersion: number
  seed: string
  thresholdResults: Array<{
    probabilityThreshold: number
    metrics: AdaptiveV2SimulationMetrics
    gates: AdaptiveV2ReleaseGate[]
    passed: boolean
  }>
  approvedProbabilityThreshold: number | null
  passed: boolean
  retainedTraces: AdaptiveV2SimulationTrace[]
}

export type RootOutcome = {
  rootId: number
  trueTheta: number
  trueLevelId: number
  posterior: AdaptivePosterior
  observation: ClassifiedObservation
}

export type LearnerEvidence = {
  learnerId: string
  trueTheta: number
  trueLevelId: number
  courseCohort: string
  cutDistance: 'NEAR_CUT' | 'INTERIOR'
  thetaCellKey: string | null
  selectedItemIds: number[]
  selectedItemTypes: Set<AdaptiveItemType>
  responseBits: string
  posterior: AdaptivePosterior
  roots: RootOutcome[]
  observation: ClassifiedObservation
}

export type ClassifiedObservation = {
  trueTheta: number
  trueLevelId: number
  estimatedTheta: number
  credibleLower: number
  credibleUpper: number
  classifiedLevelId: number | null
  resultStatus: ReturnType<typeof classifyPosterior>['status']
  requiredRootsClassified: boolean
  forcedClassification: boolean
  unexpectedFallback: boolean
  questionCount: number
  stopReason: string
  cutDistance: 'NEAR_CUT' | 'INTERIOR'
}
