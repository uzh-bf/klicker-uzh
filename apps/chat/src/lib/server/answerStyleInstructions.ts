import { z } from 'zod'
import {
  ANSWER_STYLES,
  ANSWER_TONES,
  type AnswerStyle,
  type AnswerTone,
  DEFAULT_ANSWER_STYLE,
  DEFAULT_ANSWER_TONE,
} from '@/src/lib/config/answerStyles'
import { renderPromptTemplate } from '@/src/lib/server/promptTemplates'

/**
 * Request-body fields for the student's reading preferences. A missing,
 * stale, or unknown value falls back to the default instead of rejecting the
 * message.
 */
export const answerStyleSchema = z
  .enum(ANSWER_STYLES)
  .catch(DEFAULT_ANSWER_STYLE)

export const answerToneSchema = z.enum(ANSWER_TONES).catch(DEFAULT_ANSWER_TONE)

/**
 * Body of the student answer-preferences section, or null when both values
 * are the defaults so the default compiled prompt and its cache key stay
 * unchanged.
 */
export function answerStyleInstructions(
  answerStyle: AnswerStyle | undefined,
  answerTone: AnswerTone | undefined
): string | null {
  const style = answerStyle ?? DEFAULT_ANSWER_STYLE
  const tone = answerTone ?? DEFAULT_ANSWER_TONE
  if (style === DEFAULT_ANSWER_STYLE && tone === DEFAULT_ANSWER_TONE) {
    return null
  }

  return renderPromptTemplate('student-answer-style', {
    detailed: style === 'detailed',
    brief: style === 'brief',
    bullets: style === 'bullets',
    friendly: tone === 'friendly',
    direct: tone === 'direct',
  })
}
