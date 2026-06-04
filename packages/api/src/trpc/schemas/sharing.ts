import { ObjectType, PermissionLevel } from '@klicker-uzh/prisma/client'
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

export const derivedPermissionOriginInput = z.object({
  id: z.number().int(),
})

export const shareObjectInput = objectActivityInput.extend({
  permissionLevel: z.nativeEnum(PermissionLevel),
  shortnameOrEmail: z.string().nullish(),
  userGroupId: z.number().int().nullish(),
  propagation: z.boolean(),
})

export const changePermissionLevelInput = objectActivityInput.extend({
  permissionId: z.number().int(),
  permissionLevel: z.nativeEnum(PermissionLevel),
  propagation: z.boolean(),
})

export const revokeObjectAccessInput = objectActivityInput.extend({
  permissionId: z.number().int(),
})

export const transferObjectOwnershipInput = objectActivityInput.extend({
  shortnameOrEmail: z.string(),
})

export const sharingRequestInput = z.object({
  requestId: z.number().int(),
  userId: z.string(),
})

export const approveObjectSharingRequestInput = sharingRequestInput.extend({
  permissionLevel: z.nativeEnum(PermissionLevel),
  propagation: z.boolean(),
})
