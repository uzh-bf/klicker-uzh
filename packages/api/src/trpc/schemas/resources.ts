import { z } from 'zod'

export const singleAnswerCollectionInput = z.object({
  id: z.number().int(),
})
