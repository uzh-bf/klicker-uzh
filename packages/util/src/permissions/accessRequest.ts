/**
 * Access request permission updates for KlickerUZH:
 * - updateAccessRequestInstances: removes invalid requests for users who lost admin/owner rights and upserts valid pending requests (optionally scoped to a specific user).
 */

import * as DB from '@klicker-uzh/prisma/client'
import { type PrismaTransactionClient } from '../types.js'

/**
 * This function updates access requests for a specific object type, potentially limited
 * to object requests assigned to a specific admin or owner user. Before upserting new
 * access requests for all pending user requests, it first deleted all invalid access
 * requests for users that have lost their admin or owner permissions.
 *
 * Thereby, triggering this function with a userId, it can be assumed that all access
 * requests assigned to this user as an admin or owner are valid and should be kept.
 * If no userId is provided, all access requests that are not assigned to any object
 * owner or admin are validated and potentially updated / removed.
 *
 * @param params - Object containing object IDs and optional user ID
 * @param params.catalogCollectionId - ID of the catalog collection to update access requests for
 * @param params.answerCollectionId - ID of the answer collection to update access requests for
 * @param params.elementId - ID of the element to update access requests for
 * @param params.courseId - ID of the course to update access requests for
 * @param params.liveQuizId - ID of the live quiz to update access requests for
 * @param params.practiceQuizId - ID of the practice quiz to update access requests for
 * @param params.microLearningId - ID of the microlearning to update access requests for
 * @param params.groupActivityId - ID of the group activity to update access requests for
 * @param params.objectSoftDeleted - Optional flag to signal the soft deletion of the object
 * @param params.userId - Optional user ID to limit the update to a specific user
 * @param prisma - Prisma transaction client for database operations
 * @returns Promise that resolves when the access request update completes
 */
