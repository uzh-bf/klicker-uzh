/**
 * Derived permission recomputation for Practice Quizzes in KlickerUZH:
 * - recomputePollPermissions: dispatches to user/object variant.
 * - recomputePollPermissionsUser: recompute derived permissions for a specific user.
 * - recomputePollPermissionsObject: recompute derived permissions for all users.
 */

import { type PrismaTransactionClient } from '../types.js'
import { updateAccessRequestInstances } from './accessRequest.js'
import {
  getActivityPermissionsObject,
  getActivityPermissionsUser,
  propagateActivityToElements,
  propagateActivityToElementsUser,
} from './util.js'

/**
 * Dispatch function for the recomputation of derived permissions for polls.
 *
 * Based on the provided parameters, this function delegates to either user-specific
 * or object-wide permission recomputation for polls.
 *
 * @param params - Object containing poll ID and optional user ID
 * @param params.id - ID of the poll
 * @param params.userId - Optional user ID to limit recomputation to a specific user
 * @param params.updateAccessRequests - Flag to update access requests for the object
 * @param prisma - Prisma transaction client for database operations
 */
export async function recomputePollPermissions(
  {
    id,
    userId,
    updateAccessRequests,
  }: {
    id: string
    userId?: string
    updateAccessRequests: boolean
  },
  prisma: PrismaTransactionClient
) {
  // if a user is defined, only recompute derived permissions for this user
  if (userId) {
    return await recomputePollPermissionsUser(
      { id, userId, updateAccessRequests },
      prisma
    )
  }

  // if the permission of a user group was modified or anything else, all derived permissions for the object need to be recomputed
  return await recomputePollPermissionsObject(
    { id, updateAccessRequests },
    prisma
  )
}

/**
 * Recomputes derived permissions for a specific user on a poll.
 *
 * This function removes any existing derived permission for the user and then
 * computes the highest granted permission level for that same user from the
 * following potential sources of access permissions:
 * - direct permission granted to the individual user
 * - direct permission granted to a user group the user is part of
 * - ownership of the poll
 * - any derived permission granted to the individual user on the course
 *
 * Additionally, a recomputation of the derived permissions on all elements
 * used in the activity is triggered.
 *
 * @param params - Object containing poll ID and user ID
 * @param params.id - ID of the poll
 * @param params.userId - ID of the user to recompute permissions for
 * @param params.updateAccessRequests - Flag to update access requests for the object
 * @param prisma - Prisma transaction client for database operations
 */
