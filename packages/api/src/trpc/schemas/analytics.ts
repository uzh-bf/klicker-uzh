import { z } from 'zod'

export const activityAnalyticsInput = z.object({
  activityId: z.string(),
})

export const courseAnalyticsInput = z.object({
  courseId: z.string(),
})

export const activityEvaluationInput = z.object({
  id: z.string(),
})

export const liveQuizEvaluationInput = activityEvaluationInput.extend({
  hmac: z.string().nullish(),
})
