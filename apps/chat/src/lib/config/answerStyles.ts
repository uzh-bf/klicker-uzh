/**
 * Student-chosen reading preferences (ADR 0054). The answer style is the
 * layout (prose or bullet points); the tone changes wording and warmth.
 * Neither changes how much help the student gets, and neither describes what
 * the student already knows. The defaults add nothing to
 * the system prompt. Both lists are closed: the chat route maps any other
 * value to the default.
 */
export const ANSWER_STYLES = ['balanced', 'bullets'] as const

export type AnswerStyle = (typeof ANSWER_STYLES)[number]

export const DEFAULT_ANSWER_STYLE: AnswerStyle = 'balanced'

export const ANSWER_TONES = ['neutral', 'friendly', 'direct'] as const

export type AnswerTone = (typeof ANSWER_TONES)[number]

export const DEFAULT_ANSWER_TONE: AnswerTone = 'neutral'
