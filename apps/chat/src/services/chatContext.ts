import type { KlickerChatContext } from '@klicker-uzh/types'
import { z } from 'zod'

const MAX_PREVIEW_LENGTH = 500

const chatContextSchema = z.object({
  version: z.literal(1),
  source: z.literal('pwa'),
  surface: z.enum([
    'course-home',
    'practice-quiz',
    'live-quiz',
    'microlearning',
  ]),
  locale: z.string().min(2).max(16),
  courseId: z.string().min(1).max(128),
  activity: z
    .object({
      type: z.enum(['practiceQuiz', 'liveQuiz', 'microLearning']),
      id: z.string().min(1).max(128),
      displayName: z.string().min(1).max(160).optional(),
    })
    .optional(),
  question: z
    .object({
      stackId: z.string().min(1).max(128).optional(),
      elementInstanceId: z.number().int().optional(),
      type: z.string().min(1).max(64).optional(),
      contentPreview: z.string().min(1).max(MAX_PREVIEW_LENGTH).optional(),
      currentStep: z.number().int().min(0).optional(),
      totalSteps: z.number().int().min(0).optional(),
    })
    .optional(),
})

export function sanitizeKlickerChatContext(
  value: unknown
): KlickerChatContext | null {
  const parsed = chatContextSchema.safeParse(value)
  if (!parsed.success) return null
  return parsed.data
}

export function formatKlickerChatContextForPrompt(value: unknown): string {
  const context = sanitizeKlickerChatContext(value)
  if (!context) return ''

  const lines = [
    'Current KlickerUZH page context. This context is answer-safe and contains only page metadata plus a question text preview.',
    `Surface: ${context.surface}`,
    `Course ID: ${context.courseId}`,
  ]

  if (context.activity) {
    const displayName = context.activity.displayName
      ? ` "${context.activity.displayName}"`
      : ''
    lines.push(`Activity: ${context.activity.type}${displayName}`)
  }

  if (context.question) {
    const { currentStep, totalSteps } = context.question
    if (currentStep != null && totalSteps != null && totalSteps > 0) {
      lines.push(`Question: step ${currentStep} of ${totalSteps}`)
    }
    if (context.question.type) {
      lines.push(`Question type: ${context.question.type}`)
    }
    if (context.question.contentPreview) {
      lines.push(`Question preview: ${context.question.contentPreview}`)
    }
  }

  return lines.join('\n')
}

export function getKlickerChatContextLabel(
  context: KlickerChatContext | null
): string | null {
  if (!context) return null

  const surfaceLabel =
    context.surface === 'practice-quiz'
      ? 'Practice quiz'
      : context.surface === 'course-home'
        ? 'Course'
        : context.surface === 'live-quiz'
          ? 'Live quiz'
          : 'Microlearning'

  const { currentStep, totalSteps } = context.question ?? {}
  if (currentStep != null && totalSteps != null && totalSteps > 0) {
    return `${surfaceLabel} - Question ${currentStep}/${totalSteps}`
  }

  return surfaceLabel
}
