import { z } from 'zod'

export const elementIdInput = z.object({
  id: z.number().int(),
})

export const editTagInput = z.object({
  id: z.number().int(),
  name: z.string(),
})

export const tagOrderingInput = z.object({
  originIx: z.number().int(),
  targetIx: z.number().int(),
})
