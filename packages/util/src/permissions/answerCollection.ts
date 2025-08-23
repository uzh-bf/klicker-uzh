/**
 * Derived permission recomputation for Answer Collections in KlickerUZH:
 * - recomputeAnswerCollectionPermissions: dispatches to user/object variant.
 * - recomputeAnswerCollectionPermissionsUser: recompute derived permissions for a single user.
 * - recomputeAnswerCollectionPermissionsObject: recompute derived permissions for all users.
 */
import * as DB from '@klicker-uzh/prisma/client'
import { type PrismaTransactionClient } from '../types.js'
import { updateAccessRequestInstances } from './accessRequest.js'
import { inversePermissionLevelMap, type UserAccessMap } from './constants.js'
import {
  getMaxAccessLevelCombined,
  getMaxAccessLevelIndividual,
} from './util.js'

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
    updateAccessRequests,
  }: { id: number; userId?: string; updateAccessRequests: boolean },
  prisma: PrismaTransactionClient
) {
  // if a user is defined, only recompute derived permissions for this user
  if (userId) {
    return await recomputeAnswerCollectionPermissionsUser(
      { id, userId, updateAccessRequests },
      prisma
    )
  }

  // if the permission of a user group was modified or anything else, all derived permissions for the object need to be recomputed
  return await recomputeAnswerCollectionPermissionsObject(
    { id, updateAccessRequests },
    prisma
  )
}

/**
 * Recomputes derived permissions for a specific user on an answer collection.
 *
 * This function removes any existing derived permission for the user and then
 * computes the highest granted permission level for that same user from the
 * following potential sources of access permissions:
 * - direct permission granted to the individual user
 * - direct permission granted to a user group the user is part of
 * - ownership of the answer collection
 * - any derived permission granted to the individual user on an element that is
 *   linked to the answer collection (selection / case study question)
 *   --> READ permissions on the answer collection
 * - any derived permission granted to the individual user on an activity template
 *   that is linked to the answer collection
 *   --> READ permissions on the answer collection
 *
 * @param params - Object containing answer collection ID and user ID
 * @param params.id - ID of the answer collection
 * @param params.userId - ID of the user to recompute permissions for
 * @param params.updateAccessRequests - Flag to update access requests for the object
 * @param prisma - Prisma transaction client for database operations
 */
