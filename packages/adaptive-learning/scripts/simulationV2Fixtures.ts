import {
  deriveGuessingParameter,
  type AdaptiveItemType,
  type AdaptiveRuntimeNode,
  type AdaptiveScaleDefinition,
} from '../src/index.js'
import type {
  AdaptiveV2ReleaseGate,
  AdaptiveV2ReleasePolicy,
} from './simulationV2Gates.js'
import { simulationChoiceCountFor } from './simulationV2Support.js'
import type {
  AdaptiveV2SimulationInput,
  AdaptiveV2SimulationItem,
} from './simulationV2Types.js'

export type AdaptiveV2ScenarioCategory =
  | 'MODEL_RECOVERY'
  | 'BOUNDARY'
  | 'MISSPECIFICATION'
  | 'HIERARCHY'
  | 'ITEM_TYPE'
  | 'CALIBRATION'
  | 'RESEARCH'
  | 'RETAKE'
  | 'POOL_SIZE'

export type AdaptiveV2ScenarioDefinition = {
  id: string
  category: AdaptiveV2ScenarioCategory
  shippingProfile: boolean
  parameters: Readonly<Record<string, string | number | boolean>>
}

export type AdaptiveV2ScenarioProbe = {
  id: string
  category: AdaptiveV2ScenarioCategory
  learnerCount: number
  meanBias: number | null
  rmse: number | null
  credibleCoverage: number | null
  classificationRate: number | null
  executedSuccessfully: boolean
  releaseGate: AdaptiveV2ReleaseGate | null
  note: string
}

export type AdaptiveV2ScenarioPolicy =
  AdaptiveV2SimulationInput['scenarioPolicy']

export const ADAPTIVE_V2_SIMULATION_SEED = 'adaptive-irt-v2-release-2026-07-31'

export const ADAPTIVE_V2_SCENARIO_POLICY = Object.freeze({
  modelLearnersPerTheta: 48,
  modelThetaValues: Object.freeze([-2.5, 0, 2.5]),
  difLearnersPerTheta: 384,
  cutExploratoryLearnersPerTheta: 250,
  cutSideOffset: 0.02,
  capLearnersPerLevel: 16,
  researchInclusionDraws: 10_000,
  difBootstrapReplicates: 1_000,
  difBootstrapUnit: 'LEARNER_CLUSTER_V1',
  minimumDifResidualContrast: 0.02,
}) satisfies Readonly<AdaptiveV2ScenarioPolicy>

export const ADAPTIVE_V2_RELEASE_POLICY = Object.freeze({
  version: 1,
  classificationPolicyVersion: 1,
  credibleMass: 0.9,
  candidateProbabilityThresholds: Object.freeze([0.8, 0.9, 0.95]),
  minimumProbabilityThreshold: 0.8,
  minimumSimulatedLearnersPerRequiredStratum: 1_000,
  minimumSimulatedLearnersPerThetaCell: 400,
  minimumHoldoutLearnersPerMajorStratum: 200,
  minimumHoldoutLearnersPerDifGroup: 100,
  minimumInteriorClassificationRate: 0.8,
  minimumRequiredRootClassificationRate: 0.75,
  cutNeighborhoodWidth: 0.15,
  maximumExposureRate: 0.9,
  maximumTestOverlapRate: 0.9,
  maximumSampledPairwiseFormOverlapRate: 0.9,
  maximumMedianDurationSeconds: 3_600,
  maximumP95DurationSeconds: 3_600,
}) satisfies Readonly<AdaptiveV2ReleasePolicy>

export const ADAPTIVE_V2_SCALE: AdaptiveScaleDefinition = {
  priorMean: 0,
  priorStandardDeviation: 1,
  gridMin: -6,
  gridMax: 6,
  gridStep: 0.1,
  classificationPolicyVersion: 1,
  levels: [
    level(1, 'Foundation', 0, Number.NEGATIVE_INFINITY, -1.5, -3),
    level(2, 'Independent', 1, -1.5, 1.5, 0),
    level(3, 'Advanced', 2, 1.5, Number.POSITIVE_INFINITY, 3),
  ],
}

