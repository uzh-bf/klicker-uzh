/**
 * Permission utilities for KlickerUZH:
 * - getMaxAccessLevelIndividual: computes highest direct permission per user.
 * - getMaxAccessLevelCombined: builds combined user access map from direct grants (and owner).
 * - getActivityAccessFromCourse: derives activity-level access from course-level permissions.
 * - getActivityPermissionsUser: determines effective access for a single user on an activity.
 * - getActivityPermissionsObject: builds activity-wide user access map combining direct + derived.
 * - propagateActivityToElementsUser & propagateActivityToElements: trigger element-level permission recompute within an activity (user-scoped or object-scoped).
 */

import * as DB from '@klicker-uzh/prisma'
import { type PrismaTransactionClient } from '../types.js'
import {
  inversePermissionLevelMap,
  permissionLevelMap,
  type UserAccessMap,
} from './constants.js'
import {
  recomputeElementPermissionsObject,
  recomputeElementPermissionsUser,
} from './element.js'

/**
 * This function consumes all the direct permissions on an object that were granted
 * either to an individual user or to a user group the user is part of. It then
 * deduplicates them and returns the highest available permission level, as well
 * as the corresponding direct permission ID.
 *
 * @param directPermissions - Array of direct permissions on the object
 * @returns - Object containing the maximum direct permission level and the corresponding direct permission ID
 */
export function getMaxAccessLevelIndividual({
  directPermissions,
}: {
  directPermissions: DB.Permission[]
}) {
  return directPermissions.reduce<{
    maxDirectPermission: number
    directPermissionId: number | undefined
  }>(
    (acc, directPermission) => {
      // if the newly identified permission level is higher then the currently known highest one,
      // update the maximum permission level and the corresponding direct permission ID
      if (
        permissionLevelMap[directPermission.permissionLevel] >
        acc.maxDirectPermission
      ) {
        return {
          maxDirectPermission:
            permissionLevelMap[directPermission.permissionLevel],
          directPermissionId: directPermission.id,
        }
      }
      // another direct permission with the same level was found, but one of them has propagation enabled
      // (higher derived permission rights), keep the one with propagation enabled
      else if (
        permissionLevelMap[directPermission.permissionLevel] ===
          acc.maxDirectPermission &&
        directPermission.propagation
      ) {
        return {
          maxDirectPermission:
            permissionLevelMap[directPermission.permissionLevel],
          directPermissionId: directPermission.id,
        }
      } else {
        return acc
      }
    },
    {
      maxDirectPermission: permissionLevelMap['NONE'],
      directPermissionId: undefined,
    }
  )
}

/**
 * This function computes the maximum access level for all users with access to an object
 * based on the direct permissions granted to and groups they are part of. It returns a map
 * of user IDs to their maximum access level, the corresponding direct permission ID (deduplicated).
 *
 * @param directPermissions - Array of direct permissions on the object
 * @param objectDeleted - Boolean indicating if the object was soft-deleted
 *                        -> affects direct permission validity
 * @param ownerId - Optional ID of the object owner
 * @returns - Map containing the maximum access level and corresponding direct
 *            permission ID for each user with access to the object
 */
