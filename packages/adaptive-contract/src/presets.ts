import {
  DEFAULT_DISCRIMINATION,
  DEFAULT_TOP_INFORMATION_RATIO,
} from './core.js'

export const ADAPTIVE_SECONDS_PER_ITEM = 60
export const ADAPTIVE_PLANNING_BUDGET_MINUTES = 30
export const MIN_PRODUCT_ITEMS_PER_COVERAGE_CELL = 5

export type AdaptivePresetName = 'PLACEMENT' | 'DIAGNOSTIC' | 'RESEARCH'
export type AdaptiveAttemptSelectionPolicyName =
  | 'FIRST_COMPLETED'
  | 'LATEST_COMPLETED'

export type AdaptivePresetDefaults = {
  totalQuestionCap: number
  perLeafQuestionCap: number | null
  minQuestionsPerLeaf: number
  classificationZ: number
  topInformationRatio: number
  defaultDiscrimination: number
  levelMappingRule: 'NEAREST' | 'MASTERY'
  attemptSelectionPolicy: AdaptiveAttemptSelectionPolicyName
  showTimer: boolean
}

const SHARED_PRESET_DEFAULTS = {
  totalQuestionCap: 50,
  perLeafQuestionCap: null,
  minQuestionsPerLeaf: 2,
  classificationZ: 1.28,
  topInformationRatio: DEFAULT_TOP_INFORMATION_RATIO,
  defaultDiscrimination: DEFAULT_DISCRIMINATION,
  showTimer: true,
} as const

export const ADAPTIVE_PRESET_DEFAULTS = {
  PLACEMENT: {
    ...SHARED_PRESET_DEFAULTS,
    levelMappingRule: 'MASTERY',
    attemptSelectionPolicy: 'FIRST_COMPLETED',
  },
  DIAGNOSTIC: {
    ...SHARED_PRESET_DEFAULTS,
    levelMappingRule: 'NEAREST',
    attemptSelectionPolicy: 'LATEST_COMPLETED',
  },
  RESEARCH: {
    ...SHARED_PRESET_DEFAULTS,
    levelMappingRule: 'NEAREST',
    attemptSelectionPolicy: 'LATEST_COMPLETED',
  },
} as const satisfies Record<AdaptivePresetName, AdaptivePresetDefaults>

export function getAdaptivePresetDefaults(
  preset: AdaptivePresetName,
  options?: { treeDefaultDiscrimination?: number }
): AdaptivePresetDefaults {
  const defaults = ADAPTIVE_PRESET_DEFAULTS[preset]
  return {
    ...defaults,
    defaultDiscrimination:
      preset === 'RESEARCH' &&
      typeof options?.treeDefaultDiscrimination === 'number'
        ? options.treeDefaultDiscrimination
        : defaults.defaultDiscrimination,
  }
}

export function isAdaptiveProductPreset(preset: AdaptivePresetName) {
  return preset === 'PLACEMENT' || preset === 'DIAGNOSTIC'
}