export async function recomputePollPermissionsUser(
  {
    id,
    userId,
    updateAccessRequests,
  }: { id: string; userId: string; updateAccessRequests: boolean },
  prisma: PrismaTransactionClient
) {
  // check if a permission for this user exists
  const existingPermission = await prisma.derivedPermission.findUnique({
    where: {
      pollId_userId: {
        pollId: id,
        userId,
      },
    },
  })

  // check for ownership or direct permissions
  const poll = await prisma.poll.findUnique({
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
      // element instances (with elementId on them) contained in this poll to propagate the derived permission update to elements
      stacks: {
        include: {
          elements: true,
        },
      },
    },
  })

  // if the poll does not exist, return
  if (!poll) {
    return
  }

  // compute the derived permission level (maximum) for this user on the activity
  const res = getActivityPermissionsUser({
    activityOwnerId: poll.ownerId,
    activityDeleted: poll.isDeleted,
    userId,
    directPermissions: poll.directPermissions,
    coursePermissions: [],
  })

  // if the user still has access, add a corresponding derived permission
  if (res !== null) {
    const { maxAccessLevel, parentPermissionId, derived } = res
    if (
      typeof maxAccessLevel !== 'undefined' &&
      (!existingPermission ||
        existingPermission.permissionLevel !== maxAccessLevel ||
        existingPermission.derived !== derived ||
        existingPermission.directPermissionId !== parentPermissionId)
    ) {
      await prisma.derivedPermission.upsert({
        where: {
          pollId_userId: {
            pollId: id,
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
          poll: { connect: { id } },
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
  }
  // if a derived permission exists, remove it
  else if (existingPermission && res === null) {
    await prisma.derivedPermission.delete({
      where: {
        pollId_userId: {
          pollId: id,
          userId,
        },
      },
    })
  }

  // if the corresponding flag is set, update the access requests for the object
  if (updateAccessRequests) {
    await updateAccessRequestInstances(
      { pollId: id, userId, objectSoftDeleted: poll.isDeleted },
      prisma
    )
  }

  // if the activity still exists and the user had ADMIN / OWNER permissions on it,
  // the derived element permissions need to be recomputed (-> complete recompute required)
  // users with lower permissions on the activity will never obtained derived permissions through it
  // --> however, since the computation is based on derived activity permissions, we need to compute these before
  await propagateActivityToElementsUser(
    { stacks: poll.stacks, userId, updateAccessRequests },
    prisma
  )

  return
}

/**
 * Recomputes derived permissions for all users on a poll.
 *
 * This function deletes all existing derived permissions for the poll
 * and then recomputes them. Permissions are directly deduplicated for the
 * derived permissions table to only contain the highest permission level
 * for each user. The following sources for direct permissions on polls
 * are considered:
 * - direct permissions granted to users
 * - direct permissions granted to user groups
 * - ownership of the poll
 * - derived permissions granted to users on the poll
 *
 * Additionally, a recomputation of the derived permissions on all elements
 * used in the activity is triggered.
 *
 * @param params - Object containing poll ID
 * @param params.id - ID of the poll
 * @param params.updateAccessRequests - Flag to update access requests for the object
 * @param prisma - Prisma transaction client for database operations
 */
export async function recomputePollPermissionsObject(
  { id, updateAccessRequests }: { id: string; updateAccessRequests: boolean },
  prisma: PrismaTransactionClient
) {
  // fetch the object and all direct permissions on it, including user groups, as well as activities the element is used in
  // permissions on the course should automatically imply corresponding permissions on the contained polls
  // depending on the permission level on the activity, derived permissions on the contained elements might be required
  const poll = await prisma.poll.findUnique({
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
      // element instances contained in the activity to propagate the derived permission update to elements
      stacks: {
        include: {
          elements: true,
        },
      },
    },
  })

  if (!poll) {
    console.error(`Poll with id ${id} or corresponding owner not found`)
    return
  }

  // compute a map between all users with direct or direct access to the considered activity
  const userAccess = getActivityPermissionsObject({
    activityOwnerId: poll.ownerId,
    activityDeleted: poll.isDeleted,
    directPermissions: poll.directPermissions,
    coursePermissions: [],
  })

  // remove the derived permissions for all users that do not have access (anymore)
  await prisma.derivedPermission.deleteMany({
    where: {
      pollId: id,
      userId: {
        notIn: Object.keys(userAccess),
      },
    },
  })

  // create / update derived permissions for each user with access
  const results = await Promise.allSettled(
    Object.entries(userAccess).map(
      async ([userId, { maxAccessLevel, parentPermissionId, derived }]) =>
        await prisma.derivedPermission.upsert({
          where: {
            pollId_userId: {
              pollId: id,
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
            poll: { connect: { id } },
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
      `Failed to update derived permissions for poll (ID: ${poll.id}): ${rejectedPromises
        .map((result) => result.reason?.message || 'Unknown error')
        .join(', ')}`
    )
  }

  // if the corresponding flag is set, update the access requests for the object
  if (updateAccessRequests) {
    await updateAccessRequestInstances(
      { pollId: id, objectSoftDeleted: poll.isDeleted },
      prisma
    )
  }

  // recompute the derived permissions on all elements contained in this activity
  await propagateActivityToElements(
    { stacks: poll.stacks, updateAccessRequests },
    prisma
  )
}
