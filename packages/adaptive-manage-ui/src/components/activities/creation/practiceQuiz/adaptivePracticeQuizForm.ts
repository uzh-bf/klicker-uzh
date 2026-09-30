import {
  type AdaptivePresetName,
  getAdaptivePresetDefaults,
} from '@klicker-uzh/adaptive-contract'
import {
  AdaptiveAttemptSelectionPolicy,
  AdaptiveLevelMappingRule,
  type AdaptivePracticeQuizConfigInput,
  AdaptivePracticeQuizPreset,
  PracticeQuizMode,
  type QAdaptivePracticeQuizPreviewWithRuntimeLimitsQuery,
} from '@klicker-uzh/graphql/dist/ops'
import type {
  AdaptivePracticeQuizConfigFormValues,
  PracticeQuizFormValues,
} from '../../../../types/practiceQuiz'

export const ADAPTIVE_MAX_QUESTION_CAP = 1000
export const ADAPTIVE_MAX_CLASSIFICATION_Z = 5
export const ADAPTIVE_MAX_DISCRIMINATION = 10
export const PLACEMENT_PILOT_MIN_QUESTIONS_PER_LEAF = 4

// The calibrated IRT v2 track (competence scales and the scale-based placement
// pilot) is not offered to authors. Without a scale every quiz runs on IRT v1.
// Existing v2 configurations keep their scale; flip this to show the v2
// authoring UI again.
export const ADAPTIVE_V2_AUTHORING_ENABLED = false

// Presets offered in the authoring UI. The current preset stays listed so an
// existing quiz still shows what it was created with.
export function getAuthorableAdaptivePresets(
  currentPreset: AdaptivePracticeQuizPreset
): AdaptivePracticeQuizPreset[] {
  const presets = [
    AdaptivePracticeQuizPreset.Diagnostic,
    AdaptivePracticeQuizPreset.Research,
    ...(ADAPTIVE_V2_AUTHORING_ENABLED
      ? [AdaptivePracticeQuizPreset.Placement]
      : []),
  ]
  return presets.includes(currentPreset) ? presets : [...presets, currentPreset]
}

export function createAdaptivePracticeQuizDefaultConfig(): AdaptivePracticeQuizConfigFormValues {
  const defaults = getAdaptivePresetDefaults('DIAGNOSTIC')

  return {
    competenceTreeId: undefined,
    scaleVersionId: undefined,
    preset: AdaptivePracticeQuizPreset.Diagnostic,
    totalQuestionCap: String(defaults.totalQuestionCap),
    timeLimitMinutes: '',
    perLeafQuestionCap: nullableNumberToString(defaults.perLeafQuestionCap),
    minQuestionsPerLeaf: String(defaults.minQuestionsPerLeaf),
    classificationZ: String(defaults.classificationZ),
    showTimer: defaults.showTimer,
    attemptSelectionPolicy: toAttemptSelectionPolicy(
      defaults.attemptSelectionPolicy
    ),
    levelMappingRule: toLevelMappingRule(defaults.levelMappingRule),
    topInformationRatio: String(defaults.topInformationRatio),
    defaultDiscrimination: '',
    nodeOverrides: [],
    elementOverrides: [],
  }
}

export function createEmptyPracticeQuizStack() {
  return {
    displayName: '',
    description: '',
    elements: [],
  }
}

export function hasStandardPracticeQuizContent(
  values: PracticeQuizFormValues
): boolean {
  return values.stacks.some(
    (stack) =>
      stack.elements.length > 0 ||
      Boolean(stack.displayName?.trim()) ||
      Boolean(stack.description?.trim())
  )
}

export function hasAdaptivePracticeQuizConfiguration(
  values: PracticeQuizFormValues
): boolean {
  return (
    JSON.stringify(values.adaptiveConfig) !==
    JSON.stringify(createAdaptivePracticeQuizDefaultConfig())
  )
}

export function switchPracticeQuizMode(
  values: PracticeQuizFormValues,
  mode: PracticeQuizMode
): PracticeQuizFormValues {
  if (mode === PracticeQuizMode.Adaptive) {
    return {
      ...values,
      mode,
      stacks: [],
      adaptiveConfig: createAdaptivePracticeQuizDefaultConfig(),
    }
  }

  return {
    ...values,
    mode,
    stacks: [createEmptyPracticeQuizStack()],
    adaptiveConfig: createAdaptivePracticeQuizDefaultConfig(),
  }
}

export function serializeAdaptivePracticeQuizConfig(
  config: AdaptivePracticeQuizConfigFormValues
): AdaptivePracticeQuizConfigInput | undefined {
  if (!config.competenceTreeId) return undefined
  const defaults = getAdaptivePresetDefaults(
    config.preset as AdaptivePresetName
  )

  const researchSettings =
    config.preset === AdaptivePracticeQuizPreset.Research
      ? {
          attemptSelectionPolicy: config.scaleVersionId
            ? AdaptiveAttemptSelectionPolicy.LatestCompleted
            : config.attemptSelectionPolicy,
          levelMappingRule: config.levelMappingRule,
          topInformationRatio: requiredNumber(
            config.topInformationRatio,
            defaults.topInformationRatio
          ),
          defaultDiscrimination: undefined,
        }
      : undefined

  return {
    competenceTreeId: config.competenceTreeId,
    scaleVersionId: config.scaleVersionId,
    preset: config.preset,
    totalQuestionCap: requiredNumber(
      config.totalQuestionCap,
      defaults.totalQuestionCap
    ),
    timeLimitSeconds: config.timeLimitMinutes?.trim()
      ? Math.round(Number(config.timeLimitMinutes) * 60)
      : null,
    perLeafQuestionCap: optionalNumber(config.perLeafQuestionCap),
    minQuestionsPerLeaf: requiredNumber(
      config.minQuestionsPerLeaf,
      defaults.minQuestionsPerLeaf
    ),
    classificationZ: config.scaleVersionId
      ? undefined
      : requiredNumber(config.classificationZ, defaults.classificationZ),
    showTimer: config.showTimer,
    nodeOverrides: config.nodeOverrides.map((override) => ({
      nodeId: override.nodeId,
      enabled: override.enabled,
      weight: optionalNumber(override.weight),
      questionCap: optionalNumber(override.questionCap),
    })),
    elementOverrides: config.elementOverrides.map((override) => ({
      assignmentId: override.assignmentId,
      enabled: override.enabled,
      discrimination: undefined,
    })),
    researchSettings,
  }
}

