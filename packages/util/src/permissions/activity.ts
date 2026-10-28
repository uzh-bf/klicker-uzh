/**
 * Shared derived-permission recomputation for the four activity models
 * (live quiz, practice quiz, microlearning, group activity).
 *
 * All four models implement the identical recomputation flow and differ
 * only in their Prisma delegate, their derived-permission key field, the
 * element-stack relation (`blocks` on live quizzes, `stacks` elsewhere)
 * and their log labels. The per-model descriptors below supply these
 * differences; the public per-model functions in this directory are thin
 * wrappers around the generic variants implemented here.
 */

import type * as DB from '@klicker-uzh/prisma/client'
import type { PrismaTransactionClient } from '../types.js'
import { updateAccessRequestInstances } from './accessRequest.js'
import {
  getActivityPermissionsObject,
  getActivityPermissionsUser,
  propagateActivityToElements,
  propagateActivityToElementsUser,
} from './util.js'

/** derived-permission identifier of an activity model */
type ActivityIdField =
  | 'liveQuizId'
  | 'practiceQuizId'
  | 'microLearningId'
  | 'groupActivityId'

/** element stacks of an activity in the shape accepted for element propagation */
type ActivityElementStacks = Parameters<
  typeof propagateActivityToElementsUser
>[0]['stacks']

/**
 * Activity state required for a derived-permission recomputation. The
 * per-model fetch functions apply the variant-specific permission filters
 * and normalize the element-stack relation (`blocks` on live quizzes)
 * into the common `stacks` shape.
 */
interface ActivityPermissionSnapshot {
  ownerId: string
  isDeleted: boolean
  directPermissions: DB.Permission[]
  course?: {
    permissions: (DB.DerivedPermission & {
      directPermission?: DB.Permission | null
    })[]
  } | null
  stacks: ActivityElementStacks
}

/** per-model differences between the four activity models */
export interface ActivityPermissionModel {
  /** lower-case label used in error messages */
  label: 'live quiz' | 'practice quiz' | 'microlearning' | 'group activity'
  /** label used in the object-not-found console.error */
  notFoundLabel:
    | 'Live quiz'
    | 'Practice quiz'
    | 'Microlearning'
    | 'Group activity'
  /** derived-permission key field identifying the activity */
  idField: ActivityIdField
  /**
   * Fetch the activity with the direct permissions relevant for the given
   * user (direct grants and user-group memberships), the user's course
   * permissions and the contained element stacks.
   */
  fetchForUser: (
    prisma: PrismaTransactionClient,
    id: string,
    userId: string
  ) => Promise<ActivityPermissionSnapshot | null>
  /**
   * Fetch the activity with all direct permissions (including user
   * groups), all course permissions and the contained element stacks.
   */
  fetchForObject: (
    prisma: PrismaTransactionClient,
    id: string
  ) => Promise<ActivityPermissionSnapshot | null>
  /** access-request scope identifying the activity */
  accessRequestScope: (
    id: string
  ) =>
    | { liveQuizId: string }
    | { practiceQuizId: string }
    | { microLearningId: string }
    | { groupActivityId: string }
}

/**
 * Unique identifier of a derived permission on an activity. Exactly one
 * composite key is defined per call; the remaining keys stay undefined
 * and are ignored by Prisma, so schema drift fails the type check
 * instead of producing runtime errors.
 */
function activityPermissionUniqueWhere(
  idField: ActivityIdField,
  id: string,
  userId: string
): DB.Prisma.DerivedPermissionWhereUniqueInput {
  return {
    liveQuizId_userId:
      idField === 'liveQuizId' ? { liveQuizId: id, userId } : undefined,
    practiceQuizId_userId:
      idField === 'practiceQuizId' ? { practiceQuizId: id, userId } : undefined,
    microLearningId_userId:
      idField === 'microLearningId'
        ? { microLearningId: id, userId }
        : undefined,
    groupActivityId_userId:
      idField === 'groupActivityId'
        ? { groupActivityId: id, userId }
        : undefined,
  }
}

