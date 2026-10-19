import assert from 'node:assert/strict'
import {
  hasUnsubmittedChanges,
  isDefaultCreditPolicy,
  isDefaultGraphPolicy,
  isDefaultModelPolicy,
  isDefaultModes,
  isStudentInformationInvalid,
  isSuggestedStudentInformation,
  resolveSectionStatus,
  sectionBlocksRequest,
} from '../src/components/resources/chatbots/chatbotSetupStatus.ts'

// Unsaved edits outrank every stored state.
assert.equal(
  resolveSectionStatus({ unsaved: true, invalid: true, isDefault: true }),
  'unsaved'
)
assert.equal(
  resolveSectionStatus({ invalid: true, notSubmitted: true }),
  'invalid'
)
assert.equal(
  resolveSectionStatus({ notSubmitted: true, warning: true }),
  'notSubmitted'
)
assert.equal(
  resolveSectionStatus({ warning: true, isDefault: true }),
  'warning'
)
assert.equal(
  resolveSectionStatus({ suggested: true, isDefault: true }),
  'suggested'
)
assert.equal(resolveSectionStatus({ isDefault: true }), 'default')
assert.equal(resolveSectionStatus({}), 'saved')

// A warning, such as a missing knowledge base, never blocks a request.
assert.equal(sectionBlocksRequest('warning'), false)
assert.equal(sectionBlocksRequest('unsaved'), true)
assert.equal(sectionBlocksRequest('invalid'), true)

const defaultCredits = {
  creditInitialCredits: 3,
  creditResetPeriod: 'DAILY',
  creditResetAmount: 3,
  creditMaxCredits: 3,
}
assert.equal(isDefaultCreditPolicy(defaultCredits), true)
assert.equal(
  isDefaultCreditPolicy({ ...defaultCredits, creditMaxCredits: 5 }),
  false
)

const defaultModes = {
  tutorEnabled: true,
  explainerEnabled: true,
  quizzerEnabled: true,
  scopeNote: ' ',
  customModeCount: 0,
}
assert.equal(isDefaultModes(defaultModes), true)
assert.equal(isDefaultModes({ ...defaultModes, quizzerEnabled: false }), false)
assert.equal(isDefaultModes({ ...defaultModes, customModeCount: 1 }), false)

assert.equal(
  isDefaultModelPolicy(
    { modelSelection: false, allowedModelIds: [], reasoningEffortsByModel: [] },
    'model-a'
  ),
  true
)
assert.equal(
  isDefaultModelPolicy(
    {
      modelSelection: false,
      allowedModelIds: ['model-a'],
      reasoningEffortsByModel: [{ modelId: 'model-a', efforts: ['high'] }],
    },
    'model-a'
  ),
  false
)
assert.equal(
  isDefaultModelPolicy(
    {
      modelSelection: false,
      allowedModelIds: ['model-b'],
      reasoningEffortsByModel: [],
    },
    'model-a'
  ),
  false
)
assert.equal(
  isDefaultModelPolicy(
    {
      modelSelection: true,
      allowedModelIds: ['model-a'],
      reasoningEffortsByModel: [],
    },
    'model-a'
  ),
  false
)

assert.equal(
  isDefaultGraphPolicy({
    knowledgeGraphVisible: false,
    knowledgeGraphRetrievalEnabled: false,
  }),
  true
)
assert.equal(
  isDefaultGraphPolicy({
    knowledgeGraphVisible: true,
    knowledgeGraphRetrievalEnabled: false,
  }),
  false
)

assert.equal(isStudentInformationInvalid({ title: 'T', introText: 'I' }), false)
assert.equal(isStudentInformationInvalid({ title: ' ', introText: 'I' }), true)
assert.equal(
  isStudentInformationInvalid({ title: 'T', introText: '<br> ' }),
  true
)
assert.equal(
  isStudentInformationInvalid({ title: null, introText: null }),
  true
)

const suggestions = [
  { title: 'Suggestion A', introText: 'Intro A' },
  { title: 'Suggestion B', introText: 'Intro B' },
]
assert.equal(
  isSuggestedStudentInformation(
    { title: 'Suggestion B ', introText: 'Intro B' },
    suggestions
  ),
  true
)
assert.equal(
  isSuggestedStudentInformation(
    { title: 'Suggestion A', introText: 'Changed' },
    suggestions
  ),
  false
)

assert.equal(hasUnsubmittedChanges({ visible: true }, { visible: true }), false)
assert.equal(hasUnsubmittedChanges({ visible: true }, { visible: false }), true)