export function isManageAdaptivePresetSelectable(
  preset: AdaptivePracticeQuizPreset,
  scaleVersionId?: string
): boolean {
  return (
    preset !== AdaptivePracticeQuizPreset.Placement || Boolean(scaleVersionId)
  )
}

export function applyPlacementPilotDefaults(
  config: AdaptivePracticeQuizConfigFormValues
): AdaptivePracticeQuizConfigFormValues {
  return {
    ...config,
    preset: AdaptivePracticeQuizPreset.Placement,
    minQuestionsPerLeaf: String(PLACEMENT_PILOT_MIN_QUESTIONS_PER_LEAF),
  }
}

export function isPlacementPilotConfig(
  config: Pick<
    AdaptivePracticeQuizConfigFormValues,
    'preset' | 'scaleVersionId'
  >
): boolean {
  return (
    config.preset === AdaptivePracticeQuizPreset.Placement &&
    Boolean(config.scaleVersionId)
  )
}

export function getAdaptivePracticeQuizEffectiveSettings(
  config: AdaptivePracticeQuizConfigFormValues
) {
  const research = config.preset === AdaptivePracticeQuizPreset.Research
  const placementPilot = isPlacementPilotConfig(config)
  const defaults = getAdaptivePresetDefaults(
    config.preset as AdaptivePresetName
  )

  return {
    attemptSelectionPolicy: placementPilot
      ? AdaptiveAttemptSelectionPolicy.LatestCompleted
      : research
        ? config.attemptSelectionPolicy
        : toAttemptSelectionPolicy(defaults.attemptSelectionPolicy),
    levelMappingRule: placementPilot
      ? AdaptiveLevelMappingRule.Nearest
      : research
        ? config.levelMappingRule
        : toLevelMappingRule(defaults.levelMappingRule),
  }
}

type PersistedAdaptivePreview = NonNullable<
  QAdaptivePracticeQuizPreviewWithRuntimeLimitsQuery['adaptivePracticeQuizPreview']
>

export function mapAdaptivePracticeQuizPreviewToForm(
  preview: PersistedAdaptivePreview
): AdaptivePracticeQuizConfigFormValues {
  return {
    competenceTreeId: preview.config.competenceTreeId,
    scaleVersionId: preview.config.scaleVersionId ?? undefined,
    preset: preview.config.preset,
    totalQuestionCap: String(preview.config.totalQuestionCap),
    timeLimitMinutes:
      preview.config.timeLimitSeconds == null
        ? ''
        : String(preview.config.timeLimitSeconds / 60),
    perLeafQuestionCap: nullableNumberToString(
      preview.config.perLeafQuestionCap
    ),
    minQuestionsPerLeaf: String(preview.config.minQuestionsPerLeaf),
    classificationZ: String(preview.config.classificationZ),
    showTimer: preview.config.showTimer,
    attemptSelectionPolicy: preview.config.attemptSelectionPolicy,
    levelMappingRule: preview.config.levelMappingRule,
    topInformationRatio: String(preview.config.topInformationRatio),
    defaultDiscrimination: String(preview.config.defaultDiscrimination),
    nodeOverrides: preview.nodes.map((node) => ({
      nodeId: node.id,
      enabled: node.overrideEnabled,
      weight: nullableNumberToString(node.weight),
      questionCap: nullableNumberToString(node.questionCap),
    })),
    elementOverrides: preview.assignments.map((assignment) => ({
      assignmentId: assignment.id,
      enabled: assignment.overrideEnabled,
      discrimination: nullableNumberToString(assignment.overrideDiscrimination),
    })),
  }
}

function optionalNumber(value: string): number | undefined {
  if (value.trim() === '') return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function requiredNumber(value: string, fallback: number): number {
  return optionalNumber(value) ?? fallback
}

function nullableNumberToString(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value)
    ? String(value)
    : ''
}

function toAttemptSelectionPolicy(
  value: 'FIRST_COMPLETED' | 'LATEST_COMPLETED'
): AdaptiveAttemptSelectionPolicy {
  return value === 'FIRST_COMPLETED'
    ? AdaptiveAttemptSelectionPolicy.FirstCompleted
    : AdaptiveAttemptSelectionPolicy.LatestCompleted
}

function toLevelMappingRule(
  value: 'MASTERY' | 'NEAREST'
): AdaptiveLevelMappingRule {
  return value === 'MASTERY'
    ? AdaptiveLevelMappingRule.Mastery
    : AdaptiveLevelMappingRule.Nearest
}
