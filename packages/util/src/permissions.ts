/**
 * Derived permissions module for KlickerUZH:
 * - recomputeDerivedPermissions: main entrypoint dispatching to specific recompute functions by entity type.
 * - Re-exports all `recomputeXxxPermissions` functions across entities and `updateAccessRequestInstances`.
 */

import { HatchetClient } from '@hatchet-dev/typescript-sdk'
import { recomputeAnswerCollectionPermissions } from './permissions/answerCollectionDispatcher.js'
import { recomputeCatalogCollectionPermissions } from './permissions/catalog.js'
import { recomputeCoursePermissions } from './permissions/course.js'
import { recomputeElementPermissions } from './permissions/element.js'
import { recomputeGroupActivityPermissions } from './permissions/groupActivity.js'
import { recomputeLiveQuizPermissions } from './permissions/liveQuiz.js'
import { recomputeMicroLearningPermissions } from './permissions/microlearning.js'
import { recomputePracticeQuizPermissions } from './permissions/practiceQuiz.js'
import { type PrismaTransactionClient } from './types.js'
export * from './permissions/accessRequest.js'
export * from './permissions/answerCollection.js'
export * from './permissions/catalog.js'
export * from './permissions/course.js'
export * from './permissions/element.js'
export * from './permissions/groupActivity.js'
export * from './permissions/liveQuiz.js'
export * from './permissions/microlearning.js'
export * from './permissions/practiceQuiz.js'
export * from './permissions/util.js'

/**
 * This function serves as the main entry point for recomputing derived permissions
 * for various entities within the system. It delegates to specific recomputation
 * functions based on the entity type identified by the provided ID. Only exactly one
 * object ID must be defined in the parameters.
 *
 * If in addition to the object ID a user ID is provided, only the derived permissions
 * for this user will be recomputed.
 *
 * A recomputation of an object's derived permissions always automatically also includes
 * the consideration of derived permissions granted due to a potential parent object
 * (e.g. derived permissions on an answer collection that are granted through an element)
 * and a propagation to dependent objects (given sufficient permissions).
 *
 * @param params - Object containing object IDs and optional user ID
 * @param params.catalogCollectionId - ID of the catalog collection to recompute permissions for
 * @param params.answerCollectionId - ID of the answer collection to recompute permissions for
 * @param params.elementId - ID of the element to recompute permissions for
 * @param params.courseId - ID of the course to recompute permissions for
 * @param params.liveQuizId - ID of the live quiz to recompute permissions for
 * @param params.practiceQuizId - ID of the practice quiz to recompute permissions for
 * @param params.microLearningId - ID of the microlearning to recompute permissions for
 * @param params.groupActivityId - ID of the group activity to recompute permissions for
 * @param params.userId - Optional user ID to limit recomputation to a specific user
 * @param params.updateAccessRequests - Flag to update access requests for the object
 * @param prisma - Prisma transaction client for database operations
 * @returns Promise that resolves when the permission recomputation completes
 */
// TODO: fix the props of this function that typescript only accepts one object ID and one of the two booleans to be set
export async function recomputeDerivedPermissions(
  {
    // if a direct permission was created, pass the corresponding ID
    directPermissionId,
    // object ids - exactly one must be defined
    catalogCollectionId,
    answerCollectionId,
    elementId,
    courseId,
    liveQuizId,
    practiceQuizId,
    microLearningId,
    groupActivityId,
    // flag to signal that a derived ownership permission should be created (no need for hatchet task creation)
    ownerPermission = false,
    // optional user to limit the required recomputation
    userId,
    // optional flag to update the access requests for the object under consideration
    updateAccessRequests = false,
  }: {
    directPermissionId?: number
    catalogCollectionId?: string
    answerCollectionId?: number
    elementId?: number
    courseId?: string
    liveQuizId?: string
    practiceQuizId?: string
    microLearningId?: string
    groupActivityId?: string
    userId?: string
  } & (
    | { catalogCollectionId: string }
    | { answerCollectionId: number }
    | { elementId: number }
    | { courseId: string }
    | { liveQuizId: string }
    | { practiceQuizId: string }
    | { microLearningId: string }
    | { groupActivityId: string }
  ) &
    (
      | { ownerPermission?: boolean; updateAccessRequests?: never }
      | { ownerPermission?: never; updateAccessRequests?: boolean }
    ),
  prisma: PrismaTransactionClient,
  hatchet: HatchetClient
) {
  if (typeof answerCollectionId !== 'undefined') {
    await recomputeAnswerCollectionPermissions(
      {
        id: answerCollectionId,
        userId,
        directPermissionId,
        updateAccessRequests,
        ownerPermission,
      },
      prisma,
      hatchet
    )
  } else if (typeof catalogCollectionId !== 'undefined') {
    await recomputeCatalogCollectionPermissions(
      { id: catalogCollectionId, userId, updateAccessRequests },
      prisma
    )
  } else if (typeof elementId !== 'undefined') {
    await recomputeElementPermissions(
      { id: elementId, userId, updateAccessRequests },
      prisma
    )
  } else if (typeof liveQuizId !== 'undefined') {
    await recomputeLiveQuizPermissions(
      { id: liveQuizId, userId, updateAccessRequests },
      prisma
    )
  } else if (typeof practiceQuizId !== 'undefined') {
    await recomputePracticeQuizPermissions(
      { id: practiceQuizId, userId, updateAccessRequests },
      prisma
    )
  } else if (typeof microLearningId !== 'undefined') {
    await recomputeMicroLearningPermissions(
      { id: microLearningId, userId, updateAccessRequests },
      prisma
    )
  } else if (typeof groupActivityId !== 'undefined') {
    await recomputeGroupActivityPermissions(
      { id: groupActivityId, userId, updateAccessRequests },
      prisma
    )
  } else if (typeof courseId !== 'undefined') {
    await recomputeCoursePermissions(
      { id: courseId, userId, updateAccessRequests },
      prisma
    )
  } else {
    throw new Error('No object id defined')
  }
}
