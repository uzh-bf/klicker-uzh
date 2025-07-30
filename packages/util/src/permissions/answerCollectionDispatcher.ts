// TODO: include all disptcher functions here that create the initial required hatchet tasks based on the passed parameters

import { type HatchetClient } from '@hatchet-dev/typescript-sdk'
import * as DB from '@klicker-uzh/prisma'
import { type PrismaTransactionClient } from '../types.js'
import {
  recomputeAnswerCollectionPermissionsObject,
  recomputeAnswerCollectionPermissionsUser,
} from './answerCollection.js'

/**
 * Dispatch function for the recomputation of derived permissions for answer collections.
 *
 * Based on the provided parameters, this function delegates to either user-specific
 * or object-wide permission recomputation for answer collections.
 *
 * @param params - Object containing answer collection ID and optional user ID
 * @param params.id - ID of the answer collection
 * @param params.userId - ID of the user to recompute permissions for
 * @param params.updateAccessRequests - Flag to update access requests for the object
 * @param prisma - Prisma transaction client for database operations
 */
export async function recomputeAnswerCollectionPermissions(
  {
    id,
    userId,
    directPermissionId,
    updateAccessRequests,
    ownerPermission,
  }: {
    id: number
    userId?: string
    directPermissionId?: number
    updateAccessRequests: boolean
    ownerPermission: boolean
  },
  prisma: PrismaTransactionClient,
  hatchet: HatchetClient
) {
  // ! CASE 1: single user permissions recomputation and ownership flag
  // if a user is defined and the user should be the owner, the derived ownership permission should be created directly
  if (userId && ownerPermission) {
    // fetch the object and verify that the user is the owner
    const answerCollection = await prisma.answerCollection.findUnique({
      where: { id, ownerId: userId },
    })

    if (!answerCollection) {
      return
    }

    // create derived ownership permission directly
    await prisma.derivedPermission.upsert({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: id,
          userId,
        },
      },
      create: {
        answerCollection: { connect: { id } },
        user: { connect: { id: userId } },
        permissionLevel: DB.PermissionLevel.OWNER,
      },
      update: { permissionLevel: DB.PermissionLevel.OWNER },
    })

    return
  }

  // ! CASE 2: single user permission recomputation (without ownership flag)
  // if only a user is defined, only recompute derived permissions for this user
  else if (userId) {
    // set up a pending permission entry for the user and answer collection
    // const pendingPermission = await prisma.pendingPermissionEntry.upsert({
    //   where: {},
    // })

    // TODO: REPLACE THIS WITH CREATION OF SINGLE HATCHET TASK FOR INDIVIDUAL USER PERMISSION
    return await recomputeAnswerCollectionPermissionsUser(
      { id, userId, updateAccessRequests },
      prisma
    )
  }

  // ! CASE 3: complete recomputation of all derived permissions for the object
  // TODO: REPLACE THIS WITH CREATION OF MULTIPLE HATCHET TASKS FOR OBJECT PERMISSIONS
  // if the permission of a user group was modified or anything else, all derived permissions for the object need to be recomputed
  return await recomputeAnswerCollectionPermissionsObject(
    { id, updateAccessRequests },
    prisma
  )
}
