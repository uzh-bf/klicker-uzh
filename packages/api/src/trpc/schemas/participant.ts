import { z } from 'zod'

export const participantSelfInput = z
  .object({
    liveQuizId: z.string().nullish(),
  })
  .optional()
