import { z } from 'zod'

export const activityAnalyticsInput = z.object({
  activityId: z.string(),
})
