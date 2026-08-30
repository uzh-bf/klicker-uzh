import type { ManageAssistantCapabilityState } from '@/src/services/manageAssistantCapabilities'
import type { ManageAssistantContext } from '@/src/services/manageContext'

export interface ThreadSuggestion {
  id: string
  text: string
  prompt: string
}

// Shown while browsing the question pool, with no single question or course in focus.
const QUESTION_POOL_SUGGESTIONS: ThreadSuggestion[] = [
  {
    id: 'question-pool-draft',
    text: 'Draft a question',
    prompt:
      'Draft a new single-choice question for my question pool. Ask me for the topic first if it is not clear from our conversation.',
  },
  {
    id: 'question-pool-find',
    text: 'Find questions',
    prompt:
      'Search my question pool for questions on a topic I will give you. Include all statuses and question types unless I explicitly ask for a filter.',
  },
  {
    id: 'question-pool-feedback',
    text: 'Improve feedback',
    prompt:
      'Ask me which question to improve, then suggest clearer answer-specific feedback for it.',
  },
]

// Shown while a single question is open in the element editor (ids.elementId is set).
const ELEMENT_EDITOR_SUGGESTIONS: ThreadSuggestion[] = [
  {
    id: 'element-editor-improve',
    text: 'Improve this question',
    prompt:
      'Review the question I currently have open and suggest concrete improvements to its wording or answer options.',
  },
  {
    id: 'element-editor-variant',
    text: 'Draft a variant',
    prompt:
      'Draft a variant of the question I currently have open, keeping the same topic and difficulty.',
  },
  {
    id: 'element-editor-feedback',
    text: 'Better feedback',
    prompt:
      'Suggest clearer, more specific answer feedback for the question I currently have open.',
  },
]

// Shown on a course dashboard (ids.courseId is set).
const COURSE_DASHBOARD_SUGGESTIONS: ThreadSuggestion[] = [
  {
    id: 'course-dashboard-summarize',
    text: 'Summarize this course',
    prompt:
      'Summarize the course I currently have open: its structure and how many questions it has in the pool.',
  },
  {
    id: 'course-dashboard-draft',
    text: 'Draft course question',
    prompt:
      'Draft a new question for the course I currently have open. Ask me for the topic and question type if unclear.',
  },
  {
    id: 'course-dashboard-find',
    text: 'Find course material',
    prompt:
      'Search my question pool for material relevant to the course I currently have open.',
  },
]

// Shown while assembling a quiz or other activity.
const ACTIVITY_CREATION_SUGGESTIONS: ThreadSuggestion[] = [
  {
    id: 'activity-creation-draft',
    text: 'Draft quiz questions',
    prompt:
      'Draft one or more questions I could add to the quiz I am creating now. Ask me for the topic and question type if unclear.',
  },
  {
    id: 'activity-creation-reuse',
    text: 'Reuse questions',
    prompt:
      'Search my question pool for existing questions I could reuse in this quiz. Include all statuses and question types unless I explicitly ask for a filter.',
  },
  {
    id: 'activity-creation-balance',
    text: 'Balance difficulty',
    prompt:
      'Ask me to list the questions I am considering for this quiz, then suggest how to balance their difficulty.',
  },
]

// Shown on an evaluation/results view for a quiz.
const EVALUATION_SUGGESTIONS: ThreadSuggestion[] = [
  {
    id: 'evaluation-explain',
    text: 'Explain results',
    prompt:
      'Help me interpret the results for the quiz I am currently viewing.',
  },
  {
    id: 'evaluation-followup',
    text: 'Follow-up question',
    prompt:
      'Draft a follow-up question that targets a gap these results suggest. Ask me what the gap is if it is not obvious.',
  },
  {
    id: 'evaluation-similar',
    text: 'Similar questions',
    prompt:
      'Search my question pool for questions similar to the ones used in this quiz.',
  },
]