export const ADAPTIVE_V2_SCENARIO_SET: readonly AdaptiveV2ScenarioDefinition[] =
  Object.freeze([
    scenario('canonical-depth-five-mixed', 'MODEL_RECOVERY', true, {
      roots: 2,
      rootWeightRatio: '3:2',
      hierarchyDepth: 5,
      poolItems: 60,
    }),
    scenario('cut-sides', 'BOUNDARY', false, {
      offsets: 'immediately-below-and-above-every-cut',
    }),
    scenario('cap-abstention', 'BOUNDARY', false, {
      totalQuestionCap: 4,
    }),
    scenario('pool-exhaustion-abstention', 'BOUNDARY', false, {
      itemsPerRoot: 6,
    }),
    ...[80, 85, 90, 95].map((correctPercent) =>
      scenario(
        `response-${correctPercent}-${100 - correctPercent}`,
        'MISSPECIFICATION',
        false,
        {
          correctPercent,
        }
      )
    ),
    scenario('response-deterministic-threshold', 'MISSPECIFICATION', false, {
      rule: 'correct-at-or-below-true-level',
    }),
    scenario('incorrect-provisional-b', 'MISSPECIFICATION', false, {
      difficultyShift: 0.35,
    }),
    ...[0.8, 1, 1.2, 1.5].map((trueDiscrimination) =>
      scenario(`true-a-${trueDiscrimination}`, 'MISSPECIFICATION', false, {
        trueDiscrimination,
      })
    ),
    scenario('item-drift', 'MISSPECIFICATION', false, {
      difficultyShift: 0.3,
    }),
    scenario('item-type-dif-sc', 'MISSPECIFICATION', false, {
      difItemType: 'SC',
      difficultyShift: 0.5,
    }),
    scenario('course-cohort-dif', 'MISSPECIFICATION', false, {
      cohort: 'EVEN_INDEX',
      difficultyShift: 0.5,
    }),
    scenario('adjacent-band-mislabel', 'MISSPECIFICATION', false, {
      mislabeledFraction: 0.2,
    }),
    scenario('heterogeneous-root-abilities', 'HIERARCHY', false, {
      rootThetaDelta: 0.8,
    }),
    scenario('heterogeneous-leaf-abilities', 'HIERARCHY', false, {
      leafThetaDelta: 0.6,
    }),
    scenario('all-correct', 'BOUNDARY', false, { response: 'all-correct' }),
    scenario('all-wrong', 'BOUNDARY', false, { response: 'all-wrong' }),
    scenario('guessing-only', 'BOUNDARY', false, { response: 'guessing' }),
    ...(['NUMERICAL', 'SC', 'MC', 'KPRIM', 'FREE_TEXT'] as const).map(
      (itemType) =>
        scenario(`item-type-${itemType.toLowerCase()}`, 'ITEM_TYPE', false, {
          itemType,
        })
    ),
    scenario('item-type-mixed', 'ITEM_TYPE', false, { itemType: 'MIXED' }),
    scenario('calibrated-provisional-contamination', 'CALIBRATION', false, {
      provisionalFraction: 0.2,
    }),
    scenario('research-connected-anchors', 'RESEARCH', false, {
      anchorGraph: 'connected',
    }),
    scenario('research-disconnected-anchors', 'RESEARCH', false, {
      anchorGraph: 'disconnected',
    }),
    scenario('research-known-inclusion-probability', 'RESEARCH', false, {
      fieldTestProbability: 0.3,
    }),
    scenario('retake-cooldown', 'RETAKE', false, { cooldown: true }),
    scenario('retake-latest-result', 'RETAKE', false, {
      resultSelection: 'latest-completed',
    }),
    scenario('retake-overlap-control', 'RETAKE', false, {
      priorAttemptExclusion: true,
    }),
    scenario('first-exposure-calibration', 'RETAKE', false, {
      calibrationFilter: 'first-exposure-only',
    }),
    scenario('pool-sparse', 'POOL_SIZE', false, { itemsPerRoot: 12 }),
    scenario('pool-target', 'POOL_SIZE', false, { itemsPerRoot: 30 }),
    scenario('pool-rich', 'POOL_SIZE', false, { itemsPerRoot: 60 }),
  ])

