import { z } from 'zod'

export const activityAnalyticsInput = z.object({
  activityId: z.string(),
})

export const courseAnalyticsInput = z.object({
  courseId: z.string(),
})