export function getMaxAccessLevelCombined({
  directPermissions,
  objectDeleted,
  ownerId,
}: {
  directPermissions: (DB.Permission & {
    userGroup?:
      | (DB.UserGroup & { members: DB.User[]; admins: DB.User[] })
      | null
  })[]
  objectDeleted: boolean
  ownerId?: string | null
}) {
  const userAccess = directPermissions.reduce<UserAccessMap>(
    (acc, directPermission) => {
      if (directPermission.userId) {
        // if user already has a permission, check if the new one is higher
        // if the newly identified permission level is higher then the currently known highest one,
        // update the maximum permission level and the corresponding direct permission ID
        if (
          typeof acc[directPermission.userId] !== 'undefined' &&
          permissionLevelMap[directPermission.permissionLevel] >
            permissionLevelMap[acc[directPermission.userId]!.maxAccessLevel]
        ) {
          acc[directPermission.userId]!.maxAccessLevel =
            directPermission.permissionLevel
          acc[directPermission.userId]!.parentPermissionId = directPermission.id
        }
        // another direct permission with the same level was found, but one of them has propagation enabled
        // (higher derived permission rights), keep the one with propagation enabled
        else if (
          typeof acc[directPermission.userId] !== 'undefined' &&
          permissionLevelMap[directPermission.permissionLevel] ===
            permissionLevelMap[acc[directPermission.userId]!.maxAccessLevel] &&
          directPermission.propagation
        ) {
          acc[directPermission.userId]!.maxAccessLevel =
            directPermission.permissionLevel
          acc[directPermission.userId]!.parentPermissionId = directPermission.id
        }

        // if user does not have a permission yet, add it
        if (typeof acc[directPermission.userId] === 'undefined') {
          acc[directPermission.userId] = {
            maxAccessLevel: directPermission.permissionLevel,
            parentPermissionId: directPermission.id,
            derived: false,
          }
        }
      } else if (directPermission.userGroup) {
        // iterate over all users in the group and add / update the corresponding permissions for each user
        const groupMembers = [
          { id: directPermission.userGroup.ownerId },
          ...directPermission.userGroup.members,
          ...directPermission.userGroup.admins,
        ]

        groupMembers.forEach((user) => {
          // if the newly identified permission level is higher then the currently known highest one,
          // update the maximum permission level and the corresponding direct permission ID
          if (
            typeof acc[user.id] !== 'undefined' &&
            permissionLevelMap[directPermission.permissionLevel] >
              permissionLevelMap[acc[user.id]!.maxAccessLevel]
          ) {
            acc[user.id]!.maxAccessLevel = directPermission.permissionLevel
            acc[user.id]!.parentPermissionId = directPermission.id
          }
          // another direct permission with the same level was found, but one of them has propagation enabled
          if (
            typeof acc[user.id] !== 'undefined' &&
            permissionLevelMap[directPermission.permissionLevel] ===
              permissionLevelMap[acc[user.id]!.maxAccessLevel] &&
            directPermission.propagation
          ) {
            acc[user.id]!.maxAccessLevel = directPermission.permissionLevel
            acc[user.id]!.parentPermissionId = directPermission.id
          }

          if (typeof acc[user.id] === 'undefined') {
            acc[user.id] = {
              maxAccessLevel: directPermission.permissionLevel,
              parentPermissionId: directPermission.id,
              derived: false,
            }
          }
        })
      } else {
        throw new Error(`Direct permission without user or user group found.`)
      }

      return acc
    },
    ownerId && !objectDeleted
      ? {
          [ownerId]: {
            maxAccessLevel: DB.PermissionLevel.OWNER,
            parentPermissionId: undefined,
            derived: false,
          },
        }
      : {}
  )

  return userAccess
}

/**
 * This function computes the maximum access level that should be granted to an individual
 * user on all activities assigned to a course, based on the course permissions. It returns
 * the maximum access level, the corresponding parent permission ID, and a boolean
 * indicating if the access level was derived from the course permissions.
 *
 * The derived permission levels on activities contained in a course are computed according
 * to the rules outlined in the corresponding derived permission computation on live quizzes
 * above.
 *
 * @param coursePermissionLevel - The permission level of the course
 * @param directCoursePermission - The direct permission granted to the user (individual or group)
 *                                 on the course (optional)
 * @returns - Object containing the maximum access level, parent permission ID, and derived status
 */
export function getActivityAccessFromCourse({
  coursePermissionLevel,
  directCoursePermission,
}: {
  coursePermissionLevel: DB.PermissionLevel
  directCoursePermission?: DB.Permission | null
}) {
  let maxAccessLevel: DB.PermissionLevel | undefined = undefined
  let parentPermissionId: number | undefined = undefined
  let derived = false

  switch (coursePermissionLevel) {
    // if the user has ADMIN (or OWNER) permissions on the course, these rights need to be propagated for sharing functionalities to work properly
    case DB.PermissionLevel.OWNER:
    case DB.PermissionLevel.ADMIN:
      maxAccessLevel = DB.PermissionLevel.ADMIN
      parentPermissionId = directCoursePermission?.id
      derived = true
      break

    // if the user has WRITE permissions on the course, EXECUTE or WRITE access is derived (depending on propagation setting)
    case DB.PermissionLevel.WRITE:
      maxAccessLevel = directCoursePermission?.propagation
        ? DB.PermissionLevel.WRITE
        : DB.PermissionLevel.EXECUTE
      parentPermissionId = directCoursePermission?.id
      derived = true
      break

    // if the user has EXECUTION permissions on the course, propagate these rights
    case DB.PermissionLevel.EXECUTE:
      maxAccessLevel = DB.PermissionLevel.EXECUTE
      parentPermissionId = directCoursePermission?.id
      derived = true
      break

    // if the user has READ permissions on the course, automatically also add READ permissions on the quiz
    case DB.PermissionLevel.READ:
      maxAccessLevel = DB.PermissionLevel.READ
      parentPermissionId = directCoursePermission?.id
      derived = true
      break
  }

  return { maxAccessLevel, parentPermissionId, derived }
}

