import {
  DEFAULT_DISCRIMINATION,
  DEFAULT_TOP_INFORMATION_RATIO,
} from './core.js'

export const ADAPTIVE_SECONDS_PER_ITEM = 60
export const ADAPTIVE_PLANNING_BUDGET_MINUTES = 30
// Recommended (and default) number of enabled elements per enabled
// subcompetence × level coverage cell for product presets. Authors may lower
// the per-quiz minimum down to MIN_CONFIGURABLE_ITEMS_PER_COVERAGE_CELL for
// fine-grained trees; readiness then reports an advisory warning.
export const MIN_PRODUCT_ITEMS_PER_COVERAGE_CELL = 5
export const MIN_CONFIGURABLE_ITEMS_PER_COVERAGE_CELL = 1
export const MAX_CONFIGURABLE_ITEMS_PER_COVERAGE_CELL =
  MIN_PRODUCT_ITEMS_PER_COVERAGE_CELL

// IRT_V1 classification tolerance (Catalyst routing SEQUENTIAL_ROOTS_V6): a
// node is classified when its interval lies within the bands k−t … k+t
// around the band k containing θ. 0 is the exact (previous) rule; the engine
// accepts up to 5, the authoring UI offers 0–2. Values above 0 require an
// engine with SEQUENTIAL_ROOTS_V6 and are only sent when above 0.
export const ADAPTIVE_DEFAULT_CLASSIFICATION_TOLERANCE_BANDS = 0
export const ADAPTIVE_MAX_CLASSIFICATION_TOLERANCE_BANDS = 5
export const ADAPTIVE_CLASSIFICATION_TOLERANCE_OPTIONS = [0, 1, 2] as const
// Scales with at least this many levels are recommended to use ±1.
export const ADAPTIVE_TOLERANCE_RECOMMENDED_MIN_LEVELS = 10

export function isValidAdaptiveClassificationToleranceBands(value: number) {
  return (
    Number.isInteger(value) &&
    value >= 0 &&
    value <= ADAPTIVE_MAX_CLASSIFICATION_TOLERANCE_BANDS
  )
}

export type AdaptivePresetName = 'PLACEMENT' | 'DIAGNOSTIC' | 'RESEARCH'
export type AdaptiveAttemptSelectionPolicyName =
  | 'FIRST_COMPLETED'
  | 'LATEST_COMPLETED'

export type AdaptivePresetDefaults = {
  totalQuestionCap: number
  perLeafQuestionCap: number | null
  minQuestionsPerLeaf: number
  minItemsPerCoverageCell: number
  classificationZ: number
  classificationToleranceBands: number
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
  minItemsPerCoverageCell: MIN_PRODUCT_ITEMS_PER_COVERAGE_CELL,
  classificationZ: 1.28,
  classificationToleranceBands: ADAPTIVE_DEFAULT_CLASSIFICATION_TOLERANCE_BANDS,
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
