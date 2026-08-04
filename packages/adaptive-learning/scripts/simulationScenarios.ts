import {
  type AdaptivePresetName,
  getAdaptivePresetDefaults,
  SUPPORTED_ADAPTIVE_ITEM_TYPES,
} from '../src/index.js'
import type { AdaptiveSimulationConfig } from '../test/simulationHarness.js'

export type SimulationScenarioCategory =
  | 'CANONICAL_PRODUCT'
  | 'STRESS_OVERLAY'
  | 'DISCRIMINATION_SWEEP'
  | 'DIFFICULTY_SHIFT_SWEEP'
  | 'ITEM_TYPE_SWEEP'
  | 'POOL_SIZE_SWEEP'

export type SimulationPoolProfile = 'SPARSE' | 'TARGET' | 'RICH'

export type AdaptiveSimulationScenario = {
  category: SimulationScenarioCategory
  poolProfile: SimulationPoolProfile
  canonicalProductProfile: boolean
  config: AdaptiveSimulationConfig
}

export const SIMULATION_SEED = 11_021
export const CANONICAL_LEARNERS_PER_LEVEL = 50
export const STRESS_LEARNERS_PER_LEVEL = 12

const BASE_SHAPE = {
  rootCount: 2,
  leavesPerRoot: 2,
  itemsPerLevel: 5,
  learnersPerLevel: CANONICAL_LEARNERS_PER_LEVEL,
  itemMix: 'MIXED',
  trueDiscrimination: 1.2,
  adjacentLevelShiftProbability: 0,
  seed: SIMULATION_SEED,
} as const satisfies Pick<
  AdaptiveSimulationConfig,
  | 'rootCount'
  | 'leavesPerRoot'
  | 'itemsPerLevel'
  | 'learnersPerLevel'
  | 'itemMix'
  | 'trueDiscrimination'
  | 'adjacentLevelShiftProbability'
  | 'seed'
>

export const CANONICAL_PRODUCT_SCENARIOS: AdaptiveSimulationScenario[] = [
  canonicalScenario('PLACEMENT', 'TARGET', 5),
  canonicalScenario('PLACEMENT', 'RICH', 10),
  canonicalScenario('DIAGNOSTIC', 'TARGET', 5),
  canonicalScenario('DIAGNOSTIC', 'RICH', 10),
]

export const STRESS_OVERLAY_SCENARIOS: AdaptiveSimulationScenario[] = [
  scenario({
    category: 'STRESS_OVERLAY',
    poolProfile: 'TARGET',
    config: presetConfig('DIAGNOSTIC', 'stress-overlay-short-form', {
      totalQuestionCap: 36,
      learnersPerLevel: STRESS_LEARNERS_PER_LEVEL,
    }),
  }),
  scenario({
    category: 'STRESS_OVERLAY',
    poolProfile: 'RICH',
    config: presetConfig('DIAGNOSTIC', 'stress-overlay-long-form', {
      itemsPerLevel: 10,
      totalQuestionCap: 90,
      learnersPerLevel: STRESS_LEARNERS_PER_LEVEL,
    }),
  }),
]

export const DISCRIMINATION_SWEEP_SCENARIOS = [0.8, 1, 1.2, 1.5].map(
  (trueDiscrimination) =>
    scenario({
      category: 'DISCRIMINATION_SWEEP',
      poolProfile: 'TARGET',
      config: presetConfig(
        'DIAGNOSTIC',
        `stress-discrimination-configured-1.2-true-${trueDiscrimination.toFixed(1)}`,
        {
          trueDiscrimination,
          learnersPerLevel: STRESS_LEARNERS_PER_LEVEL,
        }
      ),
    })
)

