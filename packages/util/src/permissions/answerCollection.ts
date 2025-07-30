/**
 * Derived permission recomputation for Answer Collections in KlickerUZH:
 * - recomputeAnswerCollectionPermissions: dispatches to user/object variant.
 * - recomputeAnswerCollectionPermissionsUser: recompute derived permissions for a single user.
 * - recomputeAnswerCollectionPermissionsObject: recompute derived permissions for all users.
 */
import * as DB from '@klicker-uzh/prisma'
import { type PrismaTransactionClient } from '../types.js'
import { updateAccessRequestInstances } from './accessRequest.js'
import { type UserAccessMap } from './constants.js'
import { getMaxAccessLevelCombined } from './util.js'

/**
 * Recomputes derived permissions for all users on an answer collection.
 *
 * This function deletes all existing derived permissions for the answer collection
 * and then recomputes them. Permissions are directly deduplicated for the derived
 * permissions table to only contain the highest permission level for each user.
 * The following sources for direct permissions on answer collections are considered:
 * - direct permissions granted to users
 * - direct permissions granted to user groups
 * - ownership of the answer collection
 * - derived permissions granted to users on linked elements
 *   (selection / case study element --> READ permissions)
 * - derived permissions granted to users on linked activity templates
 *   (--> READ permissions)
 *
 * @param params - Object containing answer collection ID
 * @param params.id - ID of the answer collection
 * @param params.updateAccessRequests - Flag to update access requests for the object
 * @param prisma - Prisma transaction client for database operations
 */
export async function recomputeAnswerCollectionPermissionsObject(
  { id, updateAccessRequests }: { id: number; updateAccessRequests: boolean },
  prisma: PrismaTransactionClient
) {
  // fetch the object and all direct permissions on it, including user groups
  const answerCollection = await prisma.answerCollection.findUnique({
    where: {
      id,
    },
    include: {
      directPermissions: {
        include: {
          userGroup: {
            include: {
              members: true,
              admins: true,
            },
          },
        },
      },
      linkedElements: {
        include: {
          permissions: true, // derived permissions - linked to users with access to element
        },
      },
      linkedTemplates: {
        include: {
          // derived permissions - linked to users with access to activity template
          liveQuiz: { include: { permissions: true } },
          practiceQuiz: { include: { permissions: true } },
          microLearning: { include: { permissions: true } },
          groupActivity: { include: { permissions: true } },
        },
      },
    },
  })

  if (!answerCollection) {
    console.error(`Answer collection with id ${id} not found`)
    return
  }

  // determine the access map based on ownership and direct permissions
  const directUserAccess = getMaxAccessLevelCombined({
    directPermissions: answerCollection.directPermissions,
    objectDeleted: answerCollection.isDeleted,
    ownerId: answerCollection.ownerId,
  })

  // extend the user access map based on direct permissions with derived permissions from linked elements
  const extendedUserAccess1 =
    answerCollection.linkedElements.length > 0
      ? answerCollection.linkedElements.reduce<UserAccessMap>(
          (acc, linkedElement) => {
            // iterate over the derived permissions on the linked element and grant corresponding derived permissions
            // for answer collections: permission level on parent element does not matter -> READ permissions on answer collection
            // (no override of existing permissions required -> new permission could only be equivalent or smaller)
            for (const permission of linkedElement.permissions) {
              if (typeof acc[permission.userId] === 'undefined') {
                acc[permission.userId] = {
                  maxAccessLevel: DB.PermissionLevel.READ,
                  parentPermissionId:
                    permission.directPermissionId ?? undefined,
                  derived: true,
                }
              }
            }

            return acc
          },
          {
            ...directUserAccess,
          }
        )
      : directUserAccess

  // extend the user access map based on direct permissions with derived permissions from linked elements
  const extendedUserAccess2 =
    answerCollection.linkedTemplates.length > 0
      ? answerCollection.linkedTemplates.reduce<UserAccessMap>(
          (acc, linkedTemplate) => {
            // iterate over the derived permissions on the linked template and grant corresponding derived permissions
            // for answer collections: permission level on parent element does not matter -> READ permissions on answer collection
            // (no override of existing permissions required -> new permission could only be equivalent or smaller)
            const permissions =
              linkedTemplate.liveQuiz?.permissions ??
              linkedTemplate.practiceQuiz?.permissions ??
              linkedTemplate.microLearning?.permissions ??
              linkedTemplate.groupActivity?.permissions ??
              []

            for (const permission of permissions) {
              if (typeof acc[permission.userId] === 'undefined') {
                acc[permission.userId] = {
                  maxAccessLevel: DB.PermissionLevel.READ,
                  parentPermissionId:
                    permission.directPermissionId ?? undefined,
                  derived: true,
                }
              }
            }

            return acc
          },
          {
            ...extendedUserAccess1,
          }
        )
      : extendedUserAccess1

  // remove the derived permissions for all users that do not have access (anymore)
  await prisma.derivedPermission.deleteMany({
    where: {
      answerCollectionId: id,
      userId: {
        notIn: Object.keys(extendedUserAccess2),
      },
    },
  })

  // create / update derived permissions for each user with access
  const results = await Promise.allSettled(
    Object.entries(extendedUserAccess2).map(
      async ([userId, { maxAccessLevel, parentPermissionId, derived }]) =>
        await prisma.derivedPermission.upsert({
          where: {
            answerCollectionId_userId: {
              answerCollectionId: id,
              userId,
            },
          },
          create: {
            permissionLevel: maxAccessLevel,
            derived,
            directPermission:
              typeof parentPermissionId !== 'undefined'
                ? { connect: { id: parentPermissionId } }
                : undefined,
            answerCollection: { connect: { id } },
            user: { connect: { id: userId } },
          },
          update: {
            permissionLevel: maxAccessLevel,
            derived,
            directPermission:
              typeof parentPermissionId !== 'undefined'
                ? { connect: { id: parentPermissionId } }
                : { disconnect: true },
          },
        })
    )
  )

  // check if any promise was rejected and throw an error
  const rejectedPromises = results.filter(
    (result): result is PromiseRejectedResult => result.status === 'rejected'
  )
  if (rejectedPromises.length > 0) {
    throw new Error(
      `Failed to update derived permissions for answer collection (ID: ${answerCollection.id}): ${rejectedPromises
        .map((result) => result.reason?.message || 'Unknown error')
        .join(', ')}`
    )
  }

  // if the corresponding flag is set, update the access requests for the object
  if (updateAccessRequests) {
    await updateAccessRequestInstances(
      { answerCollectionId: id, objectSoftDeleted: answerCollection.isDeleted },
      prisma
    )
  }
}
