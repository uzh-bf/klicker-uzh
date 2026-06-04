import { ObjectType } from '@klicker-uzh/prisma/client'
import { z } from 'zod'

export const objectActivityInput = z.object({
  objectId: z.string(),
  objectType: z.nativeEnum(ObjectType),
})

export const addActivityMessageInput = objectActivityInput.extend({
  message: z.string(),
})

export const activityLogEntryInput = z.object({
  id: z.number().int(),
})
