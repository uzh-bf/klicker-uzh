import { ADAPTIVE_PRESET_DEFAULTS } from '../src/presets.js'
import {
  ADAPTIVE_V2_RELEASE_POLICY,
  ADAPTIVE_V2_SCALE,
  ADAPTIVE_V2_SCENARIO_POLICY,
  ADAPTIVE_V2_SCENARIO_SET,
  ADAPTIVE_V2_SIMULATION_SEED,
  buildDepthFiveNodes,
  buildMixedPool,
  cloneScale,
  type AdaptiveV2ScenarioPolicy,
  type AdaptiveV2ScenarioProbe,
} from './simulationV2Fixtures.js'
import {
  productionAbstentionGates,
  researchProbe,
  retakeProbe,
} from './simulationV2InfrastructureProbes.js'
import { hierarchyProbe, modelProbe } from './simulationV2ModelProbes.js'
import type { AdaptiveV2SimulationInput } from './simulationV2Types.js'

export {
  ADAPTIVE_V2_RELEASE_POLICY,
  ADAPTIVE_V2_SCALE,
  ADAPTIVE_V2_SCENARIO_POLICY,
  ADAPTIVE_V2_SCENARIO_SET,
  ADAPTIVE_V2_SIMULATION_SEED,
} from './simulationV2Fixtures.js'
export type {
  AdaptiveV2ScenarioCategory,
  AdaptiveV2ScenarioDefinition,
  AdaptiveV2ScenarioPolicy,
  AdaptiveV2ScenarioProbe,
} from './simulationV2Fixtures.js'

export function buildAdaptiveV2ReleaseInput({
  includeScenarioGates = true,
}: { includeScenarioGates?: boolean } = {}): AdaptiveV2SimulationInput {
  const nodes = buildDepthFiveNodes()
  const pool = buildMixedPool()
  const scenarioPolicy = {
    ...ADAPTIVE_V2_SCENARIO_POLICY,
    modelThetaValues: [...ADAPTIVE_V2_SCENARIO_POLICY.modelThetaValues],
  }
  const diagnosticDefaults = ADAPTIVE_PRESET_DEFAULTS.DIAGNOSTIC
  return {
    label: 'IRT v2 canonical depth-five model recovery',
    evidenceProfile: 'RELEASE',
    estimatorVersion: 'IRT_V2_EAP_GRID_1',
    seed: ADAPTIVE_V2_SIMULATION_SEED,
    scale: cloneScale(ADAPTIVE_V2_SCALE),
    nodes,
    pool,
    rootWeights: [
      { rootId: 1, weight: 3 },
      { rootId: 6, weight: 2 },
    ],
    policy: {
      ...ADAPTIVE_V2_RELEASE_POLICY,
      candidateProbabilityThresholds: [
        ...ADAPTIVE_V2_RELEASE_POLICY.candidateProbabilityThresholds,
      ],
    },
    learnersPerBand: 2_334,
    itemsPerAttempt: diagnosticDefaults.totalQuestionCap,
    courseCohorts: ['COHORT_A', 'COHORT_B', 'COHORT_C'],
    retainedTraceLimit: 24,
    scenarioSet: ADAPTIVE_V2_SCENARIO_SET.map((definition) => ({
      ...definition,
      parameters: { ...definition.parameters },
    })),
    scenarioPolicy,
    runtimeSettings: {
      perLeafQuestionCap: diagnosticDefaults.perLeafQuestionCap,
      minQuestionsPerLeaf: diagnosticDefaults.minQuestionsPerLeaf,
      classificationZ: diagnosticDefaults.classificationZ,
      topInformationRatio: diagnosticDefaults.topInformationRatio,
      levelMappingRule: diagnosticDefaults.levelMappingRule,
      thetaRange: { min: -3, max: 3 },
      mode: 'DIAGNOSTIC',
      minimumRootResponses: diagnosticDefaults.minQuestionsPerLeaf,
    },
    simulationSettings: {
      bootstrapReplicates: 1_000,
      wilsonZ: 1.959963984540054,
      nearCutLearnersPerBand: 334,
      cutSideOffset: 0.02,
      interiorThetaJitter: 0.02,
      interiorThetaCells: [
        { levelId: 1, values: [-2.9, -2.6, -2.3, -2, -1.7] },
        { levelId: 2, values: [-1.2, -0.6, 0, 0.6, 1.2] },
        { levelId: 3, values: [1.7, 2, 2.3, 2.6, 2.9] },
      ],
      itemTypeLearnersPerType: 1_000,
      retakeLearnersPerThreshold: 64,
      pairwiseFormSampleSize: 128,
      secondsPerItem: 60,
      overlapDefinitionVersion: 'RETAKE_RIGHT_AND_PAIRWISE_SHORTER_V1',
      retakeSamplingVersion: 'STRATIFIED_BAND_CUT_COHORT_V1',
    },
    scenarioReleaseGates: includeScenarioGates
      ? buildAdaptiveV2ScenarioReleaseGates(scenarioPolicy)
      : [],
  }
}

