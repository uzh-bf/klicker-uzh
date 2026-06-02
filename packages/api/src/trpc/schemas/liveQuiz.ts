import { z } from 'zod'

export const liveQuizIdInput = z.object({
  id: z.string(),
})
