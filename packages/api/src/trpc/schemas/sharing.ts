import {
  ObjectAccess,
  ObjectType,
  PermissionLevel,
} from '@klicker-uzh/prisma/client'
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

export const catalogCollectionInput = z.object({
  catalogCollectionId: z.string().nullish(),
})

export const catalogObjectActionInput = objectActivityInput.extend({
  catalogCollectionId: z.string().nullish(),
})

export const requestCatalogObjectInput = catalogObjectActionInput.extend({
  requestedPermissionLevel: z.nativeEnum(PermissionLevel).nullish(),
})

export const requestCatalogCollectionInput = z.object({
  catalogCollectionId: z.string(),
  requestedPermissionLevel: z.nativeEnum(PermissionLevel).nullish(),
})

export const createCatalogCollectionInput = z.object({
  name: z.string(),
  access: z.nativeEnum(ObjectAccess),
})

export const catalogCollectionNameInput = z.object({
  catalogCollectionId: z.string(),
  name: z.string(),
})

export const catalogCollectionAccessInput = z.object({
  catalogCollectionId: z.string(),
  access: z.nativeEnum(ObjectAccess),
})

export const catalogObjectAccessInput = z.object({
  assignmentId: z.number().int(),
  access: z.nativeEnum(ObjectAccess),
})

export const addObjectToCatalogInput = objectActivityInput.extend({
  access: z.nativeEnum(ObjectAccess),
  catalogCollectionId: z.string().nullish(),
})

export const removeCatalogObjectAssignmentInput = z.object({
  assignmentId: z.number().int(),
})

export const deleteCatalogCollectionInput = z.object({
  catalogCollectionId: z.string(),
})