export function buildDepthFiveNodes(): AdaptiveRuntimeNode[] {
  return [
    ...depthFiveChain({ firstId: 1, rootOrder: 0, rootWeight: 3 }),
    ...depthFiveChain({ firstId: 6, rootOrder: 1, rootWeight: 2 }),
  ]
}

export function buildMixedPool(): AdaptiveV2SimulationItem[] {
  const itemTypes: AdaptiveItemType[] = [
    'NUMERICAL',
    'SC',
    'MC',
    'KPRIM',
    'FREE_TEXT',
  ]
  let itemId = 1
  return [
    { rootId: 1, leafId: 5, path: [1, 2, 3, 4, 5] },
    { rootId: 6, leafId: 10, path: [6, 7, 8, 9, 10] },
  ].flatMap(({ rootId, leafId, path }) =>
    ADAPTIVE_V2_SCALE.levels.flatMap((levelDefinition) =>
      itemTypes.flatMap((itemType) =>
        Array.from({ length: 2 }, () => {
          const choiceCount = simulationChoiceCountFor(itemType)
          const guessing = deriveGuessingParameter({
            type: itemType,
            choiceCount,
          })
          const id = itemId++
          return {
            id,
            leafNodeId: leafId,
            nodePath: [...path],
            levelId: levelDefinition.id,
            itemType,
            choiceCount,
            model:
              itemType === 'NUMERICAL' || itemType === 'FREE_TEXT'
                ? ('TWO_PL' as const)
                : ('THREE_PL_FIXED_C' as const),
            calibrationId: `simulation-calibration-${rootId}-${id}`,
            contributesToEstimate: true,
            role: 'SCORING' as const,
            discrimination: 1.2,
            difficulty: levelDefinition.itemDifficultyPrior,
            guessing,
            trueDiscrimination: 1.2,
            trueDifficulty: levelDefinition.itemDifficultyPrior,
            trueGuessing: guessing,
          }
        })
      )
    )
  )
}

export function cloneScale(
  scale: AdaptiveScaleDefinition
): AdaptiveScaleDefinition {
  return {
    ...scale,
    levels: scale.levels.map((levelDefinition) => ({ ...levelDefinition })),
  }
}

export function probeSeed(id: string, offset: number) {
  let hash = 2_166_136_261
  for (const character of id) {
    hash ^= character.charCodeAt(0)
    hash = Math.imul(hash, 16_777_619)
  }
  return (hash + offset) >>> 0
}

function depthFiveChain({
  firstId,
  rootOrder,
  rootWeight,
}: {
  firstId: number
  rootOrder: number
  rootWeight: number
}) {
  return Array.from({ length: 5 }, (_, index) => ({
    id: firstId + index,
    parentId: index === 0 ? null : firstId + index - 1,
    kind: index === 0 ? ('COMPETENCE' as const) : ('SUBCOMPETENCE' as const),
    depth: index + 1,
    order: index === 0 ? rootOrder : 0,
    enabled: true,
    weight: index === 0 ? rootWeight : null,
    questionCap: null,
  }))
}

function level(
  id: number,
  label: string,
  order: number,
  lowerBound: number,
  upperBound: number,
  itemDifficultyPrior: number
) {
  return { id, label, order, lowerBound, upperBound, itemDifficultyPrior }
}

function scenario(
  id: string,
  category: AdaptiveV2ScenarioCategory,
  shippingProfile: boolean,
  parameters: Record<string, string | number | boolean>
): AdaptiveV2ScenarioDefinition {
  return {
    id,
    category,
    shippingProfile,
    parameters: Object.freeze(parameters),
  }
}