export function buildAdaptiveV2ContractInput(): AdaptiveV2SimulationInput {
  const input = buildAdaptiveV2ReleaseInput({ includeScenarioGates: false })
  return {
    ...input,
    label: 'IRT v2 compact production-loop contract',
    evidenceProfile: 'CONTRACT',
    policy: {
      ...input.policy,
      candidateProbabilityThresholds: [
        ...input.policy.candidateProbabilityThresholds,
      ],
      minimumSimulatedLearnersPerRequiredStratum: 8,
      minimumSimulatedLearnersPerThetaCell: 1,
    },
    learnersPerBand: 12,
    simulationSettings: {
      ...input.simulationSettings,
      bootstrapReplicates: 100,
      nearCutLearnersPerBand: 4,
      itemTypeLearnersPerType: 8,
      retakeLearnersPerThreshold: 4,
      pairwiseFormSampleSize: 8,
    },
    scenarioReleaseGates: [],
  }
}

export function runAdaptiveV2ScenarioProbes(
  probabilityThreshold = 0.8,
  scenarioPolicy: AdaptiveV2ScenarioPolicy = ADAPTIVE_V2_SCENARIO_POLICY
): AdaptiveV2ScenarioProbe[] {
  return ADAPTIVE_V2_SCENARIO_SET.map((definition) => {
    if (definition.category === 'RESEARCH') {
      return researchProbe(definition, scenarioPolicy)
    }
    if (definition.category === 'RETAKE') {
      return retakeProbe(definition)
    }
    if (
      definition.id === 'heterogeneous-root-abilities' ||
      definition.id === 'heterogeneous-leaf-abilities'
    ) {
      return hierarchyProbe(definition, scenarioPolicy)
    }
    return modelProbe(definition, probabilityThreshold, scenarioPolicy)
  })
}

export function buildAdaptiveV2ScenarioReleaseGates(
  scenarioPolicy: AdaptiveV2ScenarioPolicy = ADAPTIVE_V2_SCENARIO_POLICY
) {
  const difGates = ['item-type-dif-sc', 'course-cohort-dif'].map((id) => {
    const definition = ADAPTIVE_V2_SCENARIO_SET.find(
      (candidate) => candidate.id === id
    )!
    return modelProbe(
      definition,
      ADAPTIVE_V2_RELEASE_POLICY.minimumProbabilityThreshold,
      scenarioPolicy
    ).releaseGate!
  })
  return ADAPTIVE_V2_RELEASE_POLICY.candidateProbabilityThresholds.flatMap(
    (probabilityThreshold) => [
      ...difGates.map((gate) => ({ probabilityThreshold, ...gate })),
      ...productionAbstentionGates(
        probabilityThreshold,
        'TOTAL_CAP',
        scenarioPolicy
      ),
      ...productionAbstentionGates(
        probabilityThreshold,
        'POOL_EXHAUSTION',
        scenarioPolicy
      ),
    ]
  )
}