/** create input for a new derived permission on an activity */
function activityPermissionCreate(
  idField: ActivityIdField,
  id: string,
  userId: string,
  {
    permissionLevel,
    derived,
    parentPermissionId,
  }: {
    permissionLevel: DB.PermissionLevel
    derived: boolean
    parentPermissionId?: number
  }
): DB.Prisma.DerivedPermissionCreateInput {
  return {
    permissionLevel,
    derived,
    directPermission:
      typeof parentPermissionId !== 'undefined'
        ? { connect: { id: parentPermissionId } }
        : undefined,
    liveQuiz: idField === 'liveQuizId' ? { connect: { id } } : undefined,
    practiceQuiz:
      idField === 'practiceQuizId' ? { connect: { id } } : undefined,
    microLearning:
      idField === 'microLearningId' ? { connect: { id } } : undefined,
    groupActivity:
      idField === 'groupActivityId' ? { connect: { id } } : undefined,
    user: { connect: { id: userId } },
  }
}

/** filter matching all derived permissions of an activity */
function activityPermissionFilter(
  idField: ActivityIdField,
  id: string,
  userId: { notIn: string[] }
): DB.Prisma.DerivedPermissionWhereInput {
  return {
    liveQuizId: idField === 'liveQuizId' ? id : undefined,
    practiceQuizId: idField === 'practiceQuizId' ? id : undefined,
    microLearningId: idField === 'microLearningId' ? id : undefined,
    groupActivityId: idField === 'groupActivityId' ? id : undefined,
    userId,
  }
}

/**
 * Dispatch function for the recomputation of derived permissions on an
 * activity.
 *
 * Based on the provided parameters, this function delegates to either
 * user-specific or object-wide permission recomputation.
 */
export async function recomputeActivityPermissions(
  {
    id,
    userId,
    updateAccessRequests,
  }: {
    id: string
    userId?: string
    updateAccessRequests: boolean
  },
  prisma: PrismaTransactionClient,
  model: ActivityPermissionModel
) {
  // if a user is defined, only recompute derived permissions for this user
  if (userId) {
    return await recomputeActivityPermissionsUser(
      { id, userId, updateAccessRequests },
      prisma,
      model
    )
  }

  // if the permission of a user group was modified or anything else, all derived permissions for the object need to be recomputed
  return await recomputeActivityPermissionsObject(
    { id, updateAccessRequests },
    prisma,
    model
  )
}

/**
 * Recomputes derived permissions for a specific user on an activity.
 *
 * This function removes any existing derived permission for the user and
 * then computes the highest granted permission level for that same user
 * from the following potential sources of access permissions:
 * - direct permission granted to the individual user
 * - direct permission granted to a user group the user is part of
 * - ownership of the activity
 * - any derived permission granted to the individual user on a course that
 *   includes the considered activity, according to the following rules.
 *   Additionally, the user can choose between awarding minimum required
 *   permissions or the propagation of the permissions (higher rights).
 *   READ on course --> READ on activity (min. required = propagated)
 *   WRITE on course --> READ / WRITE on activity (min. required / propagated)
 *   ADMIN on course --> ADMIN on activity (min. required = propagated)
 *   OWNER on course --> ADMIN on activity (min. required = propagated)
 *
 * Additionally, a recomputation of the derived permissions on all elements
 * used in the activity is triggered.
 */
