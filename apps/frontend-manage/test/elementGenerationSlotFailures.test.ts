import assert from 'node:assert/strict'
import de from '@klicker-uzh/i18n/messages/de.ts'
import en from '@klicker-uzh/i18n/messages/en.ts'
import {
  ELEMENT_GENERATION_FAILURE_CLASS_KEYS,
  ELEMENT_GENERATION_FAILURE_CLASSES,
  elementGenerationResultSurface,
  elementGenerationSlotFailures,
  QUESTION_GENERATION_REASON_CODES,
  QUESTION_GENERATION_REASON_KEYS,
} from '../src/components/elements/generation/designReviewSummary.ts'

// The worker contract is an open, append-only code set, so the client never
// renders the code itself: a known code selects its own explanation, and a
// code a newer worker release adds selects the explanation of its failure
// class. The code stays on the card for keying and diagnostics.
const knownCodeCards = elementGenerationSlotFailures([
  {
    slotId: 'q01',
    moduleId: 'M1',
    objective: 'Explain malolactic fermentation.',
    objectiveSource: 'provided',
    requestedLevel: 'apply',
    evidenceTarget: 'wine-chemistry.pdf#page=3',
    reasonCode: 'NO_SUPPORTING_DOCUMENTS',
    failureClass: 'user_input',
    detail: null,
    suggestions: ['Malolactic fermentation'],
  },
])
assert.equal(knownCodeCards.length, 1)
assert.equal(knownCodeCards[0]?.reasonKey, 'reasons.NO_SUPPORTING_DOCUMENTS')
assert.equal(knownCodeCards[0]?.isKnownReasonCode, true)
assert.equal(knownCodeCards[0]?.failureClass, 'user_input')
assert.equal(
  knownCodeCards[0]?.failureClassLabelKey,
  'failureClassLabels.user_input'
)
assert.equal(knownCodeCards[0]?.showsRetryGuidance, false)
assert.equal(knownCodeCards[0]?.isGeneratedDefaultObjective, false)
assert.deepEqual(knownCodeCards[0]?.suggestions, ['Malolactic fermentation'])

// An unknown code keeps the artifact valid and renders through the failure
// class, so a future worker release cannot surface an untranslated key.
const unknownCodeCards = elementGenerationSlotFailures([
  {
    slotId: 'q02',
    reasonCode: 'EVIDENCE_RETENTION_EXPIRED',
    failureClass: 'system',
  },
  {
    slotId: 'q03',
    reasonCode: 'SOMETHING_NEW',
    failureClass: 'self_repairable',
  },
])
assert.equal(unknownCodeCards[0]?.isKnownReasonCode, false)
assert.equal(unknownCodeCards[0]?.reasonKey, 'failureClasses.system')
assert.equal(unknownCodeCards[1]?.reasonKey, 'failureClasses.self_repairable')
assert.equal(unknownCodeCards[0]?.showsRetryGuidance, true)
assert.equal(unknownCodeCards[1]?.showsRetryGuidance, false)

// A class this client does not know degrades to the system surface, which
// never claims a user-input cause.
const unknownClassCards = elementGenerationSlotFailures([
  {
    slotId: 'q04',
    reasonCode: 'SYSTEM_FAILURE',
    failureClass: 'invented_class' as never,
  },
])
assert.equal(unknownClassCards[0]?.failureClass, 'system')
assert.equal(
  unknownClassCards[0]?.failureClassLabelKey,
  'failureClassLabels.system'
)
assert.equal(unknownClassCards[0]?.showsRetryGuidance, true)

// Structured fields default to absent values instead of failing, and a
// synthesized objective carries the generated-default marker.
const sparseCards = elementGenerationSlotFailures([
  {
    slotId: 'q05',
    reasonCode: 'GROUNDING_EXHAUSTED',
    failureClass: 'user_input',
    objective: 'Analyze a rate increase.',
    objectiveSource: 'neutral',
    suggestions: ['Interest rates', '   '],
  },
])
assert.equal(sparseCards[0]?.moduleId, null)
assert.equal(sparseCards[0]?.requestedLevel, null)
assert.equal(sparseCards[0]?.evidenceTarget, null)
assert.equal(sparseCards[0]?.detail, null)
assert.equal(sparseCards[0]?.isGeneratedDefaultObjective, true)
// Blank suggestions carry no topic and are dropped from the chips.
assert.deepEqual(sparseCards[0]?.suggestions, ['Interest rates'])

