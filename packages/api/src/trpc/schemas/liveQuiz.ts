import { z } from 'zod'

export const liveQuizIdInput = z.object({
  id: z.string(),
})

export const liveQuizBlockInput = z.object({
  quizId: z.string(),
  blockId: z.number().int(),
})