export async function recomputeAnswerCollectionPermissionsUser(
  {
    id,
    userId,
    updateAccessRequests,
  }: { id: number; userId: string; updateAccessRequests: boolean },
  prisma: PrismaTransactionClient
) {
  // check if a permission for this user exists
  const existingPermission = await prisma.derivedPermission.findUnique({
    where: {
      answerCollectionId_userId: {
        answerCollectionId: id,
        userId,
      },
    },
  })

  // check for ownership, direct permissions or links to other objects that would imply derived permissions
  const answerCollection = await prisma.answerCollection.findUnique({
    where: {
      id,
    },
    include: {
      directPermissions: {
        where: {
          OR: [
            { userId },
            {
              userGroup: {
                OR: [
                  { ownerId: userId },
                  { members: { some: { id: userId } } },
                  { admins: { some: { id: userId } } },
                ],
              },
            },
          ],
        },
      },
      linkedElements: {
        where: { permissions: { some: { userId } } },
        include: { permissions: { where: { userId } } },
      },
      linkedTemplates: {
        where: {
          OR: [
            {
              liveQuiz: { permissions: { some: { userId } } },
              practiceQuiz: { permissions: { some: { userId } } },
              microLearning: { permissions: { some: { userId } } },
              groupActivity: { permissions: { some: { userId } } },
            },
          ],
        },
        include: {
          liveQuiz: { include: { permissions: { where: { userId } } } },
          practiceQuiz: { include: { permissions: { where: { userId } } } },
          microLearning: { include: { permissions: { where: { userId } } } },
          groupActivity: { include: { permissions: { where: { userId } } } },
        },
      },
    },
  })

  // if the answer collection does not exist, return
  if (!answerCollection) {
    return
  }

  // determine the maximum access level of the user
  let maxAccessLevel: DB.PermissionLevel | undefined = undefined
  let parentPermissionId: number | undefined = undefined
  let derived = false

  // if user is answer collection owner, set the corresponding permission
  if (answerCollection.ownerId === userId && !answerCollection.isDeleted) {
    maxAccessLevel = DB.PermissionLevel.OWNER
  }
  // if the user has a direct permission or a derived access, use this case
  else if (
    answerCollection.directPermissions.length > 0 ||
    answerCollection.linkedElements.length > 0 ||
    answerCollection.linkedTemplates.length > 0
  ) {
    // if the object is soft-deleted, not direct permissions are valid anymore
    if (
      answerCollection.directPermissions.length > 0 &&
      !answerCollection.isDeleted
    ) {
      // determine the highest available direct permission level
      const { maxDirectPermission, directPermissionId } =
        getMaxAccessLevelIndividual({
          directPermissions: answerCollection.directPermissions,
        })

      maxAccessLevel = inversePermissionLevelMap[maxDirectPermission]
      parentPermissionId = directPermissionId
    }
    // if the user does not have direct access to the answer collection, but has access to linked elements -> derived permission
    // if direct access was granted, inherited permissions do not need to be considered -> can only be READ level for answer collections
    else if (
      typeof maxAccessLevel === 'undefined' &&
      answerCollection.linkedElements.length > 0 &&
      typeof answerCollection.linkedElements[0] !== 'undefined'
    ) {
      const element = answerCollection.linkedElements[0]!

      // if the user has more than one derived permission on the linked element, something went wrong
      if (element.permissions.length !== 1) {
        throw new Error(
          `More or less than one derived permission found for answer collection ${id} (id) and a single user ${userId} (id).`
        )
      }

      // use the permission of the linked element to set the derived permission
      const permissionLinkedElement = element.permissions[0]
      maxAccessLevel = DB.PermissionLevel.READ // derived permissions on answer collections are always on read level
      parentPermissionId =
        permissionLinkedElement?.directPermissionId ?? undefined
      derived = true // permission was derived from another element
    }
    // derived permissions based on template usage
    else if (
      typeof maxAccessLevel === 'undefined' &&
      answerCollection.linkedTemplates.length > 0 &&
      typeof answerCollection.linkedTemplates[0] !== 'undefined'
    ) {
      const template = answerCollection.linkedTemplates[0]!
      const permissions =
        template.liveQuiz?.permissions ??
        template.practiceQuiz?.permissions ??
        template.microLearning?.permissions ??
        template.groupActivity?.permissions ??
        []

      // if the user has more than one derived permission on the linked template, something went wrong
      if (permissions.length !== 1) {
        throw new Error(
          `More or less than one derived permission found for tmeplate ${template.id} (id) and a single user ${userId} (id).`
        )
      }

      const permissionLinkedTemplate = permissions[0]
      maxAccessLevel = DB.PermissionLevel.READ // derived permissions on answer collections are always on read level
      parentPermissionId =
        permissionLinkedTemplate?.directPermissionId ?? undefined
      derived = true // permission was derived from another element
    }
  }

  // if the user still has access, add a corresponding derived permission
  if (
    typeof maxAccessLevel !== 'undefined' &&
    (!existingPermission ||
      existingPermission.permissionLevel !== maxAccessLevel ||
      existingPermission.derived !== derived ||
      existingPermission.directPermissionId !== parentPermissionId)
  ) {
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
  }
  // if a derived permission exists, remove it
  else if (existingPermission && typeof maxAccessLevel === 'undefined') {
    await prisma.derivedPermission.delete({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: id,
          userId,
        },
      },
    })
  }

  // if the corresponding flag is set, update the access requests for the object
  if (updateAccessRequests) {
    await updateAccessRequestInstances(
      {
        answerCollectionId: id,
        userId,
        objectSoftDeleted: answerCollection.isDeleted,
      },
      prisma
    )
  }

  return
}

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
