/**
 * Derived permission recomputation for Practice Quizzes in KlickerUZH:
 * - recomputePracticeQuizPermissions: dispatches to user/object variant.
 * - recomputePracticeQuizPermissionsUser: recompute derived permissions for a specific user.
 * - recomputePracticeQuizPermissionsObject: recompute derived permissions for all users.
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
 * Dispatch function for the recomputation of derived permissions for practice quizzes.
 *
 * Based on the provided parameters, this function delegates to either user-specific
 * or object-wide permission recomputation for practice quizzes.
 *
 * @param params - Object containing practice quiz ID and optional user ID
 * @param params.id - ID of the practice quiz
 * @param params.userId - Optional user ID to limit recomputation to a specific user
 * @param params.updateAccessRequests - Flag to update access requests for the object
 * @param prisma - Prisma transaction client for database operations
 */
export async function recomputePracticeQuizPermissions(
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
    return await recomputePracticeQuizPermissionsUser(
      { id, userId, updateAccessRequests },
      prisma
    )
  }

  // if the permission of a user group was modified or anything else, all derived permissions for the object need to be recomputed
  return await recomputePracticeQuizPermissionsObject(
    { id, updateAccessRequests },
    prisma
  )
}

/**
 * Recomputes derived permissions for a specific user on a practice quiz.
 *
 * This function removes any existing derived permission for the user and then
 * computes the highest granted permission level for that same user from the
 * following potential sources of access permissions:
 * - direct permission granted to the individual user
 * - direct permission granted to a user group the user is part of
 * - ownership of the practice quiz
 * - any derived permission granted to the individual user on a course that
 *   includes the considered practice quiz, according to the rules defined
 *   in the derived permission recomputation for live quizzes (see above).
 *
 * Additionally, a recomputation of the derived permissions on all elements
 * used in the activity is triggered.
 *
 * @param params - Object containing practice quiz ID and user ID
 * @param params.id - ID of the practice quiz
 * @param params.userId - ID of the user to recompute permissions for
 * @param params.updateAccessRequests - Flag to update access requests for the object
 * @param prisma - Prisma transaction client for database operations
 */
export async function recomputePracticeQuizPermissionsUser(
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
      practiceQuizId_userId: {
        practiceQuizId: id,
        userId,
      },
    },
  })

  // check for ownership, direct permissions, links to a course that would imply derived permissions
  const practiceQuiz = await prisma.practiceQuiz.findUnique({
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
      stacks: {
        include: {
          elements: true,
        },
      },
    },
  })

  // if the practice quiz does not exist, return
  if (!practiceQuiz) {
    return
  }

  // compute the derived permission level (maximum) for this user on the activity
  const res = getActivityPermissionsUser({
    activityOwnerId: practiceQuiz.ownerId,
    activityDeleted: practiceQuiz.isDeleted,
    userId,
    directPermissions: practiceQuiz.directPermissions,
    coursePermissions: practiceQuiz.course?.permissions ?? [],
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
          practiceQuizId_userId: {
            practiceQuizId: id,
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
          practiceQuiz: { connect: { id } },
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
        practiceQuizId_userId: {
          practiceQuizId: id,
          userId,
        },
      },
    })
  }

  // if the corresponding flag is set, update the access requests for the object
  if (updateAccessRequests) {
    await updateAccessRequestInstances(
      { practiceQuizId: id, userId, objectSoftDeleted: practiceQuiz.isDeleted },
      prisma
    )
  }

  // if the activity still exists and the user had ADMIN / OWNER permissions on it,
  // the derived element permissions need to be recomputed (-> complete recompute required)
  // users with lower permissions on the activity will never obtained derived permissions through it
  // --> however, since the computation is based on derived activity permissions, we need to compute these before
  await propagateActivityToElementsUser(
    { stacks: practiceQuiz.stacks, userId, updateAccessRequests },
    prisma
  )

  return
}

/**
 * Recomputes derived permissions for all users on a practice quiz.
 *
 * This function deletes all existing derived permissions for the practice quiz
 * and then recomputes them. Permissions are directly deduplicated for the
 * derived permissions table to only contain the highest permission level
 * for each user. The following sources for direct permissions on practice quizzes
 * are considered:
 * - direct permissions granted to users
 * - direct permissions granted to user groups
 * - ownership of the practice quiz
 * - derived permissions granted to users on a course that includes the considered
 *   practice quiz, according to the same rules as for the user-specific derived
 *   permissions recomputation for live quizzes (see above).
 *
 * Additionally, a recomputation of the derived permissions on all elements
 * used in the activity is triggered.
 *
 * @param params - Object containing practice quiz ID
 * @param params.id - ID of the practice quiz
 * @param params.updateAccessRequests - Flag to update access requests for the object
 * @param prisma - Prisma transaction client for database operations
 */
export async function recomputePracticeQuizPermissionsObject(
  { id, updateAccessRequests }: { id: string; updateAccessRequests: boolean },
  prisma: PrismaTransactionClient
) {
  // fetch the object and all direct permissions on it, including user groups, as well as activities the element is used in
  // permissions on the course should automatically imply corresponding permissions on the contained practice quizzes
  // depending on the permission level on the activity, derived permissions on the contained elements might be required
  const practiceQuiz = await prisma.practiceQuiz.findUnique({
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
      stacks: {
        include: {
          elements: true,
        },
      },
    },
  })

  if (!practiceQuiz) {
    console.error(
      `Practice quiz with id ${id} or corresponding owner not found`
    )
    return
  }

  // compute a map between all users with direct or direct access to the considered activity
  const userAccess = getActivityPermissionsObject({
    activityOwnerId: practiceQuiz.ownerId,
    activityDeleted: practiceQuiz.isDeleted,
    directPermissions: practiceQuiz.directPermissions,
    coursePermissions: practiceQuiz.course?.permissions ?? [],
  })

  // remove the derived permissions for all users that do not have access (anymore)
  await prisma.derivedPermission.deleteMany({
    where: {
      practiceQuizId: id,
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
            practiceQuizId_userId: {
              practiceQuizId: id,
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
            practiceQuiz: { connect: { id } },
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
      `Failed to update derived permissions for practice quiz (ID: ${practiceQuiz.id}): ${rejectedPromises
        .map((result) => result.reason?.message || 'Unknown error')
        .join(', ')}`
    )
  }

  // if the corresponding flag is set, update the access requests for the object
  if (updateAccessRequests) {
    await updateAccessRequestInstances(
      { practiceQuizId: id, objectSoftDeleted: practiceQuiz.isDeleted },
      prisma
    )
  }

  // recompute the derived permissions on all elements contained in this activity
  await propagateActivityToElements(
    { stacks: practiceQuiz.stacks, updateAccessRequests },
    prisma
  )
}
