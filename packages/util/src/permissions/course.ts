/**
 * Derived permission recomputation for Courses in KlickerUZH:
 * - recomputeCoursePermissions: dispatches to user/object variant.
 * - recomputeCoursePermissionsUser: recompute derived permissions for a specific user.
 * - recomputeCoursePermissionsObject: recompute derived permissions for all users.
 */

import * as DB from '@klicker-uzh/prisma/client'
import { type PrismaTransactionClient } from '../types.js'
import { updateAccessRequestInstances } from './accessRequest.js'
import { inversePermissionLevelMap } from './constants.js'
import {
  recomputeGroupActivityPermissionsObject,
  recomputeGroupActivityPermissionsUser,
} from './groupActivity.js'
import {
  recomputeLiveQuizPermissionsObject,
  recomputeLiveQuizPermissionsUser,
} from './liveQuiz.js'
import {
  recomputeMicroLearningPermissionsObject,
  recomputeMicroLearningPermissionsUser,
} from './microlearning.js'
import {
  recomputePracticeQuizPermissionsObject,
  recomputePracticeQuizPermissionsUser,
} from './practiceQuiz.js'
import {
  getMaxAccessLevelCombined,
  getMaxAccessLevelIndividual,
} from './util.js'

// #region
/**
 * Dispatch function for the recomputation of derived permissions for courses.
 *
 * Based on the provided parameters, this function delegates to either user-specific
 * or object-wide permission recomputation for courses.
 *
 * @param params - Object containing course ID and optional user ID
 * @param params.id - ID of the course
 * @param params.userId - Optional user ID to limit recomputation to a specific user
 * @param params.updateAccessRequests - Flag to update access requests for the object
 * @param prisma - Prisma transaction client for database operations
 */
export async function recomputeCoursePermissions(
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
    return await recomputeCoursePermissionsUser(
      { id, userId, updateAccessRequests },
      prisma
    )
  }

  // if the permission of a user group was modified or anything else, all derived permissions for the object need to be recomputed
  return await recomputeCoursePermissionsObject(
    { id, updateAccessRequests },
    prisma
  )
}

/**
 * Recomputes derived permissions for a specific user on a course.
 *
 * This function removes any existing derived permission for the user and then
 * computes the highest granted permission level for that same user from the
 * following potential sources of access permissions:
 * - direct permission granted to the individual user
 * - direct permission granted to a user group the user is part of
 * - ownership of the course
 *
 * Additionally, a recomputation of the derived permissions on all activities
 * contained in the course is triggered (recursively also affecting contained
 * elements and resources)
 *
 * @param params - Object containing course ID and user ID
 * @param params.id - ID of the course
 * @param params.userId - ID of the user to recompute permissions for
 * @param params.updateAccessRequests - Flag to update access requests for the object
 * @param prisma - Prisma transaction client for database operations
 */
export async function recomputeCoursePermissionsUser(
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
      courseId_userId: {
        courseId: id,
        userId,
      },
    },
  })

  // check if the user has a direct permission or ownership on the course and fetch all linked activities for dependency updates
  const course = await prisma.course.findUnique({
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
      // activities in course that inherit permissions from it
      liveQuizzes: true,
      practiceQuizzes: true,
      microLearnings: true,
      groupActivities: true,
    },
  })

  // if the course does not exist, return
  if (!course) {
    return
  }

  // determine the maximum access level of the user
  let maxAccessLevel: DB.PermissionLevel | undefined = undefined
  let parentPermissionId: number | undefined = undefined
  let derived = false

  if (!course.isDeleted && course.ownerId === userId) {
    maxAccessLevel = DB.PermissionLevel.OWNER
  } else if (!course.isDeleted && course.directPermissions.length > 0) {
    // determine the highest available direct permission level (groups and individual direct permissions)
    const { maxDirectPermission, directPermissionId } =
      getMaxAccessLevelIndividual({
        directPermissions: course.directPermissions,
      })

    maxAccessLevel = inversePermissionLevelMap[maxDirectPermission]
    parentPermissionId = directPermissionId
  }

  // if the user has access, add a corresponding derived permission
  if (
    typeof maxAccessLevel !== 'undefined' &&
    (!existingPermission ||
      existingPermission.permissionLevel !== maxAccessLevel ||
      existingPermission.derived !== derived ||
      existingPermission.directPermissionId !== parentPermissionId)
  ) {
    await prisma.derivedPermission.upsert({
      where: {
        courseId_userId: {
          courseId: id,
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
        course: { connect: { id } },
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
        courseId_userId: {
          courseId: id,
          userId,
        },
      },
    })
  }

  // if the corresponding flag is set, update the access requests for the object
  if (updateAccessRequests) {
    await updateAccessRequestInstances({ courseId: id, userId }, prisma)
  }

  // recompute the derived permissions on all activities contained in this course (sequentially)
  for (const liveQuiz of course.liveQuizzes) {
    await recomputeLiveQuizPermissionsUser(
      { id: liveQuiz.id, userId, updateAccessRequests },
      prisma
    )
  }
  for (const practiceQuiz of course.practiceQuizzes) {
    await recomputePracticeQuizPermissionsUser(
      { id: practiceQuiz.id, userId, updateAccessRequests },
      prisma
    )
  }
  for (const microLearning of course.microLearnings) {
    await recomputeMicroLearningPermissionsUser(
      { id: microLearning.id, userId, updateAccessRequests },
      prisma
    )
  }
  for (const groupActivity of course.groupActivities) {
    await recomputeGroupActivityPermissionsUser(
      { id: groupActivity.id, userId, updateAccessRequests },
      prisma
    )
  }

  return
}