export const DIFFICULTY_SHIFT_SWEEP_SCENARIOS = [0, 0.1, 0.2].map(
  (adjacentLevelShiftProbability) =>
    scenario({
      category: 'DIFFICULTY_SHIFT_SWEEP',
      poolProfile: 'TARGET',
      config: presetConfig(
        'DIAGNOSTIC',
        `stress-difficulty-adjacent-shift-${Math.round(
          adjacentLevelShiftProbability * 100
        )}-percent`,
        {
          adjacentLevelShiftProbability,
          learnersPerLevel: STRESS_LEARNERS_PER_LEVEL,
        }
      ),
    })
)

export const ITEM_TYPE_SWEEP_SCENARIOS = SUPPORTED_ADAPTIVE_ITEM_TYPES.map(
  (itemMix) =>
    scenario({
      category: 'ITEM_TYPE_SWEEP',
      poolProfile: 'TARGET',
      config: presetConfig(
        'DIAGNOSTIC',
        `stress-item-type-${itemMix.toLowerCase().replace('_', '-')}`,
        {
          itemMix,
          learnersPerLevel: STRESS_LEARNERS_PER_LEVEL,
        }
      ),
    })
)

export const POOL_SIZE_SWEEP_SCENARIOS: AdaptiveSimulationScenario[] = [
  poolSizeScenario('SPARSE', 1),
  poolSizeScenario('TARGET', 5),
  poolSizeScenario('RICH', 10),
]

export const SIMULATION_REPORT_SCENARIOS = [
  ...CANONICAL_PRODUCT_SCENARIOS,
  ...STRESS_OVERLAY_SCENARIOS,
  ...DISCRIMINATION_SWEEP_SCENARIOS,
  ...DIFFICULTY_SHIFT_SWEEP_SCENARIOS,
  ...ITEM_TYPE_SWEEP_SCENARIOS,
  ...POOL_SIZE_SWEEP_SCENARIOS,
]

function canonicalScenario(
  preset: 'PLACEMENT' | 'DIAGNOSTIC',
  poolProfile: 'TARGET' | 'RICH',
  itemsPerLevel: number
): AdaptiveSimulationScenario {
  return scenario({
    category: 'CANONICAL_PRODUCT',
    poolProfile,
    canonicalProductProfile: true,
    config: presetConfig(
      preset,
      `canonical-${preset.toLowerCase()}-${poolProfile.toLowerCase()}`,
      { itemsPerLevel }
    ),
  })
}

function poolSizeScenario(
  poolProfile: 'SPARSE' | 'TARGET' | 'RICH',
  itemsPerLevel: number
) {
  return scenario({
    category: 'POOL_SIZE_SWEEP',
    poolProfile,
    config: presetConfig(
      'DIAGNOSTIC',
      `stress-pool-${poolProfile.toLowerCase()}`,
      {
        itemsPerLevel,
        learnersPerLevel: STRESS_LEARNERS_PER_LEVEL,
      }
    ),
  })
}

function scenario({
  category,
  poolProfile,
  canonicalProductProfile = false,
  config,
}: Omit<AdaptiveSimulationScenario, 'canonicalProductProfile'> & {
  canonicalProductProfile?: boolean
}): AdaptiveSimulationScenario {
  return {
    category,
    poolProfile,
    canonicalProductProfile,
    config,
  }
}

function presetConfig(
  preset: AdaptivePresetName,
  label: string,
  overrides: Partial<AdaptiveSimulationConfig> = {}
): AdaptiveSimulationConfig {
  const defaults = getAdaptivePresetDefaults(preset)
  return {
    ...BASE_SHAPE,
    label,
    preset,
    totalQuestionCap: defaults.totalQuestionCap,
    perLeafQuestionCap: defaults.perLeafQuestionCap,
    minQuestionsPerLeaf: defaults.minQuestionsPerLeaf,
    classificationZ: defaults.classificationZ,
    topInformationRatio: defaults.topInformationRatio,
    configuredDiscrimination: defaults.defaultDiscrimination,
    trueDiscrimination: defaults.defaultDiscrimination,
    mappingRule: defaults.levelMappingRule,
    ...overrides,
  }
}
