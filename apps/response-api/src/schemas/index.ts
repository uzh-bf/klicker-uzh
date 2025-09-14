import { z } from 'zod'

export const StandardResponseSchema = z.object({
  response: z.any(),
  liveQuizId: z.union([z.string(), z.number()]),
  instanceId: z.union([z.string(), z.number()]),
})

export type StandardResponseBody = z.infer<typeof StandardResponseSchema>

export const AssessmentResponseSchema = StandardResponseSchema.extend({
  correlationKey: z.string().min(1),
})

export type AssessmentResponseBody = z.infer<typeof AssessmentResponseSchema>
