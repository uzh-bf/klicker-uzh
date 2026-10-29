import {
  answerStyleSchema as hostAnswerStyleSchema,
  answerToneSchema as hostAnswerToneSchema,
} from '@klicker-uzh/chat-api/host/lib/server/answerStyleInstructions'
import { z } from 'zod'

export * from '@klicker-uzh/chat-api/host/lib/server/answerStyleInstructions'

// The legacy route composes Zod 3 schemas; the host still owns parsing policy.
export const answerStyleSchema = z
  .unknown()
  .transform((value) => hostAnswerStyleSchema.parse(value))
export const answerToneSchema = z
  .unknown()
  .transform((value) => hostAnswerToneSchema.parse(value))