/**
 * Recomputes derived permissions for all users on a course.
 *
 * This function deletes all existing derived permissions for the course
 * and then recomputes them. Permissions are directly deduplicated for the
 * derived permissions table to only contain the highest permission level
 * for each user. The following sources for direct permissions on courses
 * are considered:
 * - direct permissions granted to users
 * - direct permissions granted to user groups
 * - ownership of the course
 *
 * Additionally, a recomputation of the derived permissions on all activities
 * contained in the course is triggered.
 *
 * @param params - Object containing course ID
 * @param params.id - ID of the course
 * @param params.updateAccessRequests - Flag to update access requests for the object
 * @param prisma - Prisma transaction client for database operations
 */
export async function recomputeCoursePermissionsObject(
  { id, updateAccessRequests }: { id: string; updateAccessRequests: boolean },
  prisma: PrismaTransactionClient
) {
  // fetch the course and all direct permissions on it, including user groups, as well as all activities on the course for propagation
  const course = await prisma.course.findUnique({
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
      // activities in course that inherit permissions from it
      liveQuizzes: true,
      practiceQuizzes: true,
      microLearnings: true,
      groupActivities: true,
    },
  })

  if (!course) {
    console.error(`Course with id ${id} not found`)
    return
  }

  // determine the access map based on ownership and direct permissions (no derived access on courses is possible)
  const userAccess = getMaxAccessLevelCombined({
    directPermissions: course.directPermissions,
    objectDeleted: course.isDeleted,
    ownerId: course.ownerId,
  })

  // remove the derived permissions for all users that do not have access (anymore)
  await prisma.derivedPermission.deleteMany({
    where: {
      courseId: id,
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
            courseId_userId: {
              courseId: id,
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
            course: { connect: { id } },
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
      `Failed to update derived permissions for course (ID: ${course.id}): ${rejectedPromises
        .map((result) => result.reason?.message || 'Unknown error')
        .join(', ')}`
    )
  }

  // if the corresponding flag is set, update the access requests for the object
  if (updateAccessRequests) {
    await updateAccessRequestInstances({ courseId: id }, prisma)
  }

  // recompute the derived permissions on all activities contained in this course (sequentially)
  for (const liveQuiz of course.liveQuizzes) {
    await recomputeLiveQuizPermissionsObject(
      { id: liveQuiz.id, updateAccessRequests },
      prisma
    )
  }
  for (const practiceQuiz of course.practiceQuizzes) {
    await recomputePracticeQuizPermissionsObject(
      { id: practiceQuiz.id, updateAccessRequests },
      prisma
    )
  }
  for (const microLearning of course.microLearnings) {
    await recomputeMicroLearningPermissionsObject(
      { id: microLearning.id, updateAccessRequests },
      prisma
    )
  }
  for (const groupActivity of course.groupActivities) {
    await recomputeGroupActivityPermissionsObject(
      { id: groupActivity.id, updateAccessRequests },
      prisma
    )
  }
}
