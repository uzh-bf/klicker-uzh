/**
 * Derived permission recomputation for knowledge bases.
 */
import * as DB from '@klicker-uzh/prisma/client'
import type { PrismaTransactionClient } from '../types.js'
import {
  recomputeSharedObjectPermissionsObject,
  recomputeSharedObjectPermissionsUser,
  sharedObjectDirectPermissionWhere,
  sharedObjectUserPermissionWhere,
} from './objectSharing.js'

const kbObjectType = DB.ObjectType.KB

export async function recomputeKBPermissions(
  { id, userId }: { id: string; userId?: string },
  prisma: PrismaTransactionClient
) {
  if (userId) {
    return await recomputeKBPermissionsUser({ id, userId }, prisma)
  }

  return await recomputeKBPermissionsObject({ id }, prisma)
}

export async function recomputeKBPermissionsUser(
  { id, userId }: { id: string; userId: string },
  prisma: PrismaTransactionClient
) {
  const kb = await prisma.kB.findUnique({
    where: { id },
    include: {
      directPermissions: {
        where: sharedObjectUserPermissionWhere(userId),
      },
    },
  })

  if (!kb) return

  await recomputeSharedObjectPermissionsUser(
    {
      identity: { objectType: kbObjectType, objectId: id },
      grants: {
        ownerId: kb.ownerId,
        deletedAt: kb.deletedAt,
        directPermissions: kb.directPermissions,
      },
      userId,
    },
    prisma
  )
}

export async function recomputeKBPermissionsObject(
  { id }: { id: string },
  prisma: PrismaTransactionClient
) {
  const kb = await prisma.kB.findUnique({
    where: { id },
    include: {
      directPermissions: {
        where: sharedObjectDirectPermissionWhere(),
        include: {
          userGroup: {
            include: {
              members: true,
              admins: true,
            },
          },
        },
      },
    },
  })

  if (!kb) return

  await recomputeSharedObjectPermissionsObject(
    {
      identity: { objectType: kbObjectType, objectId: id },
      grants: {
        ownerId: kb.ownerId,
        deletedAt: kb.deletedAt,
        directPermissions: kb.directPermissions,
      },
    },
    prisma
  )
}