export async function recomputeActivityPermissionsUser(
  {
    id,
    userId,
    updateAccessRequests,
  }: { id: string; userId: string; updateAccessRequests: boolean },
  prisma: PrismaTransactionClient,
  model: ActivityPermissionModel
) {
  // check if a permission for this user exists
  const existingPermission = await prisma.derivedPermission.findUnique({
    where: activityPermissionUniqueWhere(model.idField, id, userId),
  })

  // check for ownership, direct permissions, links to a course that would imply derived permissions
  const activity = await model.fetchForUser(prisma, id, userId)

  // if the activity does not exist, return
  if (!activity) {
    return
  }

  // compute the derived permission level (maximum) for this user on the activity
  const res = getActivityPermissionsUser({
    activityOwnerId: activity.ownerId,
    activityDeleted: activity.isDeleted,
    userId,
    directPermissions: activity.directPermissions,
    coursePermissions: activity.course?.permissions ?? [],
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
        where: activityPermissionUniqueWhere(model.idField, id, userId),
        create: activityPermissionCreate(model.idField, id, userId, {
          permissionLevel: maxAccessLevel,
          derived,
          parentPermissionId,
        }),
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
      where: activityPermissionUniqueWhere(model.idField, id, userId),
    })
  }

  // if the corresponding flag is set, update the access requests for the object
  if (updateAccessRequests) {
    await updateAccessRequestInstances(
      {
        ...model.accessRequestScope(id),
        userId,
        objectSoftDeleted: activity.isDeleted,
      },
      prisma
    )
  }

  // if the activity still exists and the user had ADMIN / OWNER permissions on it,
  // the derived element permissions need to be recomputed (-> complete recompute required)
  // users with lower permissions on the activity will never obtain derived permissions through it
  // --> however, since the computation is based on derived activity permissions, we need to compute these before
  await propagateActivityToElementsUser(
    { stacks: activity.stacks, userId, updateAccessRequests },
    prisma
  )

  return
}

/**
 * Recomputes derived permissions for all users on an activity.
 *
 * This function deletes all existing derived permissions for the activity
 * and then recomputes them. Permissions are directly deduplicated for the
 * derived permissions table to only contain the highest permission level
 * for each user. The following sources for direct permissions on the
 * activity are considered:
 * - direct permissions granted to users
 * - direct permissions granted to user groups
 * - ownership of the activity
 * - derived permissions granted to users on a course that includes the
 *   considered activity, according to the same rules as for the
 *   user-specific derived permissions recomputation (see above).
 *
 * Additionally, a recomputation of the derived permissions on all elements
 * used in the activity is triggered.
 */
export async function recomputeActivityPermissionsObject(
  { id, updateAccessRequests }: { id: string; updateAccessRequests: boolean },
  prisma: PrismaTransactionClient,
  model: ActivityPermissionModel
) {
  // fetch the object and all direct permissions on it, including user groups
  // permissions on the course should automatically imply corresponding permissions on the contained activities
  // depending on the permission level on the activity, derived permissions on the contained elements might be required
  const activity = await model.fetchForObject(prisma, id)

  if (!activity) {
    console.error(
      `${model.notFoundLabel} with id ${id} or corresponding owner not found`
    )
    return
  }

  // compute a map between all users with direct or derived access to the considered activity
  const userAccess = getActivityPermissionsObject({
    activityOwnerId: activity.ownerId,
    activityDeleted: activity.isDeleted,
    directPermissions: activity.directPermissions,
    coursePermissions: activity.course?.permissions ?? [],
  })

  // remove the derived permissions for all users that do not have access (anymore)
  await prisma.derivedPermission.deleteMany({
    where: activityPermissionFilter(model.idField, id, {
      notIn: Object.keys(userAccess),
    }),
  })

  // create / update derived permissions for each user with access
  const results = await Promise.allSettled(
    Object.entries(userAccess).map(
      async ([userId, { maxAccessLevel, parentPermissionId, derived }]) =>
        await prisma.derivedPermission.upsert({
          where: activityPermissionUniqueWhere(model.idField, id, userId),
          create: activityPermissionCreate(model.idField, id, userId, {
            permissionLevel: maxAccessLevel,
            derived,
            parentPermissionId,
          }),
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
      `Failed to update derived permissions for ${model.label} (ID: ${id}): ${rejectedPromises
        .map((result) => result.reason?.message || 'Unknown error')
        .join(', ')}`
    )
  }

  // if the corresponding flag is set, update the access requests for the object
  if (updateAccessRequests) {
    await updateAccessRequestInstances(
      {
        ...model.accessRequestScope(id),
        objectSoftDeleted: activity.isDeleted,
      },
      prisma
    )
  }

  // recompute the derived permissions on all elements contained in this activity
  await propagateActivityToElements(
    { stacks: activity.stacks, updateAccessRequests },
    prisma
  )
}
