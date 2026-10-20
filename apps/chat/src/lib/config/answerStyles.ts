/**
 * Student-chosen answer styles. Each preset changes only the length and
 * structure of explanations and feedback (ADR 0054); `balanced` adds nothing to
 * the system prompt. The list is closed: the chat route maps any other value
 * to the default.
 */
export const ANSWER_STYLES = [
  'balanced',
  'brief',
  'bullets',
  'detailed',
] as const

export type AnswerStyle = (typeof ANSWER_STYLES)[number]

export const DEFAULT_ANSWER_STYLE: AnswerStyle = 'balanced'
