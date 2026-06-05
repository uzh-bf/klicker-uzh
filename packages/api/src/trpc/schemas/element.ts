import { z } from 'zod'

export const elementIdInput = z.object({
  id: z.number().int(),
})
