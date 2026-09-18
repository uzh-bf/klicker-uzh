// Design-review view models for the generation gate. Kept dependency-free so
// the component's rendering branches and the concentration check can be tested
// without a GraphQL client runtime.

import {
  type ElementGenerationBloomLevel,
  type ElementGenerationFailureClass,
  NEUTRAL_OBJECTIVE_SOURCE,
  type QuestionGenerationObjectiveSource,
} from '@klicker-uzh/types'

// A synthesized Bloom-level objective carries objectiveSource 'neutral';
// builds persisted before that marker have no value and stay treated as
// lecturer guidance, so only an explicit 'neutral' shows the generated-default
// label.
export type ElementGenerationDesignObjectiveView = {
  id: string
  text: string
  bloomLevel: ElementGenerationBloomLevel | null
  isGeneratedDefault: boolean
}

export function designReviewObjectives(
  objectives: ReadonlyArray<{
    id: string
    text: string
    bloomLevel?: ElementGenerationBloomLevel | null
    objectiveSource?: QuestionGenerationObjectiveSource | null
  }>
): ElementGenerationDesignObjectiveView[] {
  return objectives.map((objective) => ({
    id: objective.id,
    text: objective.text,
    bloomLevel: objective.bloomLevel ?? null,
    isGeneratedDefault: objective.objectiveSource === NEUTRAL_OBJECTIVE_SOURCE,
  }))
}

export type ElementGenerationDesignSlotEvidenceView = {
  sourceElementId: string
  moduleId: string
  entityIds: string[]
}

export type ElementGenerationDesignConcentrationView = {
  moduleId: string
  entityIds: string[]
  slotCount: number
}

// Slots without surfaced entities render nothing extra, so older worker
// artifacts stay valid.
export function designReviewSlotEvidence(
  slots: ReadonlyArray<{
    sourceElementId: string
    moduleId: string
    evidenceEntityIds?: readonly string[] | null
  }>
): ElementGenerationDesignSlotEvidenceView[] {
  return slots.map((slot) => ({
    sourceElementId: slot.sourceElementId,
    moduleId: slot.moduleId,
    entityIds: [...(slot.evidenceEntityIds ?? [])],
  }))
}

function entityIdSetKey(entityIds: readonly string[]): string {
  return [...entityIds].sort().join('\u0000')
}

// A concentration is a module whose slots with surfaced entities all ground on
// one identical, non-empty entity set. Two or more such slots are required: a
// single slot cannot be concentrated against itself.
export function designReviewConcentration(
  slots: ReadonlyArray<ElementGenerationDesignSlotEvidenceView>
): ElementGenerationDesignConcentrationView[] {
  const byModule = new Map<string, ElementGenerationDesignSlotEvidenceView[]>()
  for (const slot of slots) {
    if (slot.entityIds.length === 0) continue
    const moduleSlots = byModule.get(slot.moduleId) ?? []
    moduleSlots.push(slot)
    byModule.set(slot.moduleId, moduleSlots)
  }

  const concentrations: ElementGenerationDesignConcentrationView[] = []
  for (const [moduleId, moduleSlots] of byModule) {
    if (moduleSlots.length < 2) continue
    const key = entityIdSetKey(moduleSlots[0]!.entityIds)
    if (moduleSlots.every((slot) => entityIdSetKey(slot.entityIds) === key)) {
      concentrations.push({
        moduleId,
        entityIds: [...moduleSlots[0]!.entityIds],
        slotCount: moduleSlots.length,
      })
    }
  }
  return concentrations
}

// The worker reports one structured reason per slot it could not supply. The
// reason codes are an open, append-only set, so the code itself stays out of
// the rendered text: a code listed here renders its own explanation, and a
// code a newer worker release adds renders the failure-class explanation
// instead of an untranslated identifier.
export const QUESTION_GENERATION_REASON_CODES = [
  'NO_SUPPORTING_DOCUMENTS',
  'TOPIC_NOT_IN_MATERIAL',
  'LEVEL_NOT_GROUNDABLE',
  'NO_DISTINCT_EVIDENCE',
  'GROUNDING_EXHAUSTED',
  'SYSTEM_FAILURE',
] as const

export type QuestionGenerationReasonCode =
  (typeof QUESTION_GENERATION_REASON_CODES)[number]

// Literal key types so the component can pass them to the typed translator.
export const QUESTION_GENERATION_REASON_KEYS = {
  NO_SUPPORTING_DOCUMENTS: 'reasons.NO_SUPPORTING_DOCUMENTS',
  TOPIC_NOT_IN_MATERIAL: 'reasons.TOPIC_NOT_IN_MATERIAL',
  LEVEL_NOT_GROUNDABLE: 'reasons.LEVEL_NOT_GROUNDABLE',
  NO_DISTINCT_EVIDENCE: 'reasons.NO_DISTINCT_EVIDENCE',
  GROUNDING_EXHAUSTED: 'reasons.GROUNDING_EXHAUSTED',
  SYSTEM_FAILURE: 'reasons.SYSTEM_FAILURE',
} as const satisfies Record<QuestionGenerationReasonCode, string>