// The surface decision: reasons always win, a failed run without reasons
// keeps the distinct legacy fallback, and a delivered run without passing
// elements shows the reason cards rather than the empty review state.
assert.equal(
  elementGenerationResultSurface({
    isFailed: true,
    isDelivered: false,
    draftCount: 0,
    failureCount: 3,
  }),
  'slotFailures'
)
assert.equal(
  elementGenerationResultSurface({
    isFailed: true,
    isDelivered: false,
    draftCount: 0,
    failureCount: 0,
  }),
  'legacyFailure'
)
assert.equal(
  elementGenerationResultSurface({
    isFailed: false,
    isDelivered: true,
    draftCount: 0,
    failureCount: 2,
  }),
  'slotFailures'
)
assert.equal(
  elementGenerationResultSurface({
    isFailed: false,
    isDelivered: true,
    draftCount: 5,
    failureCount: 2,
  }),
  'slotFailures'
)
assert.equal(
  elementGenerationResultSurface({
    isFailed: false,
    isDelivered: true,
    draftCount: 0,
    failureCount: 0,
  }),
  'noDrafts'
)
assert.equal(
  elementGenerationResultSurface({
    isFailed: false,
    isDelivered: true,
    draftCount: 4,
    failureCount: 0,
  }),
  'none'
)
// A build that is still running keeps its processing surface.
assert.equal(
  elementGenerationResultSurface({
    isFailed: false,
    isDelivered: false,
    draftCount: 0,
    failureCount: 1,
  }),
  'none'
)

// Every key the card and its surfaces can emit exists in both locales. The
// key sets are read from the view model, so a new reason code cannot ship
// without its explanation.
function messageAt(messages: Record<string, unknown>, key: string): unknown {
  return key.split('.').reduce<unknown>((current, segment) => {
    if (typeof current !== 'object' || current === null) return undefined
    return (current as Record<string, unknown>)[segment]
  }, messages)
}

const componentKeys = [
  'build.legacyFailure',
  'build.failureReasonsTitle',
  'build.failureReasonsHelp',
  'build.failureModule',
  'build.failureObjective',
  'build.failureLevel',
  'build.failureEvidence',
  'build.failureSuggestions',
  'build.failureRetryGuidance',
  'build.failureDiagnostics',
  'gate.generatedDefaultObjective',
]
const reasonKeys = Object.values(QUESTION_GENERATION_REASON_KEYS)
const classMessageKeys = ELEMENT_GENERATION_FAILURE_CLASSES.map(
  (failureClass) => ELEMENT_GENERATION_FAILURE_CLASS_KEYS[failureClass].message
)
const classLabelKeys = ELEMENT_GENERATION_FAILURE_CLASSES.map(
  (failureClass) => ELEMENT_GENERATION_FAILURE_CLASS_KEYS[failureClass].label
)

assert.deepEqual(
  Object.keys(QUESTION_GENERATION_REASON_KEYS).sort(),
  [...QUESTION_GENERATION_REASON_CODES].sort()
)
for (const [locale, messages] of [
  ['en', en],
  ['de', de],
] as const) {
  for (const key of [
    ...componentKeys,
    ...reasonKeys,
    ...classMessageKeys,
    ...classLabelKeys,
  ]) {
    const value = messageAt(
      messages as Record<string, unknown>,
      `manage.elementGeneration.${key}`
    )
    assert.equal(
      typeof value === 'string' && value.length > 0,
      true,
      `${locale} is missing manage.elementGeneration.${key}`
    )
  }
}

// The card renders the level through the existing bloom block, which must
// cover every bloom level the worker can report as requested.
for (const [locale, messages] of [
  ['en', en],
  ['de', de],
] as const) {
  const root = messages as Record<string, unknown>
  for (const level of [
    'remember',
    'understand',
    'apply',
    'analyze',
    'evaluate',
  ]) {
    const value = messageAt(root, `manage.elementGeneration.bloom.${level}`)
    assert.equal(
      typeof value === 'string' && value.length > 0,
      true,
      `${locale} is missing manage.elementGeneration.bloom.${level}`
    )
  }
  const elementGeneration = messageAt(root, 'manage.elementGeneration')
  assert.notEqual(elementGeneration, undefined)
}