export async function updateAccessRequestInstances(
  {
    // object ids - exactly one must be defined
    catalogCollectionId,
    answerCollectionId,
    elementId,
    courseId,
    liveQuizId,
    pollId,
    practiceQuizId,
    microLearningId,
    groupActivityId,
    objectSoftDeleted,
    userId,
  }: {
    catalogCollectionId?: string
    answerCollectionId?: number
    elementId?: number
    courseId?: string
    liveQuizId?: string
    pollId?: string
    practiceQuizId?: string
    microLearningId?: string
    groupActivityId?: string
    objectSoftDeleted?: boolean
    userId?: string
  } & (
    | { catalogCollectionId: string }
    | { answerCollectionId: number }
    | { elementId: number }
    | { courseId: string }
    | { liveQuizId: string }
    | { pollId: string }
    | { practiceQuizId: string }
    | { microLearningId: string }
    | { groupActivityId: string }
  ),
  prisma: PrismaTransactionClient
) {
  // if no object id is defined, throw an error
  if (
    typeof catalogCollectionId === 'undefined' &&
    typeof answerCollectionId === 'undefined' &&
    typeof elementId === 'undefined' &&
    typeof courseId === 'undefined' &&
    typeof liveQuizId === 'undefined' &&
    typeof pollId === 'undefined' &&
    typeof practiceQuizId === 'undefined' &&
    typeof microLearningId === 'undefined' &&
    typeof groupActivityId === 'undefined'
  ) {
    throw new Error('No object id defined for the update of access requests')
  }

  // if the object is soft-deleted, remove all access requests
  if (objectSoftDeleted) {
    await prisma.accessRequest.deleteMany({
      where: {
        catalogCollectionId,
        answerCollectionId,
        elementId,
        courseId,
        liveQuizId,
        practiceQuizId,
        microLearningId,
        groupActivityId,
      },
    })

    return
  }

  if (typeof userId !== 'undefined') {
    // check if the considered user has admin permissions or is the owner
    const adminPermissions = await prisma.derivedPermission.findUnique({
      where: {
        permissionLevel: {
          in: [DB.PermissionLevel.ADMIN, DB.PermissionLevel.OWNER],
        },
        catalogCollectionId_userId:
          typeof catalogCollectionId !== 'undefined'
            ? {
                catalogCollectionId,
                userId,
              }
            : undefined,
        answerCollectionId_userId:
          typeof answerCollectionId !== 'undefined'
            ? {
                answerCollectionId,
                userId,
              }
            : undefined,
        elementId_userId:
          typeof elementId !== 'undefined'
            ? {
                elementId,
                userId,
              }
            : undefined,
        courseId_userId:
          typeof courseId !== 'undefined'
            ? {
                courseId,
                userId,
              }
            : undefined,
        liveQuizId_userId:
          typeof liveQuizId !== 'undefined'
            ? {
                liveQuizId,
                userId,
              }
            : undefined,
        pollId_userId:
          typeof pollId !== 'undefined'
            ? {
                pollId,
                userId,
              }
            : undefined,
        practiceQuizId_userId:
          typeof practiceQuizId !== 'undefined'
            ? {
                practiceQuizId,
                userId,
              }
            : undefined,
        microLearningId_userId:
          typeof microLearningId !== 'undefined'
            ? {
                microLearningId,
                userId,
              }
            : undefined,
        groupActivityId_userId:
          typeof groupActivityId !== 'undefined'
            ? {
                groupActivityId,
                userId,
              }
            : undefined,
      },
    })

    // if the user is not an admin or owner, remove all access requests and return
    if (!adminPermissions) {
      await prisma.accessRequest.deleteMany({
        where: {
          objectAdminOrOwnerId: userId,
          catalogCollectionId,
          answerCollectionId,
          elementId,
          courseId,
          liveQuizId,
          pollId,
          practiceQuizId,
          microLearningId,
          groupActivityId,
        },
      })

      return
    }

    // fetch all remaining access requests and deduplicate them to get the unique userIds of the requesters
    const accessRequests = await prisma.accessRequest.findMany({
      where: {
        catalogCollectionId,
        answerCollectionId,
        elementId,
        courseId,
        liveQuizId,
        pollId,
        practiceQuizId,
        microLearningId,
        groupActivityId,
      },
      distinct: ['userId'],
    })

    // upsert access requests for all requesting users for the user (admin / owner) under consideration
    // ? we need to use Promise.allSettled here to ensure that all access requests are processed and a rollback works correctly in case of a failure
    // ? when using Promise.all, it can happen that, due to the concurrency, certain changes might still be committed to the database
    const results = await Promise.allSettled(
      accessRequests.map(
        async ({ userId: requestingUserId, permissionLevel }) =>
          await prisma.accessRequest.upsert({
            where: {
              catalogCollectionId_userId_objectAdminOrOwnerId:
                typeof catalogCollectionId !== 'undefined'
                  ? {
                      catalogCollectionId,
                      userId: requestingUserId,
                      objectAdminOrOwnerId: userId,
                    }
                  : undefined,
              answerCollectionId_userId_objectAdminOrOwnerId:
                typeof answerCollectionId !== 'undefined'
                  ? {
                      answerCollectionId,
                      userId: requestingUserId,
                      objectAdminOrOwnerId: userId,
                    }
                  : undefined,
              elementId_userId_objectAdminOrOwnerId:
                typeof elementId !== 'undefined'
                  ? {
                      elementId,
                      userId: requestingUserId,
                      objectAdminOrOwnerId: userId,
                    }
                  : undefined,
              courseId_userId_objectAdminOrOwnerId:
                typeof courseId !== 'undefined'
                  ? {
                      courseId,
                      userId: requestingUserId,
                      objectAdminOrOwnerId: userId,
                    }
                  : undefined,
              liveQuizId_userId_objectAdminOrOwnerId:
                typeof liveQuizId !== 'undefined'
                  ? {
                      liveQuizId,
                      userId: requestingUserId,
                      objectAdminOrOwnerId: userId,
                    }
                  : undefined,
              pollId_userId_objectAdminOrOwnerId:
                typeof pollId !== 'undefined'
                  ? {
                      pollId,
                      userId: requestingUserId,
                      objectAdminOrOwnerId: userId,
                    }
                  : undefined,
              practiceQuizId_userId_objectAdminOrOwnerId:
                typeof practiceQuizId !== 'undefined'
                  ? {
                      practiceQuizId,
                      userId: requestingUserId,
                      objectAdminOrOwnerId: userId,
                    }
                  : undefined,
              microLearningId_userId_objectAdminOrOwnerId:
                typeof microLearningId !== 'undefined'
                  ? {
                      microLearningId,
                      userId: requestingUserId,
                      objectAdminOrOwnerId: userId,
                    }
                  : undefined,
              groupActivityId_userId_objectAdminOrOwnerId:
                typeof groupActivityId !== 'undefined'
                  ? {
                      groupActivityId,
                      userId: requestingUserId,
                      objectAdminOrOwnerId: userId,
                    }
                  : undefined,
            },
            create: {
              permissionLevel,
              user: { connect: { id: requestingUserId } },
              objectAdminOrOwner: { connect: { id: userId } },
              catalogCollection:
                typeof catalogCollectionId !== 'undefined'
                  ? { connect: { id: catalogCollectionId } }
                  : undefined,
              answerCollection:
                typeof answerCollectionId !== 'undefined'
                  ? { connect: { id: answerCollectionId } }
                  : undefined,
              element:
                typeof elementId !== 'undefined'
                  ? { connect: { id: elementId } }
                  : undefined,
              course:
                typeof courseId !== 'undefined'
                  ? { connect: { id: courseId } }
                  : undefined,
              liveQuiz:
                typeof liveQuizId !== 'undefined'
                  ? { connect: { id: liveQuizId } }
                  : undefined,
              poll:
                typeof pollId !== 'undefined'
                  ? { connect: { id: pollId } }
                  : undefined,
              practiceQuiz:
                typeof practiceQuizId !== 'undefined'
                  ? { connect: { id: practiceQuizId } }
                  : undefined,
              microLearning:
                typeof microLearningId !== 'undefined'
                  ? { connect: { id: microLearningId } }
                  : undefined,
              groupActivity:
                typeof groupActivityId !== 'undefined'
                  ? { connect: { id: groupActivityId } }
                  : undefined,
            },
            update: {
              permissionLevel,
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
        `Failed to update access requests: ${rejectedPromises
          .map((result) => result.reason?.message || 'Unknown error')
          .join(', ')}`
      )
    }
  } else {
    // find all users with admin or owner permissions on the object under consideration
    const adminUsers = await prisma.derivedPermission.findMany({
      where: {
        permissionLevel: {
          in: [DB.PermissionLevel.ADMIN, DB.PermissionLevel.OWNER],
        },
        catalogCollectionId,
        answerCollectionId,
        elementId,
        courseId,
        liveQuizId,
        pollId,
        practiceQuizId,
        microLearningId,
        groupActivityId,
      },
      select: {
        userId: true,
      },
    })
    const adminUserIds = adminUsers.map((user) => user.userId)

    // delete all access requests that are not assigned to one of the identified admins or the owner
    await prisma.accessRequest.deleteMany({
      where: {
        objectAdminOrOwnerId: {
          notIn: adminUserIds,
        },
        catalogCollectionId,
        answerCollectionId,
        elementId,
        courseId,
        liveQuizId,
        pollId,
        practiceQuizId,
        microLearningId,
        groupActivityId,
      },
    })

    // fetch all remaining access requests and deduplicate them to get the unique userIds of the requesters
    const accessRequests = await prisma.accessRequest.findMany({
      where: {
        catalogCollectionId,
        answerCollectionId,
        elementId,
        courseId,
        liveQuizId,
        pollId,
        practiceQuizId,
        microLearningId,
        groupActivityId,
      },
      distinct: ['userId'],
    })

    // upsert access requests for all requesting users for all admins and the owner
    const combinations = adminUserIds.flatMap((adminUserId) =>
      accessRequests.map((accessRequest) => ({
        requestingUserId: accessRequest.userId,
        requestedPermissionLevel: accessRequest.permissionLevel,
        adminOrOwnerUserId: adminUserId,
      }))
    )
    const results = await Promise.allSettled(
      combinations.map(
        async ({
          requestingUserId,
          requestedPermissionLevel,
          adminOrOwnerUserId,
        }) =>
          await prisma.accessRequest.upsert({
            where: {
              catalogCollectionId_userId_objectAdminOrOwnerId:
                typeof catalogCollectionId !== 'undefined'
                  ? {
                      catalogCollectionId,
                      userId: requestingUserId,
                      objectAdminOrOwnerId: adminOrOwnerUserId,
                    }
                  : undefined,
              answerCollectionId_userId_objectAdminOrOwnerId:
                typeof answerCollectionId !== 'undefined'
                  ? {
                      answerCollectionId,
                      userId: requestingUserId,
                      objectAdminOrOwnerId: adminOrOwnerUserId,
                    }
                  : undefined,
              elementId_userId_objectAdminOrOwnerId:
                typeof elementId !== 'undefined'
                  ? {
                      elementId,
                      userId: requestingUserId,
                      objectAdminOrOwnerId: adminOrOwnerUserId,
                    }
                  : undefined,
              courseId_userId_objectAdminOrOwnerId:
                typeof courseId !== 'undefined'
                  ? {
                      courseId,
                      userId: requestingUserId,
                      objectAdminOrOwnerId: adminOrOwnerUserId,
                    }
                  : undefined,
              liveQuizId_userId_objectAdminOrOwnerId:
                typeof liveQuizId !== 'undefined'
                  ? {
                      liveQuizId,
                      userId: requestingUserId,
                      objectAdminOrOwnerId: adminOrOwnerUserId,
                    }
                  : undefined,
              pollId_userId_objectAdminOrOwnerId:
                typeof pollId !== 'undefined'
                  ? {
                      pollId,
                      userId: requestingUserId,
                      objectAdminOrOwnerId: adminOrOwnerUserId,
                    }
                  : undefined,
              practiceQuizId_userId_objectAdminOrOwnerId:
                typeof practiceQuizId !== 'undefined'
                  ? {
                      practiceQuizId,
                      userId: requestingUserId,
                      objectAdminOrOwnerId: adminOrOwnerUserId,
                    }
                  : undefined,
              microLearningId_userId_objectAdminOrOwnerId:
                typeof microLearningId !== 'undefined'
                  ? {
                      microLearningId,
                      userId: requestingUserId,
                      objectAdminOrOwnerId: adminOrOwnerUserId,
                    }
                  : undefined,
              groupActivityId_userId_objectAdminOrOwnerId:
                typeof groupActivityId !== 'undefined'
                  ? {
                      groupActivityId,
                      userId: requestingUserId,
                      objectAdminOrOwnerId: adminOrOwnerUserId,
                    }
                  : undefined,
            },
            create: {
              permissionLevel: requestedPermissionLevel,
              user: { connect: { id: requestingUserId } },
              objectAdminOrOwner: { connect: { id: adminOrOwnerUserId } },
              catalogCollection:
                typeof catalogCollectionId !== 'undefined'
                  ? { connect: { id: catalogCollectionId } }
                  : undefined,
              answerCollection:
                typeof answerCollectionId !== 'undefined'
                  ? { connect: { id: answerCollectionId } }
                  : undefined,
              element:
                typeof elementId !== 'undefined'
                  ? { connect: { id: elementId } }
                  : undefined,
              course:
                typeof courseId !== 'undefined'
                  ? { connect: { id: courseId } }
                  : undefined,
              liveQuiz:
                typeof liveQuizId !== 'undefined'
                  ? { connect: { id: liveQuizId } }
                  : undefined,
              poll:
                typeof pollId !== 'undefined'
                  ? { connect: { id: pollId } }
                  : undefined,
              practiceQuiz:
                typeof practiceQuizId !== 'undefined'
                  ? { connect: { id: practiceQuizId } }
                  : undefined,
              microLearning:
                typeof microLearningId !== 'undefined'
                  ? { connect: { id: microLearningId } }
                  : undefined,
              groupActivity:
                typeof groupActivityId !== 'undefined'
                  ? { connect: { id: groupActivityId } }
                  : undefined,
            },
            update: {
              permissionLevel: requestedPermissionLevel,
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
        `Failed to update access requests: ${rejectedPromises
          .map((result) => result.reason?.message || 'Unknown error')
          .join(', ')}`
      )
    }
  }
}