/**
 * This function computes the maximum access level for a user on an activity based on
 * the activity's owner ID, the activity's deletion status, direct permissions, and
 * course permissions that might give rise to higher activity permissions.
 * It returns an object containing the maximum access level, parent permission ID, and
 * a boolean indicating if the access level was derived from course permissions.
 *
 * @param params - Object containing activity owner ID, deletion status, user ID,
 *                 direct permissions on the activity, and course permissions
 * @param params.activityOwnerId - ID of the activity owner
 * @param params.activityDeleted - Boolean indicating if the activity is soft-deleted
 * @param params.userId - ID of the user to check permissions for
 * @param params.directPermissions - Array of direct permissions on the activity
 * @param params.coursePermissions - Array of derived permissions on the course
 * @returns - Object containing the maximum access level, parent permission ID,
 *            and derived status or null if no valid derived permission was computed
 */
export function getActivityPermissionsUser({
  activityOwnerId,
  activityDeleted,
  userId,
  directPermissions,
  coursePermissions,
}: {
  activityOwnerId: string
  activityDeleted: boolean
  userId: string
  directPermissions: DB.Permission[]
  coursePermissions: (DB.DerivedPermission & {
    directPermission?: DB.Permission | null
  })[]
}) {
  // determine the maximum access level of the user
  let maxAccessLevel: DB.PermissionLevel | undefined = undefined
  let parentPermissionId: number | undefined = undefined
  let derived = false

  // if user is answer collection owner, set the corresponding permission
  if (activityOwnerId === userId && !activityDeleted) {
    maxAccessLevel = DB.PermissionLevel.OWNER
  }
  // if the user has a direct permission or a derived access, use this case
  else if (
    directPermissions.length > 0 ||
    (coursePermissions.length ?? -1) > 0
  ) {
    // if the activity is soft-deleted, no direct permissions are valid anymore
    if (directPermissions.length > 0 && !activityDeleted) {
      // determine the highest available direct permission level
      const { maxDirectPermission, directPermissionId } =
        getMaxAccessLevelIndividual({
          directPermissions: directPermissions,
        })

      maxAccessLevel = inversePermissionLevelMap[maxDirectPermission]
      parentPermissionId = directPermissionId
    }

    // is the user is also granted access to the course the object is contained in, we need to check it for higher derived permission levels
    if ((coursePermissions.length ?? -1) > 0) {
      // if the user has more than one derived permission on the linked element, something went wrong
      if (coursePermissions.length !== 1) {
        throw new Error(
          `More or less than one derived permission found for a course linked to an activity and a single user ${userId} (id).`
        )
      }

      // derived permission on this object for this user should be unique
      const permission = coursePermissions[0]!

      // compute the derived permissions based on the course permissions
      const {
        maxAccessLevel: courseMaxAccessLevel,
        parentPermissionId: courseParentPermissionId,
        derived: courseDerived,
      } = getActivityAccessFromCourse({
        coursePermissionLevel: permission.permissionLevel,
        directCoursePermission: permission.directPermission,
      })

      // check if the derived access level is higher than the currently known maximum one
      if (
        typeof maxAccessLevel === 'undefined' ||
        (typeof courseMaxAccessLevel !== 'undefined' &&
          permissionLevelMap[courseMaxAccessLevel] >
            permissionLevelMap[maxAccessLevel])
      ) {
        maxAccessLevel = courseMaxAccessLevel
        parentPermissionId = courseParentPermissionId
        derived = courseDerived
      }
    }
  } else {
    return null
  }

  return { maxAccessLevel, parentPermissionId, derived }
}

/**
 * This function triggers a recomputation of the derived permissions for all elements
 * contained in the stacks / blocks of a given activity, limited to a specific user.
 *
 * @param params - Object containing stacks and user ID
 * @param params.stacks - Array of element stacks or blocks with their instances
 * @param params.userId - ID of the user to recompute permissions for
 * @param prisma - Prisma transaction client for database operations
 */
