/**
 * Derived permission recomputation for Live Quizzes in KlickerUZH.
 *
 * This module provides functions to recompute derived permissions for live quizzes.
 * It includes functions to dispatch to user-specific or object-wide permission
 * recomputation, as well as functions to recompute derived permissions for a
 * specific user or all users.
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
 * Dispatch function for the recomputation of derived permissions for live quizzes.
 *
 * Based on the provided parameters, this function delegates to either user-specific
 * or object-wide permission recomputation for live quizzes.
 *
 * @param params - Object containing live quiz ID and optional user ID
 * @param params.id - ID of the live quiz
 * @param params.userId - Optional user ID to limit recomputation to a specific user
 * @param params.updateAccessRequests - Flag to update access requests for the object
 * @param prisma - Prisma transaction client for database operations
 */
export async function recomputeLiveQuizPermissions(
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
    return await recomputeLiveQuizPermissionsUser(
      { id, userId, updateAccessRequests },
      prisma
    )
  }

  // if the permission of a user group was modified or anything else, all derived permissions for the object need to be recomputed
  return await recomputeLiveQuizPermissionsObject(
    { id, updateAccessRequests },
    prisma
  )
}

/**
 * Recomputes derived permissions for a specific user on a live quiz.
 *
 * This function removes any existing derived permission for the user and then
 * computes the highest granted permission level for that same user from the
 * following potential sources of access permissions:
 * - direct permission granted to the individual user
 * - direct permission granted to a user group the user is part of
 * - ownership of the live quiz
 * - any derived permission granted to the individual user on a course that
 *   includes the considered live quiz, according to the following rules.
 *   Additionally, the user can choose between awarding minimum required
 *   permissions or the propagation of the permissions (higher rights).
 *   READ on course --> READ on live quiz (min. required = propagated)
 *   WRITE on course --> READ / WRITE on live quiz (min. required / propagated)
 *   ADMIN on course --> ADMIN on live quiz (min. required = propagated)
 *   OWNER on course --> ADMIN on live quiz (min. required = propagated)
 *
 * Additionally, a recomputation of the derived permissions on all elements
 * used in the activity is triggered.
 *
 * @param params - Object containing live quiz ID and user ID
 * @param params.id - ID of the live quiz
 * @param params.userId - ID of the user to recompute permissions for
 * @param params.updateAccessRequests - Flag to update access requests for the object
 * @param prisma - Prisma transaction client for database operations
 */
export async function recomputeLiveQuizPermissionsUser(
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
      liveQuizId_userId: {
        liveQuizId: id,
        userId,
      },
    },
  })

  // check for ownership, direct permissions, links to a course that would imply derived permissions
  const liveQuiz = await prisma.liveQuiz.findUnique({
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
      // course from which derived permissions would be inherited
      course: {
        include: {
          permissions: {
            where: {
              userId,
            },
            include: {
              directPermission: true,
            },
          },
        },
      },
      // element instances (with elementId on them) contained in this quiz to propagate the derived permission update to elements
      blocks: {
        include: {
          elements: true,
        },
      },
    },
  })

  // if the live quiz does not exist, return
  if (!liveQuiz) {
    return
  }

  // compute the derived permission level (maximum) for this user on the activity
  const res = getActivityPermissionsUser({
    activityOwnerId: liveQuiz.ownerId,
    activityDeleted: liveQuiz.isDeleted,
    userId,
    directPermissions: liveQuiz.directPermissions,
    coursePermissions: liveQuiz.course?.permissions ?? [],
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
          liveQuizId_userId: {
            liveQuizId: id,
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
          liveQuiz: { connect: { id } },
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
        liveQuizId_userId: {
          liveQuizId: id,
          userId,
        },
      },
    })
  }

  // if the corresponding flag is set, update the access requests for the object
  if (updateAccessRequests) {
    await updateAccessRequestInstances(
      { liveQuizId: id, userId, objectSoftDeleted: liveQuiz.isDeleted },
      prisma
    )
  }

  // if the activity still exists and the user had ADMIN / OWNER permissions on it,
  // the derived element permissions need to be recomputed (-> complete recompute required)
  // users with lower permissions on the activity will never obtained derived permissions through it
  // --> however, since the computation is based on derived activity permissions, we need to compute these before
  await propagateActivityToElementsUser(
    { stacks: liveQuiz.blocks, userId, updateAccessRequests },
    prisma
  )

  return
}

/**
 * Recomputes derived permissions for all users on a live quiz.
 *
 * This function deletes all existing derived permissions for the live quiz
 * and then recomputes them. Permissions are directly deduplicated for the
 * derived permissions table to only contain the highest permission level
 * for each user. The following sources for direct permissions on live quizzes
 * are considered:
 * - direct permissions granted to users
 * - direct permissions granted to user groups
 * - ownership of the live quiz
 * - derived permissions granted to users on a course that includes the considered
 *   live quiz, according to the same rules as for the user-specific derived
 *   permissions recomputation for live quizzes (see above).
 *
 * Additionally, a recomputation of the derived permissions on all elements
 * used in the activity is triggered.
 *
 * @param params - Object containing live quiz ID
 * @param params.id - ID of the live quiz
 * @param params.updateAccessRequests - Flag to update access requests for the object
 * @param prisma - Prisma transaction client for database operations
 */
export async function recomputeLiveQuizPermissionsObject(
  { id, updateAccessRequests }: { id: string; updateAccessRequests: boolean },
  prisma: PrismaTransactionClient
) {
  // fetch the object and all direct permissions on it, including user groups, as well as activities the element is used in
  // permissions on the course should automatically imply corresponding permissions on the contained live quizzes
  // depending on the permission level on the activity, derived permissions on the contained elements might be required
  const liveQuiz = await prisma.liveQuiz.findUnique({
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
      // course from which derived permissions would be inherited
      course: {
        include: {
          permissions: {
            include: {
              directPermission: true,
            },
          },
        },
      },
      // element instances contained in the activity to propagate the derived permission update to elements
      blocks: {
        include: {
          elements: true,
        },
      },
    },
  })

  if (!liveQuiz) {
    console.error(`Live quiz with id ${id} or corresponding owner not found`)
    return
  }

  // compute a map between all users with direct or direct access to the considered activity
  const userAccess = getActivityPermissionsObject({
    activityOwnerId: liveQuiz.ownerId,
    activityDeleted: liveQuiz.isDeleted,
    directPermissions: liveQuiz.directPermissions,
    coursePermissions: liveQuiz.course?.permissions ?? [],
  })

  // remove the derived permissions for all users that do not have access (anymore)
  await prisma.derivedPermission.deleteMany({
    where: {
      liveQuizId: id,
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
            liveQuizId_userId: {
              liveQuizId: id,
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
            liveQuiz: { connect: { id } },
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
      `Failed to update derived permissions for live quiz (ID: ${liveQuiz.id}): ${rejectedPromises
        .map((result) => result.reason?.message || 'Unknown error')
        .join(', ')}`
    )
  }

  // if the corresponding flag is set, update the access requests for the object
  if (updateAccessRequests) {
    await updateAccessRequestInstances(
      { liveQuizId: id, objectSoftDeleted: liveQuiz.isDeleted },
      prisma
    )
  }

  // recompute the derived permissions on all elements contained in this activity
  await propagateActivityToElements(
    { stacks: liveQuiz.blocks, updateAccessRequests },
    prisma
  )
}
