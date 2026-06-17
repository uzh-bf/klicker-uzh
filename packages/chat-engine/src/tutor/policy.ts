export const TUTOR_ALLOWED_MOVES = [
  'ask',
  'hint',
  'simplify',
  'explain',
  'worked_micro_step',
  'self_explain',
  'reflect',
  'summarize',
] as const

export type TutorAllowedMove = (typeof TUTOR_ALLOWED_MOVES)[number]

export type TutorPolicyState = {
  skillPackVersion: string
  currentSkill?: string
  studentState: string
  firstError?: {
    step?: string
    explanation: string
  }
  misconception?: {
    id?: string
    label: string
    confidence: number
  }
  hintDepth: number
  allowedMove: TutorAllowedMove
  leakageAllowed: boolean
  retrievalNeeded: boolean
  affectSignal?: string
  imageUncertainty?: boolean
}

export type TutorMovePolicy = {
  allowedMove: TutorAllowedMove
  maxQuestions: number
  directAnswerAllowed: boolean
  imageConfirmationRequired: boolean
  citationRule: 'cite_retrieved_evidence_only' | 'no_course_citation'
  directives: string[]
}

const MOVE_DIRECTIVES: Record<TutorAllowedMove, string> = {
  ask: 'Ask one targeted open-ended question that helps the student take the next step.',
  hint: 'Give one minimal hint. Do not solve the full problem.',
  simplify: 'Reduce the task to a smaller subproblem or prerequisite idea.',
  explain:
    'Give a concise concept explanation, then ask one next-action question.',
  worked_micro_step:
    'Work exactly one micro-step and stop before completing the full solution.',
  self_explain:
    'Ask the student to explain their next step or reasoning in their own words.',
  reflect:
    'Ask the student to reflect on the strategy, assumption, or check they used.',
  summarize:
    'Briefly summarize the relevant course boundary or completed reasoning.',
}

export function selectTutorMovePolicy(
  state: TutorPolicyState
): TutorMovePolicy {
  const imageConfirmationRequired = state.imageUncertainty === true
  const directAnswerAllowed =
    state.leakageAllowed &&
    ['explain', 'worked_micro_step', 'summarize'].includes(state.allowedMove)
  const citationRule = state.retrievalNeeded
    ? 'cite_retrieved_evidence_only'
    : 'no_course_citation'

  const directives = [
    MOVE_DIRECTIVES[state.allowedMove],
    'Use exactly one tutor move for this turn.',
    'Ask at most one question.',
    directAnswerAllowed
      ? 'A short direct answer or worked micro-step is allowed when needed.'
      : 'Do not provide the final answer or complete solution.',
    citationRule === 'cite_retrieved_evidence_only'
      ? 'Cite only retrieved course evidence; never invent references.'
      : 'Do not add course citations unless retrieved evidence is present.',
  ]

  if (imageConfirmationRequired) {
    directives.unshift(
      'Ask one clarification or confirmation about the uncertain image before tutoring.'
    )
  }

  return {
    allowedMove: state.allowedMove,
    maxQuestions: 1,
    directAnswerAllowed,
    imageConfirmationRequired,
    citationRule,
    directives,
  }
}