export async function propagateActivityToElementsUser(
  {
    stacks,
    userId,
    updateAccessRequests,
  }: {
    stacks:
      | (Partial<DB.ElementBlock> & { elements: DB.ElementInstance[] }[])
      | (Partial<DB.ElementStack> & { elements: DB.ElementInstance[] }[])
    userId: string
    updateAccessRequests: boolean
  },
  prisma: PrismaTransactionClient
) {
  const elementIds = [
    ...new Set(
      stacks.flatMap((stack) =>
        stack.elements.map((instance) => instance.elementId)
      )
    ),
  ]

  // sequentially update all elements
  for (const elementId of elementIds) {
    await recomputeElementPermissionsUser(
      { id: elementId, userId, updateAccessRequests },
      prisma
    )
  }
}

/**
 * This function combines the different sources for permissions on an activity
 * (direct permissions on the activity and derived permissions on the course) to
 * compute a map between the user ids and their maximum access levels.
 *
 * @param params - Object containing stacks
 * @param params.stacks - Array of element stacks or blocks with their instances
 * @param prisma - Prisma transaction client for database operations
 */
export function getActivityPermissionsObject({
  activityOwnerId,
  activityDeleted,
  directPermissions,
  coursePermissions,
}: {
  activityOwnerId: string
  activityDeleted: boolean
  directPermissions: DB.Permission[]
  coursePermissions: (DB.DerivedPermission & {
    directPermission?: DB.Permission | null
  })[]
}) {
  // determine the access map based on ownership and direct permissions
  const directUserAccess = getMaxAccessLevelCombined({
    directPermissions: directPermissions,
    objectDeleted: activityDeleted,
    ownerId: activityOwnerId,
  })

  // extend the user access map based on the course permissions
  const userAccess =
    coursePermissions.length > 0
      ? coursePermissions.reduce<UserAccessMap>(
          (acc, coursePermission) => {
            // get the corresponding direct permission
            const directCoursePermission = coursePermission.directPermission

            if (
              !directCoursePermission &&
              coursePermission.permissionLevel !== DB.PermissionLevel.OWNER
            ) {
              return acc
            }

            // depending on the permission level and the propagation setting on the direct course permission, choose the derived permission level
            const {
              maxAccessLevel: courseMaxAccessLevel,
              parentPermissionId: courseParentPermissionId,
              derived: courseDerived,
            } = getActivityAccessFromCourse({
              coursePermissionLevel: coursePermission.permissionLevel,
              directCoursePermission: coursePermission.directPermission,
            })

            // if the user is granted derived access through the course permission and this access level is higher than the current one, update it
            if (
              typeof courseMaxAccessLevel !== 'undefined' &&
              (typeof acc[coursePermission.userId] === 'undefined' ||
                permissionLevelMap[courseMaxAccessLevel] >
                  permissionLevelMap[
                    acc[coursePermission.userId]!.maxAccessLevel
                  ])
            ) {
              acc[coursePermission.userId] = {
                maxAccessLevel: courseMaxAccessLevel,
                parentPermissionId: courseParentPermissionId,
                derived: courseDerived,
              }
            }

            return acc
          },
          { ...directUserAccess }
        )
      : directUserAccess

  return userAccess
}

/**
 * This function triggers a recomputation of the derived permissions for all elements
 * contained in the stacks / blocks of a given activity.
 *
 * @param params - Object containing stacks
 * @param params.stacks - Array of element stacks or blocks with their instances
 * @param prisma - Prisma transaction client for database operations
 */
export async function propagateActivityToElements(
  {
    stacks,
    updateAccessRequests,
  }: {
    stacks:
      | (Partial<DB.ElementBlock> & { elements: DB.ElementInstance[] }[])
      | (Partial<DB.ElementStack> & { elements: DB.ElementInstance[] }[])
    updateAccessRequests: boolean
  },
  prisma: PrismaTransactionClient
) {
  const elementIds = [
    ...new Set(
      stacks.flatMap((stack) =>
        stack.elements.map((instance) => instance.elementId)
      )
    ),
  ]

  // sequentially update all elements
  for (const elementId of elementIds) {
    await recomputeElementPermissionsObject(
      { id: elementId, updateAccessRequests },
      prisma
    )
  }
}
