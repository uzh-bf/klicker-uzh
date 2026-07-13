import {
  AdaptiveAttemptSelectionPolicy,
  AdaptiveLevelMappingRule,
  AdaptivePracticeQuizConfigInput,
  AdaptivePracticeQuizPreset,
  AdaptivePracticeQuizPreviewQuery,
  PracticeQuizMode,
} from '@klicker-uzh/graphql/dist/ops'
import {
  AdaptivePracticeQuizConfigFormValues,
  PracticeQuizFormValues,
} from '../WizardLayout'

export const ADAPTIVE_MAX_QUESTION_CAP = 1000
export const ADAPTIVE_MAX_CLASSIFICATION_Z = 5
export const ADAPTIVE_MAX_DISCRIMINATION = 10

export function createAdaptivePracticeQuizDefaultConfig(): AdaptivePracticeQuizConfigFormValues {
  return {
    competenceTreeId: undefined,
    preset: AdaptivePracticeQuizPreset.Diagnostic,
    totalQuestionCap: '50',
    perLeafQuestionCap: '',
    minQuestionsPerLeaf: '2',
    classificationZ: '1.28',
    standardErrorThreshold: '',
    showTimer: true,
    attemptSelectionPolicy: AdaptiveAttemptSelectionPolicy.LatestCompleted,
    levelMappingRule: AdaptiveLevelMappingRule.Nearest,
    topInformationRatio: '0.8',
    defaultDiscrimination: '1.2',
    showLiveEstimate: false,
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

  const researchSettings =
    config.preset === AdaptivePracticeQuizPreset.Research
      ? {
          attemptSelectionPolicy: config.attemptSelectionPolicy,
          levelMappingRule: config.levelMappingRule,
          topInformationRatio: requiredNumber(config.topInformationRatio, 0.8),
          defaultDiscrimination: requiredNumber(
            config.defaultDiscrimination,
            1.2
          ),
          showLiveEstimate: config.showLiveEstimate,
        }
      : undefined

  return {
    competenceTreeId: config.competenceTreeId,
    preset: config.preset,
    totalQuestionCap: requiredNumber(config.totalQuestionCap, 50),
    perLeafQuestionCap: optionalNumber(config.perLeafQuestionCap),
    minQuestionsPerLeaf: requiredNumber(config.minQuestionsPerLeaf, 2),
    classificationZ: requiredNumber(config.classificationZ, 1.28),
    standardErrorThreshold: optionalNumber(config.standardErrorThreshold),
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
      discrimination:
        config.preset === AdaptivePracticeQuizPreset.Research
          ? optionalNumber(override.discrimination)
          : undefined,
    })),
    researchSettings,
  }
}

export function getAdaptivePracticeQuizEffectiveSettings(
  config: AdaptivePracticeQuizConfigFormValues
) {
  const research = config.preset === AdaptivePracticeQuizPreset.Research
  const placement = config.preset === AdaptivePracticeQuizPreset.Placement

  return {
    attemptSelectionPolicy: placement
      ? AdaptiveAttemptSelectionPolicy.FirstCompleted
      : research
        ? config.attemptSelectionPolicy
        : AdaptiveAttemptSelectionPolicy.LatestCompleted,
    levelMappingRule: placement
      ? AdaptiveLevelMappingRule.Mastery
      : research
        ? config.levelMappingRule
        : AdaptiveLevelMappingRule.Nearest,
    showFinalResult: true,
    showLiveEstimate: research && config.showLiveEstimate,
  }
}

type PersistedAdaptivePreview = NonNullable<
  AdaptivePracticeQuizPreviewQuery['adaptivePracticeQuizPreview']
>

export function mapAdaptivePracticeQuizPreviewToForm(
  preview: PersistedAdaptivePreview
): AdaptivePracticeQuizConfigFormValues {
  return {
    competenceTreeId: preview.config.competenceTreeId,
    preset: preview.config.preset,
    totalQuestionCap: String(preview.config.totalQuestionCap),
    perLeafQuestionCap: nullableNumberToString(
      preview.config.perLeafQuestionCap
    ),
    minQuestionsPerLeaf: String(preview.config.minQuestionsPerLeaf),
    classificationZ: String(preview.config.classificationZ),
    standardErrorThreshold: nullableNumberToString(
      preview.config.standardErrorThreshold
    ),
    showTimer: preview.config.showTimer,
    attemptSelectionPolicy: preview.config.attemptSelectionPolicy,
    levelMappingRule: preview.config.levelMappingRule,
    topInformationRatio: String(preview.config.topInformationRatio),
    defaultDiscrimination: String(preview.config.defaultDiscrimination),
    showLiveEstimate: preview.config.showLiveEstimate,
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