// Shown for the general manage surface, or when no context is available at all
// (e.g. the assistant opened in a new tab). Must never reference page context
// that is not actually present.
const GENERAL_SUGGESTIONS: ThreadSuggestion[] = [
  {
    id: 'general-draft',
    text: 'Draft question',
    prompt:
      'Draft a question for my course. Ask me for the topic and question type if needed.',
  },
  {
    id: 'general-find',
    text: 'Find questions',
    prompt:
      'Search my question pool for reusable questions. Ask for a topic if needed, and include all statuses and question types unless I explicitly ask for a filter.',
  },
  {
    id: 'general-feedback',
    text: 'Improve feedback',
    prompt:
      'Create concise answer-specific feedback for a question. Ask me for the question details if needed.',
  },
]

const PLAN_QUESTION_NO_SAVE: Pick<ThreadSuggestion, 'prompt' | 'text'> = {
  text: 'Plan a question',
  prompt:
    'Help me plan a question as a no-save preview. Ask me for the topic and question type if needed, and do not save anything.',
}

const IMPROVE_FEEDBACK_NO_SAVE: Pick<ThreadSuggestion, 'prompt' | 'text'> = {
  text: 'Improve feedback',
  prompt:
    'Ask me to provide the question and its answer options, then suggest concise answer-specific feedback, and do not save anything.',
}

const READ_ONLY_OVERRIDES: Record<
  string,
  Pick<ThreadSuggestion, 'prompt' | 'text'>
> = {
  'activity-creation-draft': {
    text: 'Plan quiz questions',
    prompt:
      'Help me plan one or more quiz questions as a no-save preview. Ask me for the topic and question type if unclear, and do not save anything.',
  },
  'course-dashboard-draft': {
    text: 'Plan course question',
    prompt:
      'Help me plan a course question as a no-save preview. Ask me for the topic and question type if unclear, and do not save anything.',
  },
  'element-editor-variant': {
    text: 'Plan a variant',
    prompt:
      'Help me plan a variant as a no-save preview. Ask me to provide any question details you cannot access, and do not save anything.',
  },
  'evaluation-followup': {
    text: 'Plan follow-up',
    prompt:
      'Help me plan a follow-up question as a no-save preview. Ask me to describe the learning gap, and do not save anything.',
  },
  'general-draft': PLAN_QUESTION_NO_SAVE,
  'general-feedback': IMPROVE_FEEDBACK_NO_SAVE,
  'question-pool-draft': {
    text: 'Plan a question',
    prompt:
      'Help me plan a single-choice question as a no-save preview. Ask me for the topic first if needed, and do not save anything.',
  },
}

const UNAVAILABLE_SUGGESTIONS: ThreadSuggestion[] = [
  {
    id: 'unavailable-plan-question',
    ...PLAN_QUESTION_NO_SAVE,
  },
  {
    id: 'unavailable-feedback',
    ...IMPROVE_FEEDBACK_NO_SAVE,
  },
  {
    id: 'unavailable-documentation',
    text: 'KlickerUZH help',
    prompt:
      'Help me with a KlickerUZH how-to question using the curated documentation index. Link the closest documented source and say when it is not an exact match.',
  },
]

function withoutPersistenceIntent(
  suggestion: ThreadSuggestion
): ThreadSuggestion {
  const override = READ_ONLY_OVERRIDES[suggestion.id]
  if (override) return { ...suggestion, ...override }

  return {
    ...suggestion,
    prompt: `${suggestion.prompt} Do not save anything.`,
  }
}

export function getManageSuggestions(
  context: ManageAssistantContext | null,
  capability: ManageAssistantCapabilityState = 'draft-and-read'
): ThreadSuggestion[] {
  if (capability === 'unavailable') return UNAVAILABLE_SUGGESTIONS

  let suggestions: ThreadSuggestion[]
  switch (context?.surface) {
    case 'question-pool':
      suggestions = QUESTION_POOL_SUGGESTIONS
      break
    case 'element-editor':
      suggestions = ELEMENT_EDITOR_SUGGESTIONS
      break
    case 'course-dashboard':
      suggestions = COURSE_DASHBOARD_SUGGESTIONS
      break
    case 'activity-creation':
      suggestions = ACTIVITY_CREATION_SUGGESTIONS
      break
    case 'evaluation':
      suggestions = EVALUATION_SUGGESTIONS
      break
    default:
      suggestions = GENERAL_SUGGESTIONS
  }

  return capability === 'read-only'
    ? suggestions.map(withoutPersistenceIntent)
    : suggestions
}
