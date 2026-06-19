import { z } from 'zod'

export const liveQuizIdInput = z.object({
  id: z.string(),
})

export const liveQuizBlockInput = z.object({
  quizId: z.string(),
  blockId: z.number().int(),
})

export const liveQuizSettingsInput = z.object({
  id: z.string(),
  isLiveQAEnabled: z.boolean().optional(),
  isConfusionFeedbackEnabled: z.boolean().optional(),
  isModerationEnabled: z.boolean().optional(),
})

export const liveQuizFeedbackPublicationInput = z.object({
  id: z.number().int(),
  liveQuizId: z.string(),
  isPublished: z.boolean(),
})

export const liveQuizFeedbackPinInput = z.object({
  id: z.number().int(),
  liveQuizId: z.string(),
  isPinned: z.boolean(),
})

export const liveQuizFeedbackResolveInput = z.object({
  id: z.number().int(),
  liveQuizId: z.string(),
  isResolved: z.boolean(),
})

export const liveQuizFeedbackIdInput = z.object({
  id: z.number().int(),
  liveQuizId: z.string(),
})

export const liveQuizFeedbackResponseInput = z.object({
  id: z.number().int(),
  liveQuizId: z.string(),
  responseContent: z.string(),
})
