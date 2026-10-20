import { z } from 'zod'
import {
  ANSWER_STYLES,
  type AnswerStyle,
  DEFAULT_ANSWER_STYLE,
} from '@/src/lib/config/answerStyles'
import { renderPromptTemplate } from '@/src/lib/server/promptTemplates'

/**
 * Request-body field for the student's answer style. A missing, stale, or
 * unknown value falls back to the default instead of rejecting the message.
 */
export const answerStyleSchema = z
  .enum(ANSWER_STYLES)
  .catch(DEFAULT_ANSWER_STYLE)

/**
 * Body of the student answer-style section, or null for the default style so
 * the default compiled prompt and its cache key stay unchanged.
 */
export function answerStyleInstructions(
  answerStyle: AnswerStyle | undefined
): string | null {
  if (!answerStyle || answerStyle === DEFAULT_ANSWER_STYLE) return null

  return renderPromptTemplate('student-answer-style', {
    brief: answerStyle === 'brief',
    bullets: answerStyle === 'bullets',
    detailed: answerStyle === 'detailed',
  })
}