export type QuestionGenerationReasonMessageKey =
  (typeof QUESTION_GENERATION_REASON_KEYS)[QuestionGenerationReasonCode]

export function isQuestionGenerationReasonCode(
  reasonCode: string
): reasonCode is QuestionGenerationReasonCode {
  return (QUESTION_GENERATION_REASON_CODES as readonly string[]).includes(
    reasonCode
  )
}

export const ELEMENT_GENERATION_FAILURE_CLASSES = [
  'user_input',
  'self_repairable',
  'system',
] as const

export function isElementGenerationFailureClass(
  value: string
): value is ElementGenerationFailureClass {
  return (ELEMENT_GENERATION_FAILURE_CLASSES as readonly string[]).includes(
    value
  )
}

// Both keys of every class exist in both locales; the class message is the
// fallback for a reason code the reviewing client does not know yet.
export const ELEMENT_GENERATION_FAILURE_CLASS_KEYS = {
  user_input: {
    label: 'failureClassLabels.user_input',
    message: 'failureClasses.user_input',
  },
  self_repairable: {
    label: 'failureClassLabels.self_repairable',
    message: 'failureClasses.self_repairable',
  },
  system: {
    label: 'failureClassLabels.system',
    message: 'failureClasses.system',
  },
} as const satisfies Record<
  ElementGenerationFailureClass,
  { label: string; message: string }
>

export type ElementGenerationFailureClassLabelKey =
  (typeof ELEMENT_GENERATION_FAILURE_CLASS_KEYS)[ElementGenerationFailureClass]['label']
export type ElementGenerationFailureClassMessageKey =
  (typeof ELEMENT_GENERATION_FAILURE_CLASS_KEYS)[ElementGenerationFailureClass]['message']

export type ElementGenerationSlotFailureView = {
  slotId: string
  moduleId: string | null
  objective: string | null
  isGeneratedDefaultObjective: boolean
  requestedLevel: ElementGenerationBloomLevel | null
  evidenceTarget: string | null
  failureClass: ElementGenerationFailureClass
  // Translation keys. The card stays keyed by the stable reason code, but the
  // rendered message is either the explanation of that code or, for a code
  // the client does not know, the explanation of its failure class.
  failureClassLabelKey: ElementGenerationFailureClassLabelKey
  reasonKey:
    | QuestionGenerationReasonMessageKey
    | ElementGenerationFailureClassMessageKey
  reasonCode: string
  isKnownReasonCode: boolean
  detail: string | null
  suggestions: string[]
  showsRetryGuidance: boolean
}

export function elementGenerationSlotFailures(
  failures: ReadonlyArray<{
    slotId: string
    moduleId?: string | null
    objective?: string | null
    objectiveSource?: QuestionGenerationObjectiveSource | null
    requestedLevel?: ElementGenerationBloomLevel | null
    evidenceTarget?: string | null
    reasonCode: string
    failureClass: ElementGenerationFailureClass
    detail?: string | null
    suggestions?: readonly string[] | null
  }>
): ElementGenerationSlotFailureView[] {
  return failures.map((failure) => {
    const knownReasonCode = isQuestionGenerationReasonCode(failure.reasonCode)
      ? failure.reasonCode
      : null
    // An unknown class is treated as a system failure, which never claims a
    // user-input cause, so a newer worker release still renders.
    const failureClass = isElementGenerationFailureClass(failure.failureClass)
      ? failure.failureClass
      : 'system'
    const classKeys = ELEMENT_GENERATION_FAILURE_CLASS_KEYS[failureClass]
    return {
      slotId: failure.slotId,
      moduleId: failure.moduleId ?? null,
      objective: failure.objective ?? null,
      isGeneratedDefaultObjective:
        failure.objectiveSource === NEUTRAL_OBJECTIVE_SOURCE,
      requestedLevel: failure.requestedLevel ?? null,
      evidenceTarget: failure.evidenceTarget ?? null,
      failureClass,
      failureClassLabelKey: classKeys.label,
      reasonKey: knownReasonCode
        ? QUESTION_GENERATION_REASON_KEYS[knownReasonCode]
        : classKeys.message,
      reasonCode: failure.reasonCode,
      isKnownReasonCode: knownReasonCode !== null,
      detail: failure.detail ?? null,
      suggestions: (failure.suggestions ?? []).filter(
        (suggestion) => suggestion.trim().length > 0
      ),
      showsRetryGuidance: failureClass === 'system',
    }
  })
}

// The result surface a settled build shows. slotFailures renders the per-slot
// reason cards: it replaces the legacy failure text of a failed run that
// reported reasons, and it replaces the empty review state of a partial run
// whose passing set is empty.
export type ElementGenerationResultSurface =
  | 'none'
  | 'slotFailures'
  | 'legacyFailure'
  | 'noDrafts'

export function elementGenerationResultSurface(input: {
  isFailed: boolean
  isDelivered: boolean
  draftCount: number
  failureCount: number
}): ElementGenerationResultSurface {
  if (!input.isFailed && !input.isDelivered) return 'none'
  if (input.failureCount > 0) return 'slotFailures'
  if (input.isFailed) return 'legacyFailure'
  return input.draftCount === 0 ? 'noDrafts' : 'none'
}
