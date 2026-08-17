import * as DB from '@klicker-uzh/prisma/client'
import {
  ActivityLogModificationFieldType,
  ActivityType,
  CatalogObject,
  ObjectSharingRequest,
} from '@klicker-uzh/types'
import {
  MISSING_CATALOG_COLLECTION_ID,
  PrismaTransactionClient,
  recomputeDerivedPermissions,
  updateAccessRequestInstances,
} from '@klicker-uzh/util'
import type {
  ContextWithUser,
  PrismaTransactionContextWithUser,
} from '../lib/context.js'

// ! Helper functions
// #region

/**
 * Validates if the user has the required permissions to access a catalog collection.
 *
 * @param options - The validation options
 * @param options.catalogCollectionId - The ID of the catalog collection to check permissions for
 * @param options.minimumPermissionLevel - The minimum permission level required to access the collection
 * @param ctx - The context containing user information and database access
 *
 * @returns An object containing:
 *   - valid: Boolean indicating if the user has sufficient permissions
 *   - catalogCollection: The catalog collection object if found, otherwise null
 *
 * @remarks
 * If the catalogCollectionId is the MISSING_CATALOG_COLLECTION_ID, the function
 * automatically grants access and returns the default collection.
 */
export async function validateCatalogCollectionPermissions(
  {
    catalogCollectionId,
    minimumPermissionLevel,
  }: {
    catalogCollectionId: string
    minimumPermissionLevel: DB.PermissionLevel
  },
  ctx: ContextWithUser
) {
  if (catalogCollectionId === MISSING_CATALOG_COLLECTION_ID) {
    const defaultCollection = await ctx.prisma.catalogCollection.findUnique({
      where: {
        id: MISSING_CATALOG_COLLECTION_ID,
      },
    })

    return { valid: true, catalogCollection: defaultCollection }
  }

  // use the checkAccess function to validate sufficient permissions on the catalog collection
  const valid = await checkAccess(
    [{ catalogCollectionId, minimumPermissionLevel }],
    ctx
  )

  const catalogCollection = await ctx.prisma.catalogCollection.findUnique({
    where: {
      id: catalogCollectionId,
    },
  })

  return { valid, catalogCollection: catalogCollection }
}

/**
 * Verify if a catalog collection is browsable for the current user
 *
 * @param params.catalogCollectionId - The ID of the catalog collection to verify
 * @param ctx - The context containing the authenticated user information
 * @returns A boolean indicating whether the catalog collection is browsable
 */
export async function verifyCatalogCollectionBrowsable(
  { catalogCollectionId }: { catalogCollectionId: string },
  ctx: ContextWithUser
) {
  if (catalogCollectionId === MISSING_CATALOG_COLLECTION_ID) {
    return true
  }

  const { valid, catalogCollection } =
    await validateCatalogCollectionPermissions(
      {
        catalogCollectionId,
        minimumPermissionLevel: DB.PermissionLevel.READ,
      },
      ctx
    )

  return (
    catalogCollection &&
    (valid || catalogCollection.access === DB.ObjectAccess.PUBLIC)
  )
}

/**
 * Validates if the user has the required permission level for a specific activity.
 *
 * @param params.activityId - The ID of the activity to check permissions for
 * @param params.activityType - The type of the activity (LIVE_QUIZ, PRACTICE_QUIZ, MICRO_LEARNING, GROUP_ACTIVITY)
 * @param params.minimumPermissionLevel - The minimum permission level required to access the activity
 * @param ctx - The context containing the authenticated user information
 *
 * @returns A boolean indicating whether the user has valid permissions for the activity
 */
export async function validateActivityPermissions(
  {
    activityId,
    activityType,
    minimumPermissionLevel,
  }: {
    activityId: string
    activityType: ActivityType
    minimumPermissionLevel: DB.PermissionLevel
  },
  ctx: ContextWithUser
) {
  if (activityType === ActivityType.LIVE_QUIZ) {
    // check if the user has access to the live quiz
    const valid = await checkAccess(
      [
        {
          liveQuizId: activityId,
          minimumPermissionLevel,
        },
      ],
      ctx
    )

    return valid
  } else if (activityType === ActivityType.PRACTICE_QUIZ) {
    // check if the user has access to the practice quiz
    const valid = await checkAccess(
      [
        {
          practiceQuizId: activityId,
          minimumPermissionLevel,
        },
      ],
      ctx
    )

    return valid
  } else if (activityType === ActivityType.MICRO_LEARNING) {
    // check if the user has access to the micro learning
    const valid = await checkAccess(
      [
        {
          microLearningId: activityId,
          minimumPermissionLevel,
        },
      ],
      ctx
    )

    return valid
  } else if (activityType === ActivityType.GROUP_ACTIVITY) {
    // check if the user has access to the group activity
    const valid = await checkAccess(
      [
        {
          groupActivityId: activityId,
          minimumPermissionLevel,
        },
      ],
      ctx
    )

    return valid
  }

  return false
}

/**
 * Verifies if the current user has edit permissions for a catalog object based on assignment ID.
 *
 * This function performs permission checks in two scenarios:
 * 1. When the object is in a catalog collection - write permissions on the collection are required
 * 2. When the object is in a top-level collection - admin permissions on the specific object are required
 *
 * @param params.assignmentId - The ID of the catalog collection assignment to verify permissions for
 * @param ctx - The context containing user information and Prisma client
 * @returns A boolean indicating whether the user has edit permissions
 */
export async function verifyCatalogObjectEditPermissions(
  { assignmentId }: { assignmentId: number },
  ctx: ContextWithUser
): Promise<{
  sufficientPermissions: boolean
  assignment: DB.CatalogCollectionAssignment | null
}> {
  // fetch current assignment
  const assignment = await ctx.prisma.catalogCollectionAssignment.findUnique({
    where: {
      id: assignmentId,
    },
  })

  if (!assignment) {
    return { sufficientPermissions: false, assignment }
  }

  // ! Case 1: Object in Catalog Collection -> access level on catalog collection decides permissions
  // write permissions are required for content management of catalog collection
  if (assignment.catalogCollectionId !== MISSING_CATALOG_COLLECTION_ID) {
    const { valid } = await validateCatalogCollectionPermissions(
      {
        catalogCollectionId: assignment.catalogCollectionId,
        minimumPermissionLevel: DB.PermissionLevel.WRITE,
      },
      ctx
    )
    return { sufficientPermissions: valid, assignment }
  }
  // ! Case 2: Object in top-level collection -> access level on object decides permissions
  else {
    // verify that the user has sufficient permissions on the object
    const valid = await checkAccess(
      [
        ...(typeof assignment.answerCollectionId !== 'undefined' &&
        assignment.answerCollectionId !== null
          ? [
              {
                answerCollectionId: assignment.answerCollectionId,
                minimumPermissionLevel: DB.PermissionLevel.ADMIN,
              },
            ]
          : []),
        ...(typeof assignment.elementId !== 'undefined' &&
        assignment.elementId !== null
          ? [
              {
                elementId: assignment.elementId,
                minimumPermissionLevel: DB.PermissionLevel.ADMIN,
              },
            ]
          : []),
        ...(typeof assignment.courseId !== 'undefined' &&
        assignment.courseId !== null
          ? [
              {
                courseId: assignment.courseId,
                minimumPermissionLevel: DB.PermissionLevel.ADMIN,
              },
            ]
          : []),
        ...(typeof assignment.liveQuizId !== 'undefined' &&
        assignment.liveQuizId !== null
          ? [
              {
                liveQuizId: assignment.liveQuizId,
                minimumPermissionLevel: DB.PermissionLevel.ADMIN,
              },
            ]
          : []),
        ...(typeof assignment.practiceQuizId !== 'undefined' &&
        assignment.practiceQuizId !== null
          ? [
              {
                practiceQuizId: assignment.practiceQuizId,
                minimumPermissionLevel: DB.PermissionLevel.ADMIN,
              },
            ]
          : []),
        ...(typeof assignment.microLearningId !== 'undefined' &&
        assignment.microLearningId !== null
          ? [
              {
                microLearningId: assignment.microLearningId,
                minimumPermissionLevel: DB.PermissionLevel.ADMIN,
              },
            ]
          : []),
        ...(typeof assignment.groupActivityId !== 'undefined' &&
        assignment.groupActivityId !== null
          ? [
              {
                groupActivityId: assignment.groupActivityId,
                minimumPermissionLevel: DB.PermissionLevel.ADMIN,
              },
            ]
          : []),
      ],
      ctx
    )

    return { sufficientPermissions: valid, assignment }
  }
}

/**
 * Determines the object type and returns the ID based on the provided ID parameters.
 * Returns the appropriate DB.ObjectType and a stringified version of the ID,
 * or null if no valid ID is provided.
 *
 * @param [params.catalogCollectionId] - ID of a catalog collection
 * @param [params.answerCollectionId] - ID of an answer collection
 * @param [params.elementId] - ID of an element
 * @param [params.courseId] - ID of a course
 * @param [params.liveQuizId] - ID of a live quiz
 * @param [params.practiceQuizId] - ID of a practice quiz
 * @param [params.microLearningId] - ID of a micro learning
 * @param [params.groupActivityId] - ID of a group activity
 * @returns {{objectType: DB.ObjectType, objectId: string}|null} Object with type and ID or null
 */
export function getAuditLogObjectType({
  catalogCollectionId,
  answerCollectionId,
  elementId,
  courseId,
  liveQuizId,
  practiceQuizId,
  microLearningId,
  groupActivityId,
}: {
  catalogCollectionId?: string | null
  answerCollectionId?: number | null
  elementId?: number | null
  courseId?: string | null
  liveQuizId?: string | null
  practiceQuizId?: string | null
  microLearningId?: string | null
  groupActivityId?: string | null
}): { objectType: DB.ObjectType | null; objectId: string | null } {
  // check if exactly one of the object ids is defined
  const defined = [
    catalogCollectionId,
    answerCollectionId,
    elementId,
    courseId,
    liveQuizId,
    practiceQuizId,
    microLearningId,
    groupActivityId,
  ].filter((v) => v != null)

  if (defined.length !== 1) {
    throw new Error(
      `Ambiguous audit object identifiers: ${JSON.stringify(arguments[0])}`
    )
  }

  // determine the object type and ID based on the provided parameters
  if (
    typeof catalogCollectionId !== 'undefined' &&
    catalogCollectionId !== null
  ) {
    return {
      objectType: DB.ObjectType.CATALOG_COLLECTION,
      objectId: catalogCollectionId,
    }
  } else if (
    typeof answerCollectionId !== 'undefined' &&
    answerCollectionId !== null
  ) {
    return {
      objectType: DB.ObjectType.ANSWER_COLLECTION,
      objectId: String(answerCollectionId),
    }
  } else if (typeof elementId !== 'undefined' && elementId !== null) {
    return { objectType: DB.ObjectType.ELEMENT, objectId: String(elementId) }
  } else if (typeof courseId !== 'undefined' && courseId !== null) {
    return { objectType: DB.ObjectType.COURSE, objectId: courseId }
  } else if (typeof liveQuizId !== 'undefined' && liveQuizId !== null) {
    return { objectType: DB.ObjectType.LIVE_QUIZ, objectId: liveQuizId }
  } else if (typeof practiceQuizId !== 'undefined' && practiceQuizId !== null) {
    return { objectType: DB.ObjectType.PRACTICE_QUIZ, objectId: practiceQuizId }
  } else if (
    typeof microLearningId !== 'undefined' &&
    microLearningId !== null
  ) {
    return {
      objectType: DB.ObjectType.MICRO_LEARNING,
      objectId: microLearningId,
    }
  } else if (
    typeof groupActivityId !== 'undefined' &&
    groupActivityId !== null
  ) {
    return {
      objectType: DB.ObjectType.GROUP_ACTIVITY,
      objectId: groupActivityId,
    }
  }

  return { objectType: null, objectId: null }
}
// #endregion

// ! Catalog Collection Operations
// #region
export async function createCatalogCollection(
  { name, access }: { name: string; access: DB.ObjectAccess },
  ctx: ContextWithUser
) {
  const collection = await ctx.prisma.$transaction(async (prisma) => {
    // create the new catalog collection
    const newCollection = await prisma.catalogCollection.create({
      data: { name, access, owner: { connect: { id: ctx.user.sub } } },
      include: { owner: { select: { shortname: true } } },
    })

    // trigger a recomputation of the corresponding derived permission for this new collection
    await recomputeDerivedPermissions(
      { catalogCollectionId: newCollection.id, userId: ctx.user.sub },
      prisma
    )

    return newCollection
  })

  return {
    ...collection,
    ownerShortname: collection.owner?.shortname,
    isOwner: true,
    isManager: true,
    isEditor: true,
    isRequested: false,
    isShared: false,
  }
}

export async function getCatalogCollectionInfo(
  { catalogCollectionId }: { catalogCollectionId?: string | null },
  ctx: ContextWithUser
) {
  if (
    catalogCollectionId === MISSING_CATALOG_COLLECTION_ID ||
    !catalogCollectionId
  ) {
    return null
  }

  // verify that user has at least read permissions on the catalog collection
  const valid = await verifyCatalogCollectionBrowsable(
    { catalogCollectionId },
    ctx
  )

  if (!valid) {
    return null
  }

  const collection = await ctx.prisma.catalogCollection.findUnique({
    where: {
      id: catalogCollectionId,
    },
    include: {
      owner: {
        select: {
          id: true,
          shortname: true,
        },
      },
      permissions: {
        where: {
          userId: ctx.user.sub,
        },
      },
      accessRequests: {
        where: {
          userId: ctx.user.sub,
        },
      },
    },
  })

  if (!collection) {
    return null
  }

  const isRequested = collection.accessRequests.length > 0
  const { isOwner, isManager, isEditor, isShared } =
    collection.permissions.reduce(
      (acc, permission) => {
        const level = permission.permissionLevel
        return {
          isOwner: acc.isOwner || level === DB.PermissionLevel.OWNER,
          isManager:
            acc.isManager ||
            level === DB.PermissionLevel.OWNER ||
            level === DB.PermissionLevel.ADMIN,
          isEditor:
            acc.isEditor ||
            level === DB.PermissionLevel.OWNER ||
            level === DB.PermissionLevel.ADMIN ||
            level === DB.PermissionLevel.WRITE,
          isShared: acc.isShared || level !== DB.PermissionLevel.OWNER,
        }
      },
      { isOwner: false, isManager: false, isEditor: false, isShared: false }
    )

  return {
    ...collection,
    ownerShortname: collection.owner?.shortname,
    isOwner,
    isManager,
    isEditor,
    isRequested,
    isShared,
  }
}

export async function changeCatalogCollectionObjectAccess(
  {
    catalogCollectionId,
    access,
  }: { catalogCollectionId: string; access: DB.ObjectAccess },
  ctx: ContextWithUser
) {
  const collection = await ctx.prisma.$transaction(async (prisma) => {
    // update the access level of the catalog collection
    const updatedCollection = await prisma.catalogCollection.update({
      where: { id: catalogCollectionId },
      data: { access },
    })

    // create an entry in the audit log
    await prisma.auditLogEntry.create({
      data: {
        type: DB.AuditLogType.CATALOG_ASSIGNMENT_MODIFIED,
        objectType: DB.ObjectType.CATALOG_COLLECTION,
        objectId: catalogCollectionId,
        sourceUserId: ctx.user.sub,
        message: `Catalog collection access level changed to ${access}`,
      },
    })

    return updatedCollection
  })

  if (!collection) {
    return false
  }

  // invalidate cache for the updated collection
  ctx.emitter.emit('invalidate', {
    typename: 'CatalogCollection',
    id: collection.id,
  })

  // return success
  return true
}

export async function changeCatalogCollectionName(
  { catalogCollectionId, name }: { catalogCollectionId: string; name: string },
  ctx: ContextWithUser
) {
  // update the access level of the catalog collection
  const updatedCollection = await ctx.prisma.catalogCollection.update({
    where: { id: catalogCollectionId },
    data: { name },
  })

  if (!updatedCollection) {
    return false
  }

  // invalidate cache for the updated collection
  ctx.emitter.emit('invalidate', {
    typename: 'CatalogCollection',
    id: updatedCollection.id,
  })

  // return success
  return true
}

export async function changeCatalogObjectAccess(
  { assignmentId, access }: { assignmentId: number; access: DB.ObjectAccess },
  ctx: ContextWithUser
) {
  const { sufficientPermissions } = await verifyCatalogObjectEditPermissions(
    { assignmentId },
    ctx
  )
  if (!sufficientPermissions) {
    return false
  }

  const updatedAssignment = await ctx.prisma.$transaction(async (prisma) => {
    // change the access level of the assignment
    const newAssignment = await prisma.catalogCollectionAssignment.update({
      where: { id: assignmentId },
      data: { access },
    })

    // create an entry in the audit log
    const { objectType, objectId } = getAuditLogObjectType({
      answerCollectionId: newAssignment.answerCollectionId,
      elementId: newAssignment.elementId,
      courseId: newAssignment.courseId,
      liveQuizId: newAssignment.liveQuizId,
      practiceQuizId: newAssignment.practiceQuizId,
      microLearningId: newAssignment.microLearningId,
      groupActivityId: newAssignment.groupActivityId,
    })
    if (objectType && objectId) {
      await prisma.auditLogEntry.create({
        data: {
          type: DB.AuditLogType.CATALOG_ASSIGNMENT_MODIFIED,
          objectType,
          objectId,
          sourceUserId: ctx.user.sub,
          message: `Catalog object assignment (ID ${newAssignment.id} for ${objectType} with ID ${objectId}) access level changed to ${access}`,
        },
      })
    } else {
      throw new Error(
        `Could not determine object type or ID for audit log entry. Assignment ID: ${newAssignment.id}, Details: ${JSON.stringify(
          {
            answerCollectionId: newAssignment.answerCollectionId,
            elementId: newAssignment.elementId,
            courseId: newAssignment.courseId,
            liveQuizId: newAssignment.liveQuizId,
            practiceQuizId: newAssignment.practiceQuizId,
            microLearningId: newAssignment.microLearningId,
            groupActivityId: newAssignment.groupActivityId,
          }
        )}`
      )
    }

    return newAssignment
  })

  // invalidate cache for the updated assignment
  ctx.emitter.emit('invalidate', {
    typename: 'CatalogCollectionAssignment',
    id: updatedAssignment.id,
  })

  return (
    updatedAssignment.id !== null && typeof updatedAssignment.id !== 'undefined'
  )
}

export async function getCatalogCollectionsList(ctx: ContextWithUser) {
  // function to retrieve all catalog collections except from public ones without any linked objects
  const collections = await ctx.prisma.catalogCollection.findMany({
    where: { id: { not: MISSING_CATALOG_COLLECTION_ID } },
    include: {
      _count: { select: { objectAssignments: true } },
      permissions: { where: { userId: ctx.user.sub } },
      accessRequests: { where: { userId: ctx.user.sub } },
      owner: { select: { shortname: true } },
    },
  })

  const mappedCollections = collections
    .filter(
      (collection) =>
        collection.ownerId === ctx.user.sub ||
        collection.access !== DB.ObjectAccess.PUBLIC ||
        collection._count.objectAssignments !== 0 ||
        collection.permissions.length !== 0
    )
    .map((collection) => {
      const isRequested = collection.accessRequests.length > 0
      const permission = collection.permissions[0] // permission for this user on the catalog collection is unique (if it exists)
      const isOwner = permission?.permissionLevel === DB.PermissionLevel.OWNER
      const isManager =
        permission?.permissionLevel === DB.PermissionLevel.OWNER ||
        permission?.permissionLevel === DB.PermissionLevel.ADMIN
      const isEditor =
        permission?.permissionLevel === DB.PermissionLevel.OWNER ||
        permission?.permissionLevel === DB.PermissionLevel.ADMIN ||
        permission?.permissionLevel === DB.PermissionLevel.WRITE
      const isShared =
        (permission &&
          permission?.permissionLevel !== DB.PermissionLevel.OWNER) ??
        false

      return {
        ...collection,
        ownerShortname: collection.owner?.shortname,
        isOwner,
        isManager,
        isEditor,
        isRequested,
        isShared,
      }
    })

  return mappedCollections
}

export async function requestCatalogCollection(
  {
    catalogCollectionId,
    requestedPermissionLevel,
  }: {
    catalogCollectionId: string
    requestedPermissionLevel?: DB.PermissionLevel | null
  },
  ctx: ContextWithUser
) {
  // fetch the catalog collection including potential pending permission requests
  const catalogCollection = await ctx.prisma.catalogCollection.findUnique({
    where: {
      id: catalogCollectionId,
      // no permissions have been granted so far
      permissions: {
        none: {
          userId: ctx.user.sub,
          permissionLevel: requestedPermissionLevel ?? DB.PermissionLevel.READ,
        },
      },
      // the user has not requested access already
      accessRequests: {
        none: {
          userId: ctx.user.sub,
          permissionLevel: requestedPermissionLevel ?? DB.PermissionLevel.READ,
        },
      },
    },
    include: {
      permissions: {
        where: {
          userId: ctx.user.sub,
          permissionLevel: requestedPermissionLevel ?? DB.PermissionLevel.READ,
        },
      },
      accessRequests: {
        where: {
          userId: ctx.user.sub,
          permissionLevel: requestedPermissionLevel ?? DB.PermissionLevel.READ,
        },
      },
      owner: { select: { shortname: true } },
    },
  })

  // check if requested permission level has already been requested or granted
  if (
    !catalogCollection ||
    catalogCollection.permissions.length > 0 ||
    catalogCollection.accessRequests.length > 0 ||
    !catalogCollection.ownerId
  ) {
    return null
  }

  // find all users with admin or owner permissions on the collection
  const adminOwnerPermissions = await ctx.prisma.derivedPermission.findMany({
    where: {
      catalogCollectionId,
      permissionLevel: {
        in: [DB.PermissionLevel.ADMIN, DB.PermissionLevel.OWNER],
      },
    },
  })

  // if there is no admin or owner on the object anymore, do not allow requesting access to it (nobody could approve such requests)
  if (adminOwnerPermissions.length === 0) {
    console.log(
      'No admin or owner could be found on the catalog collection ',
      catalogCollectionId
    )
    return null
  }

  // upsert access requests for all owners and admins
  const ownerAdminIds = adminOwnerPermissions.map(
    (permission) => permission.userId
  )
  await ctx.prisma.$transaction(async (prisma) => {
    // use promise.allSettled to ensure a correct and complete rollback in case of failure
    const results = await Promise.allSettled(
      ownerAdminIds.map(async (adminOwnerId) => {
        // create the actual access request
        await prisma.accessRequest.upsert({
          where: {
            catalogCollectionId_userId_objectAdminOrOwnerId: {
              catalogCollectionId,
              userId: ctx.user.sub,
              objectAdminOrOwnerId: adminOwnerId,
            },
          },
          create: {
            permissionLevel:
              requestedPermissionLevel ?? DB.PermissionLevel.READ,
            catalogCollection: {
              connect: {
                id: catalogCollectionId,
              },
            },
            user: {
              connect: {
                id: ctx.user.sub,
              },
            },
            objectAdminOrOwner: {
              connect: {
                id: adminOwnerId,
              },
            },
          },
          update: {
            permissionLevel:
              requestedPermissionLevel ?? DB.PermissionLevel.READ,
          },
        })

        // create an entry in the audit log
        await prisma.auditLogEntry.create({
          data: {
            type: DB.AuditLogType.REQUEST_CREATED,
            objectType: DB.ObjectType.CATALOG_COLLECTION,
            objectId: catalogCollectionId,
            sourceUserId: ctx.user.sub,
            targetUserId: adminOwnerId,
            message: `Access request (permission level ${requestedPermissionLevel ?? DB.PermissionLevel.READ}) created for ${DB.ObjectType.CATALOG_COLLECTION} (ID ${catalogCollectionId}) by user ${ctx.user.sub} for owner / admin ${adminOwnerId}.`,
          },
        })
      })
    )

    // check if all promises were fulfilled
    const allFulfilled = results.every(
      (result) => result.status === 'fulfilled'
    )
    if (!allFulfilled) {
      throw new Error(
        `Failed to create access requests for catalog collection ${catalogCollectionId}: ${JSON.stringify(
          results
        )}`
      )
    }
  })

  // invalidate cache for the imported collection
  ctx.emitter.emit('invalidate', {
    typename: 'CatalogCollection',
    id: catalogCollection?.id,
  })

  // return updated catalog collection object
  return {
    ...catalogCollection,
    ownerShortname: catalogCollection.owner?.shortname,
    isOwner: false,
    isManager: false,
    isEditor: false,
    isRequested: true,
    isShared: false,
  }
}

export async function deleteCatalogCollection(
  { catalogCollectionId }: { catalogCollectionId: string },
  ctx: ContextWithUser
) {
  // delete the catalog collection
  const deletedCollection = await ctx.prisma.catalogCollection.delete({
    where: {
      id: catalogCollectionId,
    },
  })

  // invalidate cache for the deleted collection
  ctx.emitter.emit('invalidate', {
    typename: 'CatalogCollection',
    id: catalogCollectionId,
  })

  return deletedCollection.id
}
// #endregion

// ! Request, Query and Resolve Sharing Requests
// #region
export async function countCatalogSharingRequests(ctx: ContextWithUser) {
  const user = await ctx.prisma.user.findUnique({
    where: { id: ctx.user.sub },
    include: { pendingRequests: true },
  })

  if (!user) {
    return 0
  }

  return user.pendingRequests.length
}

export async function getCatalogSharingRequests(ctx: ContextWithUser) {
  const user = await ctx.prisma.user.findUnique({
    where: { id: ctx.user.sub },
    include: {
      pendingRequests: {
        include: {
          user: { select: { shortname: true, email: true } },
          catalogCollection: { select: { name: true } },
          answerCollection: { select: { name: true } },
          element: { select: { name: true } },
          course: { select: { name: true } },
          liveQuiz: { select: { name: true } },
          practiceQuiz: { select: { name: true } },
          microLearning: { select: { name: true } },
          groupActivity: { select: { name: true } },
        },
      },
    },
  })

  if (!user) {
    return null
  }

  const sharingRequests = user.pendingRequests.reduce<ObjectSharingRequest[]>(
    (acc, request) => {
      const sharedRequestAttributes = {
        requestId: request.id,
        userId: request.userId,
        userShortname: request.user.shortname,
        userEmail: request.user.email,
      }

      // sharing request for catalog collection
      if (
        typeof request.catalogCollection !== 'undefined' &&
        request.catalogCollection !== null
      ) {
        acc.push({
          ...sharedRequestAttributes,
          objectName: request.catalogCollection.name,
          objectType: DB.ObjectType.CATALOG_COLLECTION,
        })
      }

      // sharing request for answer collection
      else if (
        typeof request.answerCollection !== 'undefined' &&
        request.answerCollection !== null
      ) {
        acc.push({
          ...sharedRequestAttributes,
          objectName: request.answerCollection.name,
          objectType: DB.ObjectType.ANSWER_COLLECTION,
        })
      }

      // sharing request for element
      else if (
        typeof request.element !== 'undefined' &&
        request.element !== null
      ) {
        acc.push({
          ...sharedRequestAttributes,
          objectName: request.element.name,
          objectType: DB.ObjectType.ELEMENT,
        })
      }

      // TODO: add more object types as soon as they can be requested / shared

      return acc
    },
    []
  )

  return sharingRequests
}

export async function requestCatalogObject(
  // one of the object ids should be defined for the object that is to be added to the catalog
  // otherwise, the function will return failure
  {
    requestedPermissionLevel,
    catalogCollectionId, // catalog collection id to which the shared object should be added to
    answerCollectionId,
    elementId,
    courseId,
    liveQuizId,
    practiceQuizId,
    microLearningId,
    groupActivityId,
  }: {
    requestedPermissionLevel?: DB.PermissionLevel | null
    catalogCollectionId?: string | null
    answerCollectionId?: number
    elementId?: number
    courseId?: string
    liveQuizId?: string
    practiceQuizId?: string
    microLearningId?: string
    groupActivityId?: string
  },
  ctx: ContextWithUser
) {
  // verify that the user has access to the catalog collection the answer collection is contained in
  const validAccess = catalogCollectionId
    ? await verifyCatalogCollectionBrowsable({ catalogCollectionId }, ctx)
    : true

  if (!validAccess) {
    return false
  }

  // collect the required object information to create the permission request
  let objectInfo:
    | {
        existingPermission: boolean
        existingRequest: boolean
      }
    | undefined = undefined

  if (typeof answerCollectionId !== 'undefined') {
    // fetch the answer collection including potential pending permission requests
    const collection = await ctx.prisma.answerCollection.findUnique({
      where: {
        id: answerCollectionId,
        // no permissions have been granted so far
        permissions: {
          none: {
            userId: ctx.user.sub,
            permissionLevel:
              requestedPermissionLevel ?? DB.PermissionLevel.READ,
          },
        },
        // the user has not requested access already
        accessRequests: {
          none: {
            userId: ctx.user.sub,
            permissionLevel:
              requestedPermissionLevel ?? DB.PermissionLevel.READ,
          },
        },
      },
      include: {
        permissions: {
          where: {
            userId: ctx.user.sub,
            permissionLevel:
              requestedPermissionLevel ?? DB.PermissionLevel.READ,
          },
        },
        accessRequests: {
          where: {
            userId: ctx.user.sub,
            permissionLevel:
              requestedPermissionLevel ?? DB.PermissionLevel.READ,
          },
        },
      },
    })

    if (!collection) {
      return false
    }

    // set the object information
    objectInfo = {
      existingPermission: collection.permissions.length > 0,
      existingRequest: collection.accessRequests.length > 0,
    }
  } else if (typeof elementId !== 'undefined') {
    // fetch the element including potential pending permission requests
    const element = await ctx.prisma.element.findUnique({
      where: {
        id: elementId,
        // no permissions have been granted so far
        permissions: {
          none: {
            userId: ctx.user.sub,
            permissionLevel:
              requestedPermissionLevel ?? DB.PermissionLevel.READ,
          },
        },
        // the user has not requested access already
        accessRequests: {
          none: {
            userId: ctx.user.sub,
            permissionLevel:
              requestedPermissionLevel ?? DB.PermissionLevel.READ,
          },
        },
      },
      include: {
        permissions: {
          where: {
            userId: ctx.user.sub,
            permissionLevel:
              requestedPermissionLevel ?? DB.PermissionLevel.READ,
          },
        },
        accessRequests: {
          where: {
            userId: ctx.user.sub,
            permissionLevel:
              requestedPermissionLevel ?? DB.PermissionLevel.READ,
          },
        },
      },
    })

    if (!element) {
      return false
    }

    // set the object information
    objectInfo = {
      existingPermission: element.permissions.length > 0,
      existingRequest: element.accessRequests.length > 0,
    }
  }
  // TODO: ... add more object types once they are supported for sharing
  else {
    return false
  }

  // check if access with requested level has already been requested / granted
  if (
    typeof objectInfo === 'undefined' ||
    objectInfo.existingPermission ||
    objectInfo.existingRequest
  ) {
    return false
  }

  // find all users with admin or owner permissions on the object
  const adminOwnerPermissions = await ctx.prisma.derivedPermission.findMany({
    where: {
      permissionLevel: {
        in: [DB.PermissionLevel.ADMIN, DB.PermissionLevel.OWNER],
      },
      answerCollectionId,
      elementId,
      courseId,
      liveQuizId,
      practiceQuizId,
      microLearningId,
      groupActivityId,
    },
  })

  // if there is no admin or owner on the object anymore, do not allow requesting access to it (nobody could approve such requests)
  if (adminOwnerPermissions.length === 0) {
    console.log(
      'No admin or owner could be found on the catalog collection ',
      catalogCollectionId
    )
    return false
  }

  // upsert access requests for all owners and admins
  const ownerAdminIds = adminOwnerPermissions.map(
    (permission) => permission.userId
  )
  await ctx.prisma.$transaction(async (prisma) => {
    // use promise.allSettled to ensure a correct and complete rollback in case of failure
    const results = await Promise.allSettled(
      ownerAdminIds.map(async (adminOwnerId) => {
        // create the actual access request
        await prisma.accessRequest.upsert({
          where: {
            answerCollectionId_userId_objectAdminOrOwnerId:
              typeof answerCollectionId !== 'undefined'
                ? {
                    answerCollectionId,
                    userId: ctx.user.sub,
                    objectAdminOrOwnerId: adminOwnerId,
                  }
                : undefined,
            elementId_userId_objectAdminOrOwnerId:
              typeof elementId !== 'undefined'
                ? {
                    elementId,
                    userId: ctx.user.sub,
                    objectAdminOrOwnerId: adminOwnerId,
                  }
                : undefined,
            courseId_userId_objectAdminOrOwnerId:
              typeof courseId !== 'undefined'
                ? {
                    courseId,
                    userId: ctx.user.sub,
                    objectAdminOrOwnerId: adminOwnerId,
                  }
                : undefined,
            liveQuizId_userId_objectAdminOrOwnerId:
              typeof liveQuizId !== 'undefined'
                ? {
                    liveQuizId,
                    userId: ctx.user.sub,
                    objectAdminOrOwnerId: adminOwnerId,
                  }
                : undefined,
            practiceQuizId_userId_objectAdminOrOwnerId:
              typeof practiceQuizId !== 'undefined'
                ? {
                    practiceQuizId,
                    userId: ctx.user.sub,
                    objectAdminOrOwnerId: adminOwnerId,
                  }
                : undefined,
            microLearningId_userId_objectAdminOrOwnerId:
              typeof microLearningId !== 'undefined'
                ? {
                    microLearningId,
                    userId: ctx.user.sub,
                    objectAdminOrOwnerId: adminOwnerId,
                  }
                : undefined,
            groupActivityId_userId_objectAdminOrOwnerId:
              typeof groupActivityId !== 'undefined'
                ? {
                    groupActivityId,
                    userId: ctx.user.sub,
                    objectAdminOrOwnerId: adminOwnerId,
                  }
                : undefined,
          },
          create: {
            permissionLevel:
              requestedPermissionLevel ?? DB.PermissionLevel.READ,
            user: {
              connect: {
                id: ctx.user.sub,
              },
            },
            objectAdminOrOwner: {
              connect: {
                id: adminOwnerId,
              },
            },
            answerCollection:
              typeof answerCollectionId !== 'undefined'
                ? {
                    connect: {
                      id: answerCollectionId,
                    },
                  }
                : undefined,
            element:
              typeof elementId !== 'undefined'
                ? {
                    connect: {
                      id: elementId,
                    },
                  }
                : undefined,
            course:
              typeof courseId !== 'undefined'
                ? {
                    connect: {
                      id: courseId,
                    },
                  }
                : undefined,
            liveQuiz:
              typeof liveQuizId !== 'undefined'
                ? {
                    connect: {
                      id: liveQuizId,
                    },
                  }
                : undefined,
            practiceQuiz:
              typeof practiceQuizId !== 'undefined'
                ? {
                    connect: {
                      id: practiceQuizId,
                    },
                  }
                : undefined,
            microLearning:
              typeof microLearningId !== 'undefined'
                ? {
                    connect: {
                      id: microLearningId,
                    },
                  }
                : undefined,
            groupActivity:
              typeof groupActivityId !== 'undefined'
                ? {
                    connect: {
                      id: groupActivityId,
                    },
                  }
                : undefined,
          },
          update: {
            permissionLevel:
              requestedPermissionLevel ?? DB.PermissionLevel.READ,
          },
        })

        // create an entry in the audit log
        const { objectType, objectId } = getAuditLogObjectType({
          answerCollectionId,
          elementId,
          courseId,
          liveQuizId,
          practiceQuizId,
          microLearningId,
          groupActivityId,
        })
        if (objectType && objectId) {
          await prisma.auditLogEntry.create({
            data: {
              type: DB.AuditLogType.REQUEST_CREATED,
              objectType,
              objectId,
              sourceUserId: ctx.user.sub,
              targetUserId: adminOwnerId,
              message: `Access request (permission level ${requestedPermissionLevel ?? DB.PermissionLevel.READ}) created for ${objectType} (ID ${objectId}) by user ${ctx.user.sub} for owner / admin ${adminOwnerId}.`,
            },
          })
        } else {
          throw new Error(
            `Could not determine object type or ID for audit log entry. Request ID: ${answerCollectionId}, Details: ${JSON.stringify(
              {
                answerCollectionId,
                elementId,
                courseId,
                liveQuizId,
                practiceQuizId,
                microLearningId,
                groupActivityId,
              }
            )}`
          )
        }
      })
    )

    // check if all promises were fulfilled
    const allFulfilled = results.every(
      (result) => result.status === 'fulfilled'
    )
    if (!allFulfilled) {
      throw new Error(
        `Failed to create access requests for catalog collection ${catalogCollectionId}: ${JSON.stringify(
          results
        )}`
      )
    }
  })

  // invalidate cache for the imported object
  if (typeof catalogCollectionId !== 'undefined') {
    ctx.emitter.emit('invalidate', {
      typename: 'CatalogCollection',
      id: catalogCollectionId,
    })
  } else if (typeof answerCollectionId !== 'undefined') {
    ctx.emitter.emit('invalidate', {
      typename: 'AnswerCollection',
      id: answerCollectionId,
    })
  } else if (typeof elementId !== 'undefined') {
    ctx.emitter.emit('invalidate', {
      typename: 'Element',
      id: elementId,
    })
  } else if (typeof courseId !== 'undefined') {
    ctx.emitter.emit('invalidate', {
      typename: 'Course',
      id: courseId,
    })
  } else if (typeof liveQuizId !== 'undefined') {
    ctx.emitter.emit('invalidate', {
      typename: 'LiveQuiz',
      id: liveQuizId,
    })
  } else if (typeof practiceQuizId !== 'undefined') {
    ctx.emitter.emit('invalidate', {
      typename: 'PracticeQuiz',
      id: practiceQuizId,
    })
  } else if (typeof microLearningId !== 'undefined') {
    ctx.emitter.emit('invalidate', {
      typename: 'MicroLearning',
      id: microLearningId,
    })
  } else if (typeof groupActivityId !== 'undefined') {
    ctx.emitter.emit('invalidate', {
      typename: 'GroupActivity',
      id: groupActivityId,
    })
  }

  // TODO: update return value to success of transaction
  return true
}

export async function cancelObjectSharingRequest(
  {
    answerCollectionId,
    elementId,
    courseId,
    liveQuizId,
    practiceQuizId,
    microLearningId,
    groupActivityId,
  }: {
    answerCollectionId?: number
    elementId?: number
    courseId?: string
    liveQuizId?: string
    practiceQuizId?: string
    microLearningId?: string
    groupActivityId?: string
  },
  ctx: ContextWithUser
) {
  // verify that the user has requested access to the collection
  const requests = await ctx.prisma.accessRequest.findMany({
    where: {
      userId: ctx.user.sub,
      answerCollectionId,
      elementId,
      courseId,
      liveQuizId,
      practiceQuizId,
      microLearningId,
      groupActivityId,
    },
  })

  if (requests.length === 0) {
    return false
  }

  await ctx.prisma.$transaction(async (prisma) => {
    // remove the access request
    await prisma.accessRequest.deleteMany({
      where: {
        userId: ctx.user.sub,
        answerCollectionId,
        elementId,
        courseId,
        liveQuizId,
        practiceQuizId,
        microLearningId,
        groupActivityId,
      },
    })

    // create an audit log entry for the deleted access request
    const { objectType, objectId } = getAuditLogObjectType({
      answerCollectionId,
      elementId,
      courseId,
      liveQuizId,
      practiceQuizId,
      microLearningId,
      groupActivityId,
    })

    if (objectType !== null && objectId !== null) {
      await prisma.auditLogEntry.create({
        data: {
          type: DB.AuditLogType.REQUEST_CANCELLED,
          objectType,
          objectId,
          sourceUserId: ctx.user.sub,
          message: `Access request cancelled for ${objectType} (ID ${objectId}) by user ${ctx.user.sub}.`,
        },
      })
    } else {
      throw new Error(
        `Could not determine object type or ID for audit log entry. Request ID: ${answerCollectionId}, Details: ${JSON.stringify(
          {
            answerCollectionId,
            elementId,
            courseId,
            liveQuizId,
            practiceQuizId,
            microLearningId,
            groupActivityId,
          }
        )}`
      )
    }
  })

  // invalidate all access requests that were deleted
  for (const request of requests) {
    ctx.emitter.emit('invalidate', {
      typename: 'AccessRequest',
      id: request.id,
    })
  }

  // invalidate the related objects
  if (typeof answerCollectionId !== 'undefined') {
    ctx.emitter.emit('invalidate', {
      typename: 'AnswerCollection',
      id: answerCollectionId,
    })
  } else if (typeof elementId !== 'undefined') {
    ctx.emitter.emit('invalidate', {
      typename: 'Element',
      id: elementId,
    })
  } else if (typeof courseId !== 'undefined') {
    ctx.emitter.emit('invalidate', {
      typename: 'Course',
      id: courseId,
    })
  } else if (typeof liveQuizId !== 'undefined') {
    ctx.emitter.emit('invalidate', {
      typename: 'LiveQuiz',
      id: liveQuizId,
    })
  } else if (typeof practiceQuizId !== 'undefined') {
    ctx.emitter.emit('invalidate', {
      typename: 'PracticeQuiz',
      id: practiceQuizId,
    })
  } else if (typeof microLearningId !== 'undefined') {
    ctx.emitter.emit('invalidate', {
      typename: 'MicroLearning',
      id: microLearningId,
    })
  } else if (typeof groupActivityId !== 'undefined') {
    ctx.emitter.emit('invalidate', {
      typename: 'GroupActivity',
      id: groupActivityId,
    })
  }

  return true
}

export async function resolveObjectSharingRequest(
  {
    requestId,
    userId,
    permissionLevel,
    approved,
    propagation,
  }: {
    requestId: number
    userId: string
    permissionLevel: DB.PermissionLevel
    approved: boolean
    propagation: boolean
  },
  ctx: ContextWithUser
) {
  // check that an access request is available for the user
  const pendingRequest = await ctx.prisma.accessRequest.findUnique({
    where: {
      id: requestId,
      userId,
      objectAdminOrOwnerId: ctx.user.sub,
    },
  })

  if (!pendingRequest) {
    return false
  }

  await ctx.prisma.$transaction(
    async (prisma) => {
      if (approved) {
        // add a direct permission for the user with approved request
        await prisma.permission.upsert({
          where: {
            catalogCollectionId_userId:
              pendingRequest.catalogCollectionId !== null
                ? {
                    catalogCollectionId: pendingRequest.catalogCollectionId,
                    userId,
                  }
                : undefined,
            answerCollectionId_userId:
              pendingRequest.answerCollectionId !== null
                ? {
                    answerCollectionId: pendingRequest.answerCollectionId,
                    userId,
                  }
                : undefined,
            elementId_userId:
              pendingRequest.elementId !== null
                ? {
                    elementId: pendingRequest.elementId,
                    userId,
                  }
                : undefined,
            courseId_userId:
              pendingRequest.courseId !== null
                ? {
                    courseId: pendingRequest.courseId,
                    userId,
                  }
                : undefined,
            liveQuizId_userId:
              pendingRequest.liveQuizId !== null
                ? {
                    liveQuizId: pendingRequest.liveQuizId,
                    userId,
                  }
                : undefined,
            practiceQuizId_userId:
              pendingRequest.practiceQuizId !== null
                ? {
                    practiceQuizId: pendingRequest.practiceQuizId,
                    userId,
                  }
                : undefined,
            microLearningId_userId:
              pendingRequest.microLearningId !== null
                ? {
                    microLearningId: pendingRequest.microLearningId,
                    userId,
                  }
                : undefined,
            groupActivityId_userId:
              pendingRequest.groupActivityId !== null
                ? {
                    groupActivityId: pendingRequest.groupActivityId,
                    userId,
                  }
                : undefined,
          },
          create: {
            permissionLevel,
            propagation,
            user: {
              connect: {
                id: userId,
              },
            },
            catalogCollection:
              pendingRequest.catalogCollectionId !== null
                ? {
                    connect: {
                      id: pendingRequest.catalogCollectionId,
                    },
                  }
                : undefined,
            answerCollection:
              pendingRequest.answerCollectionId !== null
                ? {
                    connect: {
                      id: pendingRequest.answerCollectionId,
                    },
                  }
                : undefined,
            element:
              pendingRequest.elementId !== null
                ? {
                    connect: {
                      id: pendingRequest.elementId,
                    },
                  }
                : undefined,
            course:
              pendingRequest.courseId !== null
                ? {
                    connect: {
                      id: pendingRequest.courseId,
                    },
                  }
                : undefined,
            liveQuiz:
              pendingRequest.liveQuizId !== null
                ? {
                    connect: {
                      id: pendingRequest.liveQuizId,
                    },
                  }
                : undefined,
            practiceQuiz:
              pendingRequest.practiceQuizId !== null
                ? {
                    connect: {
                      id: pendingRequest.practiceQuizId,
                    },
                  }
                : undefined,
            microLearning:
              pendingRequest.microLearningId !== null
                ? {
                    connect: {
                      id: pendingRequest.microLearningId,
                    },
                  }
                : undefined,
            groupActivity:
              pendingRequest.groupActivityId !== null
                ? {
                    connect: {
                      id: pendingRequest.groupActivityId,
                    },
                  }
                : undefined,
          },
          update: {},
        })
      }

      // remove the access request
      await prisma.accessRequest.deleteMany({
        where: {
          userId,
          catalogCollectionId: pendingRequest.catalogCollectionId ?? undefined,
          answerCollectionId: pendingRequest.answerCollectionId ?? undefined,
          elementId: pendingRequest.elementId ?? undefined,
          courseId: pendingRequest.courseId ?? undefined,
          liveQuizId: pendingRequest.liveQuizId ?? undefined,
          practiceQuizId: pendingRequest.practiceQuizId ?? undefined,
          microLearningId: pendingRequest.microLearningId ?? undefined,
          groupActivityId: pendingRequest.groupActivityId ?? undefined,
        },
      })

      // create an audit log entry for the resolved access request
      const { objectType, objectId } = getAuditLogObjectType({
        catalogCollectionId: pendingRequest.catalogCollectionId,
        answerCollectionId: pendingRequest.answerCollectionId,
        elementId: pendingRequest.elementId,
        courseId: pendingRequest.courseId,
        liveQuizId: pendingRequest.liveQuizId,
        practiceQuizId: pendingRequest.practiceQuizId,
        microLearningId: pendingRequest.microLearningId,
        groupActivityId: pendingRequest.groupActivityId,
      })
      if (objectType && objectId) {
        await prisma.auditLogEntry.create({
          data: {
            type: DB.AuditLogType.REQUEST_RESOLVED,
            objectType,
            objectId,
            sourceUserId: ctx.user.sub,
            targetUserId: userId,
            message: `Access request ${
              approved
                ? `approved (with permission level ${permissionLevel})`
                : 'declined'
            } for ${objectType} (ID ${objectId}) by owner / admin ${ctx.user.sub} for user ${userId}.`,
          },
        })
      } else {
        throw new Error(
          `Could not determine object type or ID for audit log entry. Request ID: ${requestId}, Details: ${JSON.stringify(
            {
              catalogCollectionId: pendingRequest.catalogCollectionId,
              answerCollectionId: pendingRequest.answerCollectionId,
              elementId: pendingRequest.elementId,
              courseId: pendingRequest.courseId,
              liveQuizId: pendingRequest.liveQuizId,
              practiceQuizId: pendingRequest.practiceQuizId,
              microLearningId: pendingRequest.microLearningId,
              groupActivityId: pendingRequest.groupActivityId,
            }
          )}`
        )
      }

      // trigger recomputation of derived permissions within the same transaction
      const updateAccessRequests = permissionLevel === DB.PermissionLevel.ADMIN
      if (pendingRequest.catalogCollectionId !== null) {
        await recomputeDerivedPermissions(
          {
            userId,
            updateAccessRequests,
            catalogCollectionId: pendingRequest.catalogCollectionId,
          },
          prisma
        )
      } else if (pendingRequest.answerCollectionId !== null) {
        await recomputeDerivedPermissions(
          {
            userId,
            updateAccessRequests,
            answerCollectionId: pendingRequest.answerCollectionId,
          },
          prisma
        )
      } else if (pendingRequest.elementId !== null) {
        await recomputeDerivedPermissions(
          {
            userId,
            updateAccessRequests,
            elementId: pendingRequest.elementId,
          },
          prisma
        )
      } else if (pendingRequest.courseId !== null) {
        await recomputeDerivedPermissions(
          {
            userId,
            updateAccessRequests,
            courseId: pendingRequest.courseId,
          },
          prisma
        )
      } else if (pendingRequest.liveQuizId !== null) {
        await recomputeDerivedPermissions(
          {
            userId,
            updateAccessRequests,
            liveQuizId: pendingRequest.liveQuizId,
          },
          prisma
        )
      } else if (pendingRequest.practiceQuizId !== null) {
        await recomputeDerivedPermissions(
          {
            userId,
            updateAccessRequests,
            practiceQuizId: pendingRequest.practiceQuizId,
          },
          prisma
        )
      } else if (pendingRequest.microLearningId !== null) {
        await recomputeDerivedPermissions(
          {
            userId,
            updateAccessRequests,
            microLearningId: pendingRequest.microLearningId,
          },
          prisma
        )
      } else if (pendingRequest.groupActivityId !== null) {
        await recomputeDerivedPermissions(
          {
            userId,
            updateAccessRequests,
            groupActivityId: pendingRequest.groupActivityId,
          },
          prisma
        )
      }
    },
    { timeout: 60000 }
  )

  // invalidate the related objects
  if (pendingRequest.catalogCollectionId !== null) {
    ctx.emitter.emit('invalidate', {
      typename: 'CatalogCollection',
      id: pendingRequest.catalogCollectionId,
    })
  } else if (pendingRequest.answerCollectionId !== null) {
    ctx.emitter.emit('invalidate', {
      typename: 'AnswerCollection',
      id: pendingRequest.answerCollectionId,
    })
  } else if (pendingRequest.elementId !== null) {
    ctx.emitter.emit('invalidate', {
      typename: 'Element',
      id: pendingRequest.elementId,
    })
  } else if (pendingRequest.courseId !== null) {
    ctx.emitter.emit('invalidate', {
      typename: 'Course',
      id: pendingRequest.courseId,
    })
  } else if (pendingRequest.liveQuizId !== null) {
    ctx.emitter.emit('invalidate', {
      typename: 'LiveQuiz',
      id: pendingRequest.liveQuizId,
    })
  } else if (pendingRequest.practiceQuizId !== null) {
    ctx.emitter.emit('invalidate', {
      typename: 'PracticeQuiz',
      id: pendingRequest.practiceQuizId,
    })
  } else if (pendingRequest.microLearningId !== null) {
    ctx.emitter.emit('invalidate', {
      typename: 'MicroLearning',
      id: pendingRequest.microLearningId,
    })
  } else if (pendingRequest.groupActivityId !== null) {
    ctx.emitter.emit('invalidate', {
      typename: 'GroupActivity',
      id: pendingRequest.groupActivityId,
    })
  }

  return true
}
// #endregion

// ! Permission Levels and Permission Revocation
// #region
export async function changeObjectPermissionLevel(
  {
    permissionId,
    permissionLevel,
    propagation,
    catalogCollectionId,
    answerCollectionId,
    elementId,
    courseId,
    liveQuizId,
    practiceQuizId,
    microLearningId,
    groupActivityId,
  }: {
    permissionId: number
    permissionLevel: DB.PermissionLevel
    propagation: boolean
    catalogCollectionId?: string
    answerCollectionId?: number
    elementId?: number
    courseId?: string
    liveQuizId?: string
    practiceQuizId?: string
    microLearningId?: string
    groupActivityId?: string
  },
  ctx: ContextWithUser
) {
  const previousPermission = await ctx.prisma.permission.findUnique({
    where: {
      id: permissionId,
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

  if (!previousPermission) {
    return false
  }

  // fetch the user group of the updated permission
  const userGroup =
    previousPermission.userGroupId !== null
      ? await ctx.prisma.userGroup.findUnique({
          where: { id: previousPermission.userGroupId },
          include: { members: true, admins: true },
        })
      : null

  // execute the update and recomputation in a single transaction
  const permission = await ctx.prisma.$transaction(
    async (prisma) => {
      // update the access level of the permission
      const updatedPermission = await prisma.permission.update({
        where: {
          id: permissionId,
          catalogCollectionId,
          answerCollectionId,
          elementId,
          courseId,
          liveQuizId,
          practiceQuizId,
          microLearningId,
          groupActivityId,
        },
        data: {
          permissionLevel,
          propagation,
        },
      })

      // if the permission does not exist, return early
      if (!updatedPermission) {
        return false
      }

      // if the permission exists, trigger recomputation of derived permissions, potentially update the access requests and log the change
      const affectedUserIds = updatedPermission.userId
        ? [updatedPermission.userId]
        : userGroup
          ? [
              userGroup.ownerId,
              ...userGroup.admins.map((admin) => admin.id),
              ...userGroup.members.map((member) => member.id),
            ]
          : []

      // if an admin permission was granted or revoked, update the access request instances
      const updateAccessRequests =
        (previousPermission.permissionLevel !== DB.PermissionLevel.ADMIN &&
          permissionLevel === DB.PermissionLevel.ADMIN) ||
        (previousPermission.permissionLevel === DB.PermissionLevel.ADMIN &&
          permissionLevel !== DB.PermissionLevel.ADMIN)

      for (const affectedUserId of affectedUserIds) {
        if (typeof catalogCollectionId !== 'undefined') {
          await recomputeDerivedPermissions(
            {
              catalogCollectionId,
              userId: affectedUserId,
              updateAccessRequests,
            },
            prisma
          )
        } else if (typeof answerCollectionId !== 'undefined') {
          await recomputeDerivedPermissions(
            {
              answerCollectionId,
              userId: affectedUserId,
              updateAccessRequests,
            },
            prisma
          )
        } else if (typeof elementId !== 'undefined') {
          await recomputeDerivedPermissions(
            { elementId, userId: affectedUserId, updateAccessRequests },
            prisma
          )
        } else if (typeof courseId !== 'undefined') {
          await recomputeDerivedPermissions(
            { courseId, userId: affectedUserId, updateAccessRequests },
            prisma
          )
        } else if (typeof liveQuizId !== 'undefined') {
          await recomputeDerivedPermissions(
            { liveQuizId, userId: affectedUserId, updateAccessRequests },
            prisma
          )
        } else if (typeof practiceQuizId !== 'undefined') {
          await recomputeDerivedPermissions(
            {
              practiceQuizId,
              userId: affectedUserId,
              updateAccessRequests,
            },
            prisma
          )
        } else if (typeof microLearningId !== 'undefined') {
          await recomputeDerivedPermissions(
            {
              microLearningId,
              userId: affectedUserId,
              updateAccessRequests,
            },
            prisma
          )
        } else if (typeof groupActivityId !== 'undefined') {
          await recomputeDerivedPermissions(
            {
              groupActivityId,
              userId: affectedUserId,
              updateAccessRequests,
            },
            prisma
          )
        }
      }

      // create an audit log entry for the updated permission
      const { objectType, objectId } = getAuditLogObjectType({
        catalogCollectionId,
        answerCollectionId,
        elementId,
        courseId,
        liveQuizId,
        practiceQuizId,
        microLearningId,
        groupActivityId,
      })
      if (objectType && objectId) {
        await prisma.auditLogEntry.create({
          data: {
            type: DB.AuditLogType.PERMISSION_MODIFIED,
            objectType,
            objectId,
            sourceUserId: ctx.user.sub,
            targetUserId: updatedPermission.userId ?? undefined,
            targetUserGroupId: updatedPermission.userGroupId ?? undefined,
            message: `Permission level changed from ${previousPermission.permissionLevel} to ${permissionLevel} for ${objectType} (ID ${objectId}) through owner / admin ${ctx.user.sub} for ${updatedPermission.userId ? `user ${updatedPermission.userId}` : `user group ${updatedPermission.userGroupId}`}.`,
          },
        })
      } else {
        throw new Error(
          `Could not determine object type or ID for audit log entry. Permission ID: ${permissionId}, Details: ${JSON.stringify(
            {
              catalogCollectionId,
              answerCollectionId,
              elementId,
              courseId,
              liveQuizId,
              practiceQuizId,
              microLearningId,
              groupActivityId,
            }
          )}`
        )
      }

      return updatedPermission
    },
    { timeout: 60000 }
  )

  // if the permission did not exist in the first place, return null
  if (!permission) {
    return false
  }

  // invalidate permission
  ctx.emitter.emit('invalidate', {
    typename: 'Permission',
    id: permission.id,
  })

  return true
}

export async function revokeObjectAccess(
  {
    permissionId,
    catalogCollectionId,
    answerCollectionId,
    elementId,
    courseId,
    liveQuizId,
    practiceQuizId,
    microLearningId,
    groupActivityId,
  }: {
    permissionId: number
    catalogCollectionId?: string
    answerCollectionId?: number
    elementId?: number
    courseId?: string
    liveQuizId?: string
    practiceQuizId?: string
    microLearningId?: string
    groupActivityId?: string
  },
  ctx: ContextWithUser
) {
  // verify that the direct permission belongs to the specified object
  const permission = await ctx.prisma.permission.findUnique({
    where: {
      id: permissionId,
      catalogCollectionId,
      answerCollectionId,
      elementId,
      courseId,
      liveQuizId,
      practiceQuizId,
      microLearningId,
      groupActivityId,
    },
    include: {
      user: {
        select: {
          id: true,
        },
      },
    },
  })

  const userGroup =
    typeof permission?.userGroupId !== 'undefined' &&
    permission?.userGroupId !== null
      ? await ctx.prisma.userGroup.findUnique({
          where: { id: permission.userGroupId },
          include: { members: true, admins: true },
        })
      : null

  if (!permission || permission.id !== permissionId) {
    return null
  }

  // delete the direct permission and recompute derived permissions
  const deletedPermission = await ctx.prisma.$transaction(
    async (prisma) => {
      const deleted = await prisma.permission.delete({
        where: { id: permissionId },
      })

      // add an audit log entry for the revoked permission
      const { objectType, objectId } = getAuditLogObjectType({
        catalogCollectionId,
        answerCollectionId,
        elementId,
        courseId,
        liveQuizId,
        practiceQuizId,
        microLearningId,
        groupActivityId,
      })
      if (objectType && objectId) {
        await prisma.auditLogEntry.create({
          data: {
            type: DB.AuditLogType.PERMISSION_REVOKED,
            objectType,
            objectId,
            sourceUserId: ctx.user.sub,
            targetUserId: permission.userId ?? undefined,
            targetUserGroupId: permission.userGroupId ?? undefined,
            message: `Permission revoked for ${objectType} (ID ${objectId}) by owner / admin ${ctx.user.sub} for ${permission.user?.id ? `user ${permission.user?.id}` : `user group ${permission.userGroupId}`}.`,
          },
        })
      } else {
        throw new Error(
          `Could not determine object type or ID for audit log entry. Permission ID: ${permissionId}, Details: ${JSON.stringify(
            {
              catalogCollectionId,
              answerCollectionId,
              elementId,
              courseId,
              liveQuizId,
              practiceQuizId,
              microLearningId,
              groupActivityId,
            }
          )}`
        )
      }

      // compute the users affected by this permission revocation
      const affectedUserIds = permission.userId
        ? [permission.userId]
        : userGroup
          ? [
              userGroup.ownerId,
              ...userGroup.admins.map((admin) => admin.id),
              ...userGroup.members.map((member) => member.id),
            ]
          : []

      for (const affectedUserId of affectedUserIds) {
        // update the derived permissions of all affected users
        if (typeof catalogCollectionId !== 'undefined') {
          await recomputeDerivedPermissions(
            {
              catalogCollectionId,
              userId: affectedUserId,
              updateAccessRequests: false,
            },
            prisma
          )
        } else if (typeof answerCollectionId !== 'undefined') {
          await recomputeDerivedPermissions(
            {
              answerCollectionId,
              userId: affectedUserId,
              updateAccessRequests: false,
            },
            prisma
          )
        } else if (typeof elementId !== 'undefined') {
          await recomputeDerivedPermissions(
            { elementId, userId: affectedUserId, updateAccessRequests: false },
            prisma
          )
        } else if (typeof courseId !== 'undefined') {
          await recomputeDerivedPermissions(
            { courseId, userId: affectedUserId, updateAccessRequests: false },
            prisma
          )
        } else if (typeof liveQuizId !== 'undefined') {
          await recomputeDerivedPermissions(
            { liveQuizId, userId: affectedUserId, updateAccessRequests: false },
            prisma
          )
        } else if (typeof practiceQuizId !== 'undefined') {
          await recomputeDerivedPermissions(
            {
              practiceQuizId,
              userId: affectedUserId,
              updateAccessRequests: false,
            },
            prisma
          )
        } else if (typeof microLearningId !== 'undefined') {
          await recomputeDerivedPermissions(
            {
              microLearningId,
              userId: affectedUserId,
              updateAccessRequests: false,
            },
            prisma
          )
        } else if (typeof groupActivityId !== 'undefined') {
          await recomputeDerivedPermissions(
            {
              groupActivityId,
              userId: affectedUserId,
              updateAccessRequests: false,
            },
            prisma
          )
        }
      }

      // if an admin permission was revoked, update the access request instances
      if (permission.permissionLevel === DB.PermissionLevel.ADMIN) {
        if (typeof catalogCollectionId !== 'undefined') {
          await updateAccessRequestInstances(
            { catalogCollectionId, userId: permission.userId ?? undefined },
            prisma
          )
        } else if (typeof answerCollectionId !== 'undefined') {
          await updateAccessRequestInstances(
            { answerCollectionId, userId: permission.userId ?? undefined },
            prisma
          )
        } else if (typeof elementId !== 'undefined') {
          await updateAccessRequestInstances(
            { elementId, userId: permission.userId ?? undefined },
            prisma
          )
        } else if (typeof courseId !== 'undefined') {
          await updateAccessRequestInstances(
            { courseId, userId: permission.userId ?? undefined },
            prisma
          )
        } else if (typeof liveQuizId !== 'undefined') {
          await updateAccessRequestInstances(
            { liveQuizId, userId: permission.userId ?? undefined },
            prisma
          )
        } else if (typeof practiceQuizId !== 'undefined') {
          await updateAccessRequestInstances(
            { practiceQuizId, userId: permission.userId ?? undefined },
            prisma
          )
        } else if (typeof microLearningId !== 'undefined') {
          await updateAccessRequestInstances(
            { microLearningId, userId: permission.userId ?? undefined },
            prisma
          )
        } else if (typeof groupActivityId !== 'undefined') {
          await updateAccessRequestInstances(
            { groupActivityId, userId: permission.userId ?? undefined },
            prisma
          )
        }
      }

      return deleted
    },
    { timeout: 60000 }
  )

  // invalidate permission
  ctx.emitter.emit('invalidate', {
    typename: 'Permission',
    id: deletedPermission.id,
  })

  return deletedPermission.id
}
// #endregion

// ! Sharing Modal Queries and Mutations
// #region
export async function transferCatalogCollectionOwnership(
  { id, shortnameOrEmail }: { id: string; shortnameOrEmail: string },
  ctx: ContextWithUser
) {
  // verify that the specified user exists
  const newOwner = await ctx.prisma.user.findFirst({
    where: {
      OR: [{ shortname: shortnameOrEmail }, { email: shortnameOrEmail }],
    },
    include: { sharedObjects: { where: { catalogCollectionId: id } } },
  })

  if (!newOwner) {
    return null
  }

  const updatedCollection = await ctx.prisma.$transaction(async (prisma) => {
    // update the owner of the collection and grant admin permissions to the current user
    const updated = await prisma.catalogCollection.update({
      where: { id },
      data: {
        owner: { connect: { id: newOwner.id } },
        directPermissions: {
          upsert: {
            where: {
              catalogCollectionId_userId: {
                catalogCollectionId: id,
                userId: ctx.user.sub,
              },
            },
            create: {
              permissionLevel: DB.PermissionLevel.ADMIN,
              user: { connect: { id: ctx.user.sub } },
            },
            update: { permissionLevel: DB.PermissionLevel.ADMIN },
          },
        },
      },
      include: {
        directPermissions: {
          where: { userId: ctx.user.sub },
          include: {
            user: { select: { id: true, shortname: true, email: true } },
          },
        },
      },
    })

    // if the new owner previously had a direct permission on the collection, delete it
    if (newOwner.sharedObjects.length > 0) {
      await prisma.permission.delete({
        where: {
          catalogCollectionId_userId: {
            catalogCollectionId: id,
            userId: newOwner.id,
          },
        },
      })
    }

    // create an audit log entry for the ownership transfer
    await prisma.auditLogEntry.create({
      data: {
        type: DB.AuditLogType.OWNER_TRANSFERRED,
        objectType: DB.ObjectType.CATALOG_COLLECTION,
        objectId: id,
        sourceUserId: ctx.user.sub,
        targetUserId: newOwner.id,
        message: `Ownership of ${DB.ObjectType.CATALOG_COLLECTION} (ID ${id}) transferred from user ${ctx.user.sub} to user ${newOwner.id}.`,
      },
    })

    // trigger recomputation of derived permissions for the catalog collection for both users
    await recomputeDerivedPermissions(
      {
        catalogCollectionId: id,
        userId: newOwner.id,
        updateAccessRequests: true,
      },
      prisma
    )
    await recomputeDerivedPermissions(
      {
        catalogCollectionId: id,
        userId: ctx.user.sub,
        updateAccessRequests: false,
      },
      prisma
    )

    return updated
  })

  // return info for new admin permission and corresponding cache update
  const permission = updatedCollection.directPermissions[0]
  return permission && permission.user
    ? {
        permissionId: permission.id,
        userId: permission.user.id,
        username: permission.user.shortname,
        userEmail: permission.user.email,
        userGroupId: undefined,
        userGroupName: undefined,
        permissionLevel: permission.permissionLevel,
        isOwn: true,
      }
    : null
}

function mapDirectPermissions(
  permissions: (DB.Permission & {
    user?: Pick<DB.User, 'id' | 'shortname' | 'email'> | null
    userGroup?: Pick<DB.UserGroup, 'id' | 'name'> | null
  })[],
  userId: string
) {
  return permissions
    .map((permission) => ({
      permissionId: permission.id,
      userId: permission.user?.id,
      username: permission.user?.shortname,
      userEmail: permission.user?.email,
      userGroupId: permission.userGroup?.id,
      userGroupName: permission.userGroup?.name,
      permissionLevel: permission.permissionLevel,
      propagation: permission.propagation,
      isOwn: permission.user?.id === userId,
    }))
    .sort((a, b) => {
      if (a.username === b.username) {
        return (a.userGroupName ?? '').localeCompare(b.userGroupName ?? '')
      }
      return (a.username ?? '').localeCompare(b.username ?? '')
    })
}

export async function getCatalogCollectionPermissions(
  { id }: { id: string },
  ctx: ContextWithUser
) {
  const catalogCollection = await ctx.prisma.catalogCollection.findUnique({
    where: { id },
    include: {
      directPermissions: {
        include: {
          user: { select: { id: true, shortname: true, email: true } },
          userGroup: { select: { id: true, name: true } },
        },
      },
      owner: { select: { id: true, shortname: true, email: true } },
    },
  })

  if (!catalogCollection) {
    return { isOwner: false, ownerPermission: undefined, permissions: [] }
  }

  return {
    isOwner: catalogCollection.ownerId === ctx.user.sub,
    ownerPermission: catalogCollection.owner
      ? {
          permissionId: -1, // no valid ID required -> owner permission is non-removable
          userId: catalogCollection.owner.id,
          username: catalogCollection.owner.shortname,
          userEmail: catalogCollection.owner.email,
          permissionLevel: DB.PermissionLevel.OWNER,
          propagation: false,
          isOwn: catalogCollection.owner.id === ctx.user.sub,
        }
      : undefined,
    permissions: mapDirectPermissions(
      catalogCollection.directPermissions,
      ctx.user.sub
    ),
  }
}

export async function getAnswerCollectionPermissions(
  { id }: { id: number },
  ctx: ContextWithUser
) {
  const collection = await ctx.prisma.answerCollection.findUnique({
    where: { id },
    include: {
      directPermissions: {
        include: {
          user: { select: { id: true, shortname: true, email: true } },
          userGroup: { select: { id: true, name: true } },
        },
      },
      owner: { select: { id: true, shortname: true, email: true } },
    },
  })

  if (!collection) {
    return { isOwner: false, ownerPermission: undefined, permissions: [] }
  }

  return {
    isOwner: collection.ownerId === ctx.user.sub,
    ownerPermission: {
      permissionId: -1, // no valid ID required -> owner permission is non-removable
      userId: collection.owner.id,
      username: collection.owner.shortname,
      userEmail: collection.owner.email,
      permissionLevel: DB.PermissionLevel.OWNER,
      propagation: false,
      isOwn: collection.owner.id === ctx.user.sub,
    },
    permissions: mapDirectPermissions(
      collection.directPermissions,
      ctx.user.sub
    ),
  }
}

export async function getElementPermissions(
  { id }: { id: number },
  ctx: ContextWithUser
) {
  const element = await ctx.prisma.element.findUnique({
    where: { id },
    include: {
      directPermissions: {
        include: {
          user: { select: { id: true, shortname: true, email: true } },
          userGroup: { select: { id: true, name: true } },
        },
      },
      owner: { select: { id: true, shortname: true, email: true } },
    },
  })

  if (!element) {
    return { isOwner: false, ownerPermission: undefined, permissions: [] }
  }

  return {
    isOwner: element.ownerId === ctx.user.sub,
    ownerPermission: {
      permissionId: -1, // no valid ID required -> owner permission is non-removable
      userId: element.owner.id,
      username: element.owner.shortname,
      userEmail: element.owner.email,
      permissionLevel: DB.PermissionLevel.OWNER,
      propagation: false,
      isOwn: element.owner.id === ctx.user.sub,
    },
    permissions: mapDirectPermissions(element.directPermissions, ctx.user.sub),
  }
}

export async function getCoursePermissions(
  { id }: { id: string },
  ctx: ContextWithUser
) {
  const course = await ctx.prisma.course.findUnique({
    where: { id },
    include: {
      directPermissions: {
        include: {
          user: { select: { id: true, shortname: true, email: true } },
          userGroup: { select: { id: true, name: true } },
        },
      },
      owner: { select: { id: true, shortname: true, email: true } },
    },
  })

  if (!course) {
    return { isOwner: false, ownerPermission: undefined, permissions: [] }
  }

  return {
    isOwner: course.ownerId === ctx.user.sub,
    ownerPermission: {
      permissionId: -1, // no valid ID required -> owner permission is non-removable
      userId: course.owner.id,
      username: course.owner.shortname,
      userEmail: course.owner.email,
      permissionLevel: DB.PermissionLevel.OWNER,
      propagation: false,
      isOwn: course.owner.id === ctx.user.sub,
    },
    permissions: mapDirectPermissions(course.directPermissions, ctx.user.sub),
  }
}

export async function getLiveQuizPermissions(
  { id }: { id: string },
  ctx: ContextWithUser
) {
  const liveQuiz = await ctx.prisma.liveQuiz.findUnique({
    where: { id },
    include: {
      directPermissions: {
        include: {
          user: { select: { id: true, shortname: true, email: true } },
          userGroup: { select: { id: true, name: true } },
        },
      },
      owner: { select: { id: true, shortname: true, email: true } },
    },
  })

  if (!liveQuiz) {
    return { isOwner: false, ownerPermission: undefined, permissions: [] }
  }

  return {
    isOwner: liveQuiz.ownerId === ctx.user.sub,
    ownerPermission: {
      permissionId: -1, // no valid ID required -> owner permission is non-removable
      userId: liveQuiz.owner.id,
      username: liveQuiz.owner.shortname,
      userEmail: liveQuiz.owner.email,
      permissionLevel: DB.PermissionLevel.OWNER,
      propagation: false,
      isOwn: liveQuiz.owner.id === ctx.user.sub,
    },
    permissions: mapDirectPermissions(liveQuiz.directPermissions, ctx.user.sub),
  }
}

export async function getPracticeQuizPermissions(
  { id }: { id: string },
  ctx: ContextWithUser
) {
  const practiceQuiz = await ctx.prisma.practiceQuiz.findUnique({
    where: { id },
    include: {
      directPermissions: {
        include: {
          user: { select: { id: true, shortname: true, email: true } },
          userGroup: { select: { id: true, name: true } },
        },
      },
      owner: { select: { id: true, shortname: true, email: true } },
    },
  })

  if (!practiceQuiz) {
    return { isOwner: false, ownerPermission: undefined, permissions: [] }
  }

  return {
    isOwner: practiceQuiz.ownerId === ctx.user.sub,
    ownerPermission: {
      permissionId: -1, // no valid ID required -> owner permission is non-removable
      userId: practiceQuiz.owner.id,
      username: practiceQuiz.owner.shortname,
      userEmail: practiceQuiz.owner.email,
      permissionLevel: DB.PermissionLevel.OWNER,
      propagation: false,
      isOwn: practiceQuiz.owner.id === ctx.user.sub,
    },
    permissions: mapDirectPermissions(
      practiceQuiz.directPermissions,
      ctx.user.sub
    ),
  }
}

export async function getMicroLearningPermissions(
  { id }: { id: string },
  ctx: ContextWithUser
) {
  const microLearning = await ctx.prisma.microLearning.findUnique({
    where: { id },
    include: {
      directPermissions: {
        include: {
          user: { select: { id: true, shortname: true, email: true } },
          userGroup: { select: { id: true, name: true } },
        },
      },
      owner: { select: { id: true, shortname: true, email: true } },
    },
  })

  if (!microLearning) {
    return { isOwner: false, ownerPermission: undefined, permissions: [] }
  }

  return {
    isOwner: microLearning.ownerId === ctx.user.sub,
    ownerPermission: {
      permissionId: -1, // no valid ID required -> owner permission is non-removable
      userId: microLearning.owner.id,
      username: microLearning.owner.shortname,
      userEmail: microLearning.owner.email,
      permissionLevel: DB.PermissionLevel.OWNER,
      propagation: false,
      isOwn: microLearning.owner.id === ctx.user.sub,
    },
    permissions: mapDirectPermissions(
      microLearning.directPermissions,
      ctx.user.sub
    ),
  }
}

export async function getGroupActivityPermissions(
  { id }: { id: string },
  ctx: ContextWithUser
) {
  const groupActivity = await ctx.prisma.groupActivity.findUnique({
    where: { id },
    include: {
      directPermissions: {
        include: {
          user: { select: { id: true, shortname: true, email: true } },
          userGroup: { select: { id: true, name: true } },
        },
      },
      owner: { select: { id: true, shortname: true, email: true } },
    },
  })

  if (!groupActivity) {
    return { isOwner: false, ownerPermission: undefined, permissions: [] }
  }

  return {
    isOwner: groupActivity.ownerId === ctx.user.sub,
    ownerPermission: {
      permissionId: -1, // no valid ID required -> owner permission is non-removable
      userId: groupActivity.owner.id,
      username: groupActivity.owner.shortname,
      userEmail: groupActivity.owner.email,
      permissionLevel: DB.PermissionLevel.OWNER,
      propagation: false,
      isOwn: groupActivity.owner.id === ctx.user.sub,
    },
    permissions: mapDirectPermissions(
      groupActivity.directPermissions,
      ctx.user.sub
    ),
  }
}

function mapDerivedPermissions({
  permissions,
  userId,
}: {
  permissions: (DB.DerivedPermission & {
    user: Pick<DB.User, 'shortname' | 'email'>
  })[]
  userId: string
}) {
  return permissions
    .map((permission) => ({
      permissionId: permission.id,
      permissionLevel: permission.permissionLevel,
      userId: permission.userId,
      username: permission.user.shortname,
      userEmail: permission.user.email,
      isOwn: permission.userId === userId,
    }))
    .sort((a, b) => (a.username ?? '').localeCompare(b.username ?? ''))
}

export async function getDerivedAnswerCollectionPermissions(
  { id }: { id: number },
  ctx: ContextWithUser
) {
  // fetch the answer collection alongside all derived permissions that are marked as being "derived" (no direct permission behind them)
  const answerCollection = await ctx.prisma.answerCollection.findUnique({
    where: { id },
    include: {
      permissions: {
        where: { derived: true },
        include: {
          user: { select: { shortname: true, email: true } },
        },
      },
    },
  })

  if (!answerCollection) {
    return null
  }

  // map the derived permissions to the expected format
  return mapDerivedPermissions({
    permissions: answerCollection.permissions,
    userId: ctx.user.sub,
  })
}

export async function getDerivedElementPermissions(
  { id }: { id: number },
  ctx: ContextWithUser
) {
  // fetch the elements alongside all derived permissions that are marked as being "derived" (no direct permission behind them)
  const element = await ctx.prisma.element.findUnique({
    where: { id },
    include: {
      permissions: {
        where: { derived: true },
        include: {
          user: { select: { shortname: true, email: true } },
        },
      },
    },
  })

  if (!element) {
    return null
  }

  // map the derived permissions to the expected format
  return mapDerivedPermissions({
    permissions: element.permissions,
    userId: ctx.user.sub,
  })
}

export async function getDerivedCoursePermissions(
  { id }: { id: string },
  ctx: ContextWithUser
) {
  // fetch the course alongside all derived permissions that are marked as being "derived" (no direct permission behind them)
  const course = await ctx.prisma.course.findUnique({
    where: { id },
    include: {
      permissions: {
        where: { derived: true },
        include: {
          user: { select: { shortname: true, email: true } },
        },
      },
    },
  })

  if (!course) {
    return null
  }

  // map the derived permissions to the expected format
  return mapDerivedPermissions({
    permissions: course.permissions,
    userId: ctx.user.sub,
  })
}

export async function getDerivedLiveQuizPermissions(
  { id }: { id: string },
  ctx: ContextWithUser
) {
  // fetch the live quiz alongside all derived permissions that are marked as being "derived" (no direct permission behind them)
  const liveQuiz = await ctx.prisma.liveQuiz.findUnique({
    where: { id },
    include: {
      permissions: {
        where: { derived: true },
        include: {
          user: { select: { shortname: true, email: true } },
        },
      },
    },
  })

  if (!liveQuiz) {
    return null
  }

  // map the derived permissions to the expected format
  return mapDerivedPermissions({
    permissions: liveQuiz.permissions,
    userId: ctx.user.sub,
  })
}

export async function getDerivedPracticeQuizPermissions(
  { id }: { id: string },
  ctx: ContextWithUser
) {
  // fetch the practice quiz alongside all derived permissions that are marked as being "derived" (no direct permission behind them)
  const practiceQuiz = await ctx.prisma.practiceQuiz.findUnique({
    where: { id },
    include: {
      permissions: {
        where: { derived: true },
        include: {
          user: { select: { shortname: true, email: true } },
        },
      },
    },
  })

  if (!practiceQuiz) {
    return null
  }

  // map the derived permissions to the expected format
  return mapDerivedPermissions({
    permissions: practiceQuiz.permissions,
    userId: ctx.user.sub,
  })
}

export async function getDerivedMicroLearningPermissions(
  { id }: { id: string },
  ctx: ContextWithUser
) {
  // fetch the microlearning alongside all derived permissions that are marked as being "derived" (no direct permission behind them)
  const microLearning = await ctx.prisma.microLearning.findUnique({
    where: { id },
    include: {
      permissions: {
        where: { derived: true },
        include: {
          user: { select: { shortname: true, email: true } },
        },
      },
    },
  })

  if (!microLearning) {
    return null
  }

  // map the derived permissions to the expected format
  return mapDerivedPermissions({
    permissions: microLearning.permissions,
    userId: ctx.user.sub,
  })
}

export async function getDerivedGroupActivityPermissions(
  { id }: { id: string },
  ctx: ContextWithUser
) {
  // fetch the practice quiz alongside all derived permissions that are marked as being "derived" (no direct permission behind them)
  const groupActivity = await ctx.prisma.groupActivity.findUnique({
    where: { id },
    include: {
      permissions: {
        where: { derived: true },
        include: {
          user: { select: { shortname: true, email: true } },
        },
      },
    },
  })

  if (!groupActivity) {
    return null
  }

  // map the derived permissions to the expected format
  return mapDerivedPermissions({
    permissions: groupActivity.permissions,
    userId: ctx.user.sub,
  })
}

export async function transferAnswerCollectionOwnership(
  { id, shortnameOrEmail }: { id: number; shortnameOrEmail: string },
  ctx: ContextWithUser
) {
  // verify that the specified user exists
  const newOwner = await ctx.prisma.user.findFirst({
    where: {
      OR: [{ shortname: shortnameOrEmail }, { email: shortnameOrEmail }],
    },
    include: { sharedObjects: { where: { answerCollectionId: id } } },
  })

  // find the answer collection
  const answerCollection = await ctx.prisma.answerCollection.findUnique({
    where: { id },
  })

  if (!newOwner || !answerCollection) {
    return null
  }

  const updatedCollection = await ctx.prisma.$transaction(async (prisma) => {
    // update the owner of the collection and grant admin permissions to the current user
    const updated = await prisma.answerCollection.update({
      where: { id },
      data: {
        owner: { connect: { id: newOwner.id } },
        directPermissions: {
          upsert: {
            where: {
              answerCollectionId_userId: {
                answerCollectionId: id,
                userId: ctx.user.sub,
              },
            },
            create: {
              permissionLevel: DB.PermissionLevel.ADMIN,
              user: { connect: { id: ctx.user.sub } },
            },
            update: { permissionLevel: DB.PermissionLevel.ADMIN },
          },
        },
      },
      include: {
        directPermissions: {
          where: { userId: ctx.user.sub },
          include: {
            user: { select: { id: true, shortname: true, email: true } },
          },
        },
      },
    })

    // if the new owner previously had a permission on the collection, delete it
    if (newOwner.sharedObjects.length > 0) {
      await prisma.permission.delete({
        where: {
          answerCollectionId_userId: {
            answerCollectionId: id,
            userId: newOwner.id,
          },
        },
      })
    }

    // create an audit log entry for the ownership transfer
    await prisma.auditLogEntry.create({
      data: {
        type: DB.AuditLogType.OWNER_TRANSFERRED,
        objectType: DB.ObjectType.ANSWER_COLLECTION,
        objectId: String(id),
        sourceUserId: ctx.user.sub,
        targetUserId: newOwner.id,
        message: `Ownership of ${DB.ObjectType.ANSWER_COLLECTION} (ID ${id}) transferred from user ${ctx.user.sub} to user ${newOwner.id}.`,
      },
    })

    // trigger recomputation of derived permissions for the answer collection for both users
    await recomputeDerivedPermissions(
      {
        answerCollectionId: id,
        userId: newOwner.id,
        updateAccessRequests: true,
      },
      prisma
    )
    await recomputeDerivedPermissions(
      {
        answerCollectionId: id,
        userId: ctx.user.sub,
        updateAccessRequests: false,
      },
      prisma
    )

    return updated
  })

  // return info for new admin permission and corresponding cache update
  const permission = updatedCollection.directPermissions[0]
  return permission && permission.user
    ? {
        permissionId: permission.id,
        userId: permission.user.id,
        username: permission.user.shortname,
        userEmail: permission.user.email,
        userGroupId: undefined,
        userGroupName: undefined,
        permissionLevel: permission.permissionLevel,
        propagation: permission.propagation,
        isOwn: true,
      }
    : null
}

export async function transferElementOwnership(
  { id, shortnameOrEmail }: { id: number; shortnameOrEmail: string },
  ctx: ContextWithUser
) {
  // verify that the specified user exists
  const newOwner = await ctx.prisma.user.findFirst({
    where: {
      OR: [{ shortname: shortnameOrEmail }, { email: shortnameOrEmail }],
    },
    include: { sharedObjects: { where: { elementId: id } } },
  })

  // find the element
  const element = await ctx.prisma.element.findUnique({
    where: { id },
  })

  if (!newOwner || !element) {
    return null
  }

  const updatedElement = await ctx.prisma.$transaction(async (prisma) => {
    // update the owner of the element and grant admin permissions to the current user
    const updated = await prisma.element.update({
      where: { id },
      data: {
        owner: { connect: { id: newOwner.id } },
        directPermissions: {
          upsert: {
            where: {
              elementId_userId: {
                elementId: id,
                userId: ctx.user.sub,
              },
            },
            create: {
              permissionLevel: DB.PermissionLevel.ADMIN,
              user: { connect: { id: ctx.user.sub } },
            },
            update: { permissionLevel: DB.PermissionLevel.ADMIN },
          },
        },
      },
      include: {
        directPermissions: {
          where: { userId: ctx.user.sub },
          include: {
            user: { select: { id: true, shortname: true, email: true } },
          },
        },
      },
    })

    // if the new owner previously had a permission on the element, delete it
    if (newOwner.sharedObjects.length > 0) {
      await prisma.permission.delete({
        where: {
          elementId_userId: {
            elementId: id,
            userId: newOwner.id,
          },
        },
      })
    }

    // create an audit log entry for the ownership transfer
    await prisma.auditLogEntry.create({
      data: {
        type: DB.AuditLogType.OWNER_TRANSFERRED,
        objectType: DB.ObjectType.ELEMENT,
        objectId: String(id),
        sourceUserId: ctx.user.sub,
        targetUserId: newOwner.id,
        message: `Ownership of ${DB.ObjectType.ELEMENT} (ID ${id}) transferred from user ${ctx.user.sub} to user ${newOwner.id}.`,
      },
    })

    // trigger recomputation of derived permissions for the element for both users
    await recomputeDerivedPermissions(
      { elementId: id, userId: newOwner.id, updateAccessRequests: true },
      prisma
    )
    await recomputeDerivedPermissions(
      { elementId: id, userId: ctx.user.sub, updateAccessRequests: false },
      prisma
    )

    return updated
  })

  // return info for new admin permission and corresponding cache update
  const permission = updatedElement.directPermissions[0]
  return permission && permission.user
    ? {
        permissionId: permission.id,
        userId: permission.user.id,
        username: permission.user.shortname,
        userEmail: permission.user.email,
        userGroupId: undefined,
        userGroupName: undefined,
        permissionLevel: permission.permissionLevel,
        propagation: permission.propagation,
        isOwn: true,
      }
    : null
}

export async function transferCourseOwnership(
  { id, shortnameOrEmail }: { id: string; shortnameOrEmail: string },
  ctx: ContextWithUser
) {
  // verify that the specified user exists
  const newOwner = await ctx.prisma.user.findFirst({
    where: {
      OR: [{ shortname: shortnameOrEmail }, { email: shortnameOrEmail }],
    },
    include: { sharedObjects: { where: { courseId: id } } },
  })

  // find the course
  const course = await ctx.prisma.course.findUnique({
    where: { id },
  })

  if (!newOwner || !course) {
    return null
  }

  const updatedCourse = await ctx.prisma.$transaction(
    async (prisma) => {
      // update the owner of the course and grant admin permissions to the current user
      const updated = await prisma.course.update({
        where: { id },
        data: {
          owner: { connect: { id: newOwner.id } },
          directPermissions: {
            upsert: {
              where: {
                courseId_userId: {
                  courseId: id,
                  userId: ctx.user.sub,
                },
              },
              create: {
                permissionLevel: DB.PermissionLevel.ADMIN,
                user: { connect: { id: ctx.user.sub } },
              },
              update: { permissionLevel: DB.PermissionLevel.ADMIN },
            },
          },
        },
        include: {
          directPermissions: {
            where: { userId: ctx.user.sub },
            include: {
              user: { select: { id: true, shortname: true, email: true } },
            },
          },
        },
      })

      // if the new owner previously had a permission on the live quiz, delete it
      if (newOwner.sharedObjects.length > 0) {
        await prisma.permission.delete({
          where: {
            courseId_userId: {
              courseId: id,
              userId: newOwner.id,
            },
          },
        })
      }

      // create an audit log entry for the ownership transfer
      await prisma.auditLogEntry.create({
        data: {
          type: DB.AuditLogType.OWNER_TRANSFERRED,
          objectType: DB.ObjectType.COURSE,
          objectId: id,
          sourceUserId: ctx.user.sub,
          targetUserId: newOwner.id,
          message: `Ownership of ${DB.ObjectType.COURSE} (ID ${id}) transferred from user ${ctx.user.sub} to user ${newOwner.id}.`,
        },
      })

      // trigger recomputation of derived permissions for the course for both users
      await recomputeDerivedPermissions(
        { courseId: id, userId: newOwner.id, updateAccessRequests: true },
        prisma
      )
      await recomputeDerivedPermissions(
        { courseId: id, userId: ctx.user.sub, updateAccessRequests: false },
        prisma
      )

      return updated
    },
    { timeout: 60000 }
  )

  // return info for new admin permission and corresponding cache update
  const permission = updatedCourse.directPermissions[0]
  return permission && permission.user
    ? {
        permissionId: permission.id,
        userId: permission.user.id,
        username: permission.user.shortname,
        userEmail: permission.user.email,
        userGroupId: undefined,
        userGroupName: undefined,
        permissionLevel: permission.permissionLevel,
        propagation: permission.propagation,
        isOwn: true,
      }
    : null
}

export async function transferLiveQuizOwnership(
  { id, shortnameOrEmail }: { id: string; shortnameOrEmail: string },
  ctx: ContextWithUser
) {
  // verify that the specified user exists
  const newOwner = await ctx.prisma.user.findFirst({
    where: {
      OR: [{ shortname: shortnameOrEmail }, { email: shortnameOrEmail }],
    },
    include: { sharedObjects: { where: { liveQuizId: id } } },
  })

  // find the live quiz
  const liveQuiz = await ctx.prisma.liveQuiz.findUnique({
    where: { id },
  })

  if (!newOwner || !liveQuiz || liveQuiz.ownerId === newOwner.id) {
    return null
  }

  const updatedLiveQuiz = await ctx.prisma.$transaction(
    async (prisma) => {
      // update the owner of the live quiz and grant admin permissions to the current user
      const updated = await prisma.liveQuiz.update({
        where: { id },
        data: {
          owner: { connect: { id: newOwner.id } },
          directPermissions: {
            upsert: {
              where: {
                liveQuizId_userId: {
                  liveQuizId: id,
                  userId: ctx.user.sub,
                },
              },
              create: {
                permissionLevel: DB.PermissionLevel.ADMIN,
                user: { connect: { id: ctx.user.sub } },
              },
              update: { permissionLevel: DB.PermissionLevel.ADMIN },
            },
          },
        },
        include: {
          directPermissions: {
            where: { userId: ctx.user.sub },
            include: {
              user: { select: { id: true, shortname: true, email: true } },
            },
          },
        },
      })

      // if the new owner previously had a permission on the live quiz, delete it
      if (newOwner.sharedObjects.length > 0) {
        await prisma.permission.delete({
          where: {
            liveQuizId_userId: {
              liveQuizId: id,
              userId: newOwner.id,
            },
          },
        })
      }

      // create an audit log entry for the ownership transfer
      await prisma.auditLogEntry.create({
        data: {
          type: DB.AuditLogType.OWNER_TRANSFERRED,
          objectType: DB.ObjectType.LIVE_QUIZ,
          objectId: String(id),
          sourceUserId: ctx.user.sub,
          targetUserId: newOwner.id,
          message: `Ownership of ${DB.ObjectType.LIVE_QUIZ} (ID ${id}) transferred from user ${ctx.user.sub} to user ${newOwner.id}.`,
        },
      })

      // trigger recomputation of derived permissions for the live quiz for both users
      await recomputeDerivedPermissions(
        { liveQuizId: id, userId: newOwner.id, updateAccessRequests: true },
        prisma
      )
      await recomputeDerivedPermissions(
        { liveQuizId: id, userId: ctx.user.sub, updateAccessRequests: false },
        prisma
      )

      return updated
    },
    { timeout: 60000 }
  )

  // return info for new admin permission and corresponding cache update
  const permission = updatedLiveQuiz.directPermissions[0]
  return permission && permission.user
    ? {
        permissionId: permission.id,
        userId: permission.user.id,
        username: permission.user.shortname,
        userEmail: permission.user.email,
        userGroupId: undefined,
        userGroupName: undefined,
        permissionLevel: permission.permissionLevel,
        propagation: permission.propagation,
        isOwn: true,
      }
    : null
}

export async function transferPracticeQuizOwnership(
  { id, shortnameOrEmail }: { id: string; shortnameOrEmail: string },
  ctx: ContextWithUser
) {
  // verify that the specified user exists
  const newOwner = await ctx.prisma.user.findFirst({
    where: {
      OR: [{ shortname: shortnameOrEmail }, { email: shortnameOrEmail }],
    },
    include: { sharedObjects: { where: { practiceQuizId: id } } },
  })

  // find the practice quiz
  const practiceQuiz = await ctx.prisma.practiceQuiz.findUnique({
    where: { id },
  })

  if (!newOwner || !practiceQuiz || practiceQuiz.ownerId === newOwner.id) {
    return null
  }

  const updatedPracticeQuiz = await ctx.prisma.$transaction(
    async (prisma) => {
      // update the owner of the practice quiz and grant admin permissions to the current user
      const updated = await prisma.practiceQuiz.update({
        where: { id },
        data: {
          owner: { connect: { id: newOwner.id } },
          directPermissions: {
            upsert: {
              where: {
                practiceQuizId_userId: {
                  practiceQuizId: id,
                  userId: ctx.user.sub,
                },
              },
              create: {
                permissionLevel: DB.PermissionLevel.ADMIN,
                user: { connect: { id: ctx.user.sub } },
              },
              update: { permissionLevel: DB.PermissionLevel.ADMIN },
            },
          },
        },
        include: {
          directPermissions: {
            where: { userId: ctx.user.sub },
            include: {
              user: { select: { id: true, shortname: true, email: true } },
            },
          },
        },
      })

      // if the new owner previously had a permission on the practice quiz, delete it
      if (newOwner.sharedObjects.length > 0) {
        await prisma.permission.delete({
          where: {
            practiceQuizId_userId: {
              practiceQuizId: id,
              userId: newOwner.id,
            },
          },
        })
      }

      // create an audit log entry for the ownership transfer
      await prisma.auditLogEntry.create({
        data: {
          type: DB.AuditLogType.OWNER_TRANSFERRED,
          objectType: DB.ObjectType.PRACTICE_QUIZ,
          objectId: String(id),
          sourceUserId: ctx.user.sub,
          targetUserId: newOwner.id,
          message: `Ownership of ${DB.ObjectType.PRACTICE_QUIZ} (ID ${id}) transferred from user ${ctx.user.sub} to user ${newOwner.id}.`,
        },
      })

      // trigger recomputation of derived permissions for the practice quiz for both users
      await recomputeDerivedPermissions(
        { practiceQuizId: id, userId: newOwner.id, updateAccessRequests: true },
        prisma
      )
      await recomputeDerivedPermissions(
        {
          practiceQuizId: id,
          userId: ctx.user.sub,
          updateAccessRequests: false,
        },
        prisma
      )

      return updated
    },
    { timeout: 60000 }
  )

  // return info for new admin permission and corresponding cache update
  const permission = updatedPracticeQuiz.directPermissions[0]
  return permission && permission.user
    ? {
        permissionId: permission.id,
        userId: permission.user.id,
        username: permission.user.shortname,
        userEmail: permission.user.email,
        userGroupId: undefined,
        userGroupName: undefined,
        permissionLevel: permission.permissionLevel,
        propagation: permission.propagation,
        isOwn: true,
      }
    : null
}

export async function transferMicroLearningOwnership(
  { id, shortnameOrEmail }: { id: string; shortnameOrEmail: string },
  ctx: ContextWithUser
) {
  // verify that the specified user exists
  const newOwner = await ctx.prisma.user.findFirst({
    where: {
      OR: [{ shortname: shortnameOrEmail }, { email: shortnameOrEmail }],
    },
    include: { sharedObjects: { where: { microLearningId: id } } },
  })

  // find the microlearning
  const microLearning = await ctx.prisma.microLearning.findUnique({
    where: { id },
  })

  if (!newOwner || !microLearning || microLearning.ownerId === newOwner.id) {
    return null
  }

  const updatedMicroLearning = await ctx.prisma.$transaction(
    async (prisma) => {
      // update the owner of the microlearning and grant admin permissions to the current user
      const updated = await prisma.microLearning.update({
        where: { id },
        data: {
          owner: { connect: { id: newOwner.id } },
          directPermissions: {
            upsert: {
              where: {
                microLearningId_userId: {
                  microLearningId: id,
                  userId: ctx.user.sub,
                },
              },
              create: {
                permissionLevel: DB.PermissionLevel.ADMIN,
                user: { connect: { id: ctx.user.sub } },
              },
              update: { permissionLevel: DB.PermissionLevel.ADMIN },
            },
          },
        },
        include: {
          directPermissions: {
            where: { userId: ctx.user.sub },
            include: {
              user: { select: { id: true, shortname: true, email: true } },
            },
          },
        },
      })

      // if the new owner previously had a permission on the microlearning, delete it
      if (newOwner.sharedObjects.length > 0) {
        await prisma.permission.delete({
          where: {
            microLearningId_userId: {
              microLearningId: id,
              userId: newOwner.id,
            },
          },
        })
      }

      // create an audit log entry for the ownership transfer
      await prisma.auditLogEntry.create({
        data: {
          type: DB.AuditLogType.OWNER_TRANSFERRED,
          objectType: DB.ObjectType.MICRO_LEARNING,
          objectId: String(id),
          sourceUserId: ctx.user.sub,
          targetUserId: newOwner.id,
          message: `Ownership of ${DB.ObjectType.MICRO_LEARNING} (ID ${id}) transferred from user ${ctx.user.sub} to user ${newOwner.id}.`,
        },
      })

      // trigger recomputation of derived permissions for the microlearning for both users
      await recomputeDerivedPermissions(
        {
          microLearningId: id,
          userId: newOwner.id,
          updateAccessRequests: true,
        },
        prisma
      )
      await recomputeDerivedPermissions(
        {
          microLearningId: id,
          userId: ctx.user.sub,
          updateAccessRequests: false,
        },
        prisma
      )

      return updated
    },
    { timeout: 60000 }
  )

  // return info for new admin permission and corresponding cache update
  const permission = updatedMicroLearning.directPermissions[0]
  return permission && permission.user
    ? {
        permissionId: permission.id,
        userId: permission.user.id,
        username: permission.user.shortname,
        userEmail: permission.user.email,
        userGroupId: undefined,
        userGroupName: undefined,
        permissionLevel: permission.permissionLevel,
        propagation: permission.propagation,
        isOwn: true,
      }
    : null
}

export async function transferGroupActivityOwnership(
  { id, shortnameOrEmail }: { id: string; shortnameOrEmail: string },
  ctx: ContextWithUser
) {
  // verify that the specified user exists
  const newOwner = await ctx.prisma.user.findFirst({
    where: {
      OR: [{ shortname: shortnameOrEmail }, { email: shortnameOrEmail }],
    },
    include: { sharedObjects: { where: { groupActivityId: id } } },
  })

  // find the group activity
  const groupActivity = await ctx.prisma.groupActivity.findUnique({
    where: { id },
  })

  if (!newOwner || !groupActivity || groupActivity.ownerId === newOwner.id) {
    return null
  }

  const updatedGroupActivity = await ctx.prisma.$transaction(
    async (prisma) => {
      // update the owner of the group activity and grant admin permissions to the current user
      const updated = await prisma.groupActivity.update({
        where: { id },
        data: {
          owner: { connect: { id: newOwner.id } },
          directPermissions: {
            upsert: {
              where: {
                groupActivityId_userId: {
                  groupActivityId: id,
                  userId: ctx.user.sub,
                },
              },
              create: {
                permissionLevel: DB.PermissionLevel.ADMIN,
                user: { connect: { id: ctx.user.sub } },
              },
              update: { permissionLevel: DB.PermissionLevel.ADMIN },
            },
          },
        },
        include: {
          directPermissions: {
            where: { userId: ctx.user.sub },
            include: {
              user: { select: { id: true, shortname: true, email: true } },
            },
          },
        },
      })

      // if the new owner previously had a permission on the group activity, delete it
      if (newOwner.sharedObjects.length > 0) {
        await prisma.permission.delete({
          where: {
            groupActivityId_userId: {
              groupActivityId: id,
              userId: newOwner.id,
            },
          },
        })
      }

      // create an audit log entry for the ownership transfer
      await prisma.auditLogEntry.create({
        data: {
          type: DB.AuditLogType.OWNER_TRANSFERRED,
          objectType: DB.ObjectType.GROUP_ACTIVITY,
          objectId: String(id),
          sourceUserId: ctx.user.sub,
          targetUserId: newOwner.id,
          message: `Ownership of ${DB.ObjectType.GROUP_ACTIVITY} (ID ${id}) transferred from user ${ctx.user.sub} to user ${newOwner.id}.`,
        },
      })

      // trigger recomputation of derived permissions for the group activity for both users
      await recomputeDerivedPermissions(
        {
          groupActivityId: id,
          userId: newOwner.id,
          updateAccessRequests: true,
        },
        prisma
      )
      await recomputeDerivedPermissions(
        {
          groupActivityId: id,
          userId: ctx.user.sub,
          updateAccessRequests: false,
        },
        prisma
      )

      return updated
    },
    { timeout: 60000 }
  )

  // return info for new admin permission and corresponding cache update
  const permission = updatedGroupActivity.directPermissions[0]
  return permission && permission.user
    ? {
        permissionId: permission.id,
        userId: permission.user.id,
        username: permission.user.shortname,
        userEmail: permission.user.email,
        userGroupId: undefined,
        userGroupName: undefined,
        permissionLevel: permission.permissionLevel,
        propagation: permission.propagation,
        isOwn: true,
      }
    : null
}

export async function getDerivedPermissionOrigin(
  { id }: { id: number },
  ctx: ContextWithUser
) {
  // fetch the requested derived permissions
  const permission = await ctx.prisma.derivedPermission.findUnique({
    where: { id, derived: true },
    include: {
      user: { select: { shortname: true, email: true } },
      directPermission: {
        include: {
          user: { select: { shortname: true } },
          userGroup: { select: { name: true } },
          catalogCollection: {
            include: { owner: { select: { shortname: true } } },
          },
          answerCollection: {
            include: { owner: { select: { shortname: true } } },
          },
          element: { include: { owner: { select: { shortname: true } } } },
          course: { include: { owner: { select: { shortname: true } } } },
          liveQuiz: { include: { owner: { select: { shortname: true } } } },
          practiceQuiz: { include: { owner: { select: { shortname: true } } } },
          microLearning: {
            include: { owner: { select: { shortname: true } } },
          },
          groupActivity: {
            include: { owner: { select: { shortname: true } } },
          },
        },
      },
    },
  })

  if (!permission) {
    return null
  }

  // verify that the requesting user is OWNER / ADMIN on the associated object
  // = allowed to open the sharing dialog and requesting the corresponding origin of a derived permission
  const validAccess = await checkAccess(
    [
      ...(permission.catalogCollectionId !== null
        ? [
            {
              catalogCollectionId: permission.catalogCollectionId,
              minimumPermissionLevel: DB.PermissionLevel.ADMIN,
            },
          ]
        : []),
      ...(permission.answerCollectionId !== null
        ? [
            {
              answerCollectionId: permission.answerCollectionId,
              minimumPermissionLevel: DB.PermissionLevel.ADMIN,
            },
          ]
        : []),
      ...(permission.elementId !== null
        ? [
            {
              elementId: permission.elementId,
              minimumPermissionLevel: DB.PermissionLevel.ADMIN,
            },
          ]
        : []),
      ...(permission.courseId !== null
        ? [
            {
              courseId: permission.courseId,
              minimumPermissionLevel: DB.PermissionLevel.ADMIN,
            },
          ]
        : []),
      ...(permission.liveQuizId !== null
        ? [
            {
              liveQuizId: permission.liveQuizId,
              minimumPermissionLevel: DB.PermissionLevel.ADMIN,
            },
          ]
        : []),
      ...(permission.practiceQuizId !== null
        ? [
            {
              practiceQuizId: permission.practiceQuizId,
              minimumPermissionLevel: DB.PermissionLevel.ADMIN,
            },
          ]
        : []),
      ...(permission.microLearningId !== null
        ? [
            {
              microLearningId: permission.microLearningId,
              minimumPermissionLevel: DB.PermissionLevel.ADMIN,
            },
          ]
        : []),
      ...(permission.groupActivityId !== null
        ? [
            {
              groupActivityId: permission.groupActivityId,
              minimumPermissionLevel: DB.PermissionLevel.ADMIN,
            },
          ]
        : []),
    ],
    ctx
  )

  if (!validAccess) {
    return null
  }

  // case 1: direct permission id is null -> parent object owned by user with derived access
  if (permission.directPermission === null) {
    return {
      permissionUser: `${permission.user.shortname} (${permission.user.email})`,
      parentObjectType: undefined, // parent object unknown
      parentObjectName: undefined, // parent object unknown
      parentObjectOwner: undefined, // parent object unknown
      parentTargetUser: undefined, // parent object unknown
      parentTargetUserGroup: undefined, // parent object unknown
      parentPermissionLevel: undefined, // parent object unknown
    }
  }

  // case 2: direct permission id is not null -> parent object shared with user / user group
  else {
    const sharedDerivedPermissionInfo = {
      permissionUser: `${permission.user.shortname} (${permission.user.email})`,
      parentTargetUser: permission.directPermission.user?.shortname,
      parentTargetUserGroup: permission.directPermission.userGroup?.name,
      parentPermissionLevel: permission.directPermission.permissionLevel,
    }

    if (permission.directPermission.catalogCollection) {
      return {
        ...sharedDerivedPermissionInfo,
        parentObjectType: DB.ObjectType.CATALOG_COLLECTION,
        parentObjectName: permission.directPermission.catalogCollection.name,
        parentObjectOwner:
          permission.directPermission.catalogCollection.owner?.shortname ?? '',
      }
    } else if (permission.directPermission.answerCollection) {
      return {
        ...sharedDerivedPermissionInfo,
        parentObjectType: DB.ObjectType.ANSWER_COLLECTION,
        parentObjectName: permission.directPermission.answerCollection.name,
        parentObjectOwner:
          permission.directPermission.answerCollection.owner.shortname,
      }
    } else if (permission.directPermission.element) {
      return {
        ...sharedDerivedPermissionInfo,
        parentObjectType: DB.ObjectType.ELEMENT,
        parentObjectName: permission.directPermission.element.name,
        parentObjectOwner: permission.directPermission.element.owner.shortname,
      }
    } else if (permission.directPermission.course) {
      return {
        ...sharedDerivedPermissionInfo,
        parentObjectType: DB.ObjectType.COURSE,
        parentObjectName: permission.directPermission.course.name,
        parentObjectOwner: permission.directPermission.course.owner.shortname,
      }
    } else if (permission.directPermission.liveQuiz) {
      return {
        ...sharedDerivedPermissionInfo,
        parentObjectType: DB.ObjectType.LIVE_QUIZ,
        parentObjectName: permission.directPermission.liveQuiz.name,
        parentObjectOwner: permission.directPermission.liveQuiz.owner.shortname,
      }
    } else if (permission.directPermission.practiceQuiz) {
      return {
        ...sharedDerivedPermissionInfo,
        parentObjectType: DB.ObjectType.PRACTICE_QUIZ,
        parentObjectName: permission.directPermission.practiceQuiz.name,
        parentObjectOwner:
          permission.directPermission.practiceQuiz.owner.shortname,
      }
    } else if (permission.directPermission.microLearning) {
      return {
        ...sharedDerivedPermissionInfo,
        parentObjectType: DB.ObjectType.MICRO_LEARNING,
        parentObjectName: permission.directPermission.microLearning.name,
        parentObjectOwner:
          permission.directPermission.microLearning.owner.shortname,
      }
    } else if (permission.directPermission.groupActivity) {
      return {
        ...sharedDerivedPermissionInfo,
        parentObjectType: DB.ObjectType.GROUP_ACTIVITY,
        parentObjectName: permission.directPermission.groupActivity.name,
        parentObjectOwner:
          permission.directPermission.groupActivity.owner.shortname,
      }
    }
  }
}

export const ELEMENT_BATCH_SHARING_STATUSES = [
  'SHARED',
  'SKIPPED',
  'FAILED',
] as const
export type ElementBatchSharingStatus =
  (typeof ELEMENT_BATCH_SHARING_STATUSES)[number]

export const ELEMENT_BATCH_SHARING_REASONS = [
  'INSUFFICIENT_PERMISSION',
  'ELEMENT_NOT_FOUND_OR_DELETED',
  'SHARING_FAILED',
] as const
export type ElementBatchSharingReason =
  (typeof ELEMENT_BATCH_SHARING_REASONS)[number]

export const ELEMENT_BATCH_SHARING_TARGET_ERRORS = [
  'INVALID_OR_SELF_TARGET',
  'USER_GROUP_UNAVAILABLE',
] as const
export type ElementBatchSharingTargetError =
  (typeof ELEMENT_BATCH_SHARING_TARGET_ERRORS)[number]

export interface ElementBatchSharingOutcome {
  elementId: number
  status: ElementBatchSharingStatus
  reason?: ElementBatchSharingReason | null
}

export interface ElementBatchSharingResult {
  targetError?: ElementBatchSharingTargetError | null
  outcomes: ElementBatchSharingOutcome[]
}

type ResolvedSharingTarget =
  | {
      kind: 'USER'
      id: string
      shortname: string
      email: string
    }
  | {
      kind: 'USER_GROUP'
      id: number
      name: string
    }

async function resolveSharingTarget(
  {
    shortnameOrEmail,
    userGroupId,
  }: {
    shortnameOrEmail?: string | null
    userGroupId?: number | null
  },
  ctx: ContextWithUser,
  mode: 'DIRECT' | 'EXACTLY_ONE'
): Promise<
  | { target: ResolvedSharingTarget; error: null }
  | { target: null; error: ElementBatchSharingTargetError | null }
> {
  const hasIndividualTarget =
    typeof shortnameOrEmail === 'string' && shortnameOrEmail.length > 0
  const hasGroupTarget = typeof userGroupId === 'number'

  if (mode === 'EXACTLY_ONE' && hasIndividualTarget === hasGroupTarget) {
    return { target: null, error: 'INVALID_OR_SELF_TARGET' }
  }

  if (hasIndividualTarget) {
    const user = await ctx.prisma.user.findFirst({
      where: {
        OR: [{ shortname: shortnameOrEmail }, { email: shortnameOrEmail }],
      },
      select: { id: true, shortname: true, email: true },
    })

    if (!user || user.id === ctx.user.sub) {
      return {
        target: null,
        error: mode === 'EXACTLY_ONE' ? 'INVALID_OR_SELF_TARGET' : null,
      }
    }

    return {
      target: {
        kind: 'USER',
        id: user.id,
        shortname: user.shortname,
        email: user.email,
      },
      error: null,
    }
  }

  if (hasGroupTarget) {
    const userGroup = await ctx.prisma.userGroup.findUnique({
      where: {
        id: userGroupId!,
        OR: [
          { ownerId: ctx.user.sub },
          { admins: { some: { id: ctx.user.sub } } },
          { members: { some: { id: ctx.user.sub } } },
        ],
      },
      select: { id: true, name: true },
    })

    if (!userGroup) {
      return {
        target: null,
        error: mode === 'EXACTLY_ONE' ? 'USER_GROUP_UNAVAILABLE' : null,
      }
    }

    return {
      target: { kind: 'USER_GROUP', id: userGroup.id, name: userGroup.name },
      error: null,
    }
  }

  return {
    target: null,
    error: mode === 'EXACTLY_ONE' ? 'INVALID_OR_SELF_TARGET' : null,
  }
}

async function grantElementPermission(
  {
    elementId,
    permissionLevel,
    propagation,
    target,
    sourceUserId,
  }: {
    elementId: number
    permissionLevel: DB.PermissionLevel
    propagation: boolean
    target: ResolvedSharingTarget
    sourceUserId: string
  },
  prisma: PrismaTransactionClient
) {
  const permission =
    target.kind === 'USER'
      ? await prisma.permission.upsert({
          where: {
            elementId_userId: { elementId, userId: target.id },
          },
          create: {
            elementId,
            userId: target.id,
            permissionLevel,
            propagation,
          },
          update: { permissionLevel, propagation },
        })
      : await prisma.permission.upsert({
          where: {
            elementId_userGroupId: { elementId, userGroupId: target.id },
          },
          create: {
            elementId,
            userGroupId: target.id,
            permissionLevel,
            propagation,
          },
          update: { permissionLevel, propagation },
        })

  if (target.kind === 'USER') {
    await prisma.accessRequest.deleteMany({
      where: { elementId, userId: target.id },
    })
  }

  const updateAccessRequests = permissionLevel === DB.PermissionLevel.ADMIN
  await recomputeDerivedPermissions(
    target.kind === 'USER'
      ? { elementId, userId: target.id, updateAccessRequests }
      : { elementId, updateAccessRequests },
    prisma
  )

  await prisma.auditLogEntry.create({
    data: {
      type: DB.AuditLogType.PERMISSION_GRANTED,
      objectType: DB.ObjectType.ELEMENT,
      objectId: String(elementId),
      sourceUserId,
      targetUserId: target.kind === 'USER' ? target.id : undefined,
      targetUserGroupId: target.kind === 'USER_GROUP' ? target.id : undefined,
      message:
        target.kind === 'USER'
          ? `Direct permission with level ${permissionLevel} granted for ${DB.ObjectType.ELEMENT} (ID ${elementId}) by owner / admin ${sourceUserId} to user ${target.id}.`
          : `Direct permission with level ${permissionLevel} granted for ${DB.ObjectType.ELEMENT} (ID ${elementId}) by owner / admin ${sourceUserId} to user group ${target.id}.`,
    },
  })

  return permission
}

async function shareElementWithResolvedTarget(
  args: {
    elementId: number
    permissionLevel: DB.PermissionLevel
    propagation: boolean
    target: ResolvedSharingTarget
  },
  ctx: ContextWithUser
) {
  const permission = await ctx.prisma.$transaction(
    (prisma) =>
      grantElementPermission({ ...args, sourceUserId: ctx.user.sub }, prisma),
    { timeout: 60000 }
  )

  invalidateElementPermission(
    { elementId: args.elementId, permissionId: permission.id },
    ctx
  )

  return permission
}

function invalidateElementPermission(
  { elementId, permissionId }: { elementId: number; permissionId: number },
  ctx: ContextWithUser
) {
  try {
    ctx.emitter.emit('invalidate', {
      typename: 'Permission',
      id: permissionId,
    })
  } catch (error) {
    console.error(
      'Failed to invalidate permission %s after sharing element %s',
      permissionId,
      elementId,
      error
    )
  }
}

export async function shareElementsBatch(
  {
    elementIds,
    permissionLevel,
    shortnameOrEmail,
    userGroupId,
  }: {
    elementIds: number[]
    permissionLevel: DB.PermissionLevel
    shortnameOrEmail?: string | null
    userGroupId?: number | null
  },
  ctx: ContextWithUser
): Promise<ElementBatchSharingResult> {
  const resolvedTarget = await resolveSharingTarget(
    { shortnameOrEmail, userGroupId },
    ctx,
    'EXACTLY_ONE'
  )

  if (!resolvedTarget.target) {
    return {
      targetError: resolvedTarget.error ?? 'INVALID_OR_SELF_TARGET',
      outcomes: [],
    }
  }

  const uniqueElementIds = [...new Set(elementIds)]
  const elements = await ctx.prisma.element.findMany({
    where: { id: { in: uniqueElementIds }, isDeleted: false },
    select: {
      id: true,
      permissions: {
        where: { userId: ctx.user.sub },
        select: { permissionLevel: true },
      },
    },
  })
  const elementsById = new Map(elements.map((element) => [element.id, element]))
  const outcomes: ElementBatchSharingOutcome[] = []

  for (const elementId of uniqueElementIds) {
    const element = elementsById.get(elementId)
    if (!element) {
      outcomes.push({
        elementId,
        status: 'SKIPPED',
        reason: 'ELEMENT_NOT_FOUND_OR_DELETED',
      })
      continue
    }

    const callerPermission = element.permissions[0]?.permissionLevel
    if (
      callerPermission !== DB.PermissionLevel.ADMIN &&
      callerPermission !== DB.PermissionLevel.OWNER
    ) {
      outcomes.push({
        elementId,
        status: 'SKIPPED',
        reason: 'INSUFFICIENT_PERMISSION',
      })
      continue
    }

    try {
      await shareElementWithResolvedTarget(
        {
          elementId,
          permissionLevel,
          propagation: false,
          target: resolvedTarget.target,
        },
        ctx
      )
      outcomes.push({ elementId, status: 'SHARED', reason: null })
    } catch (error) {
      console.error('Failed to share element %s', elementId, error)
      outcomes.push({
        elementId,
        status: 'FAILED',
        reason: 'SHARING_FAILED',
      })
    }
  }

  return { targetError: null, outcomes }
}

export async function shareObject(
  {
    permissionLevel,
    shortnameOrEmail,
    userGroupId: requestedUserGroupId,
    propagation,
    catalogCollectionId,
    answerCollectionId,
    elementId,
    courseId,
    liveQuizId,
    practiceQuizId,
    microLearningId,
    groupActivityId,
  }: {
    permissionLevel: DB.PermissionLevel
    shortnameOrEmail?: string | null
    userGroupId?: number | null
    propagation: boolean
    catalogCollectionId?: string
    answerCollectionId?: number
    elementId?: number
    courseId?: string
    liveQuizId?: string
    practiceQuizId?: string
    microLearningId?: string
    groupActivityId?: string
  },
  ctx: ContextWithUser
) {
  const resolvedTarget = await resolveSharingTarget(
    { shortnameOrEmail, userGroupId: requestedUserGroupId },
    ctx,
    'DIRECT'
  )
  if (!resolvedTarget.target) {
    return null
  }

  // create new permission with the defined access level
  if (resolvedTarget.target.kind === 'USER') {
    const user = resolvedTarget.target
    const userId = user.id

    if (typeof elementId !== 'undefined') {
      const permission = await shareElementWithResolvedTarget(
        {
          elementId,
          permissionLevel,
          propagation,
          target: resolvedTarget.target,
        },
        ctx
      )

      return {
        permissionId: permission.id,
        userId: user.id,
        username: user.shortname,
        userEmail: user.email,
        userGroupId: undefined,
        userGroupName: undefined,
        permissionLevel: permission.permissionLevel,
        propagation: permission.propagation,
        isOwn: false,
      }
    }

    const permission = await ctx.prisma.$transaction(
      async (prisma) => {
        // upsert new permission for the answer collection under consideration
        const newPermission = await prisma.permission.upsert({
          where: {
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
          create: {
            permissionLevel,
            propagation,
            user: {
              connect: {
                id: userId,
              },
            },
            catalogCollection:
              typeof catalogCollectionId !== 'undefined'
                ? {
                    connect: {
                      id: catalogCollectionId,
                    },
                  }
                : undefined,
            answerCollection:
              typeof answerCollectionId !== 'undefined'
                ? {
                    connect: {
                      id: answerCollectionId,
                    },
                  }
                : undefined,
            course:
              typeof courseId !== 'undefined'
                ? {
                    connect: {
                      id: courseId,
                    },
                  }
                : undefined,
            liveQuiz:
              typeof liveQuizId !== 'undefined'
                ? {
                    connect: {
                      id: liveQuizId,
                    },
                  }
                : undefined,
            practiceQuiz:
              typeof practiceQuizId !== 'undefined'
                ? {
                    connect: {
                      id: practiceQuizId,
                    },
                  }
                : undefined,
            microLearning:
              typeof microLearningId !== 'undefined'
                ? {
                    connect: {
                      id: microLearningId,
                    },
                  }
                : undefined,
            groupActivity:
              typeof groupActivityId !== 'undefined'
                ? {
                    connect: {
                      id: groupActivityId,
                    },
                  }
                : undefined,
          },
          update: {
            permissionLevel,
            propagation,
          },
        })

        // remove any pending access requests for the user
        await prisma.accessRequest.deleteMany({
          where: {
            userId,
            catalogCollectionId,
            answerCollectionId,
            courseId,
            liveQuizId,
            practiceQuizId,
            microLearningId,
            groupActivityId,
          },
        })

        // trigger recomputation of derived permissions for the object
        const updateAccessRequests =
          permissionLevel === DB.PermissionLevel.ADMIN
        if (typeof catalogCollectionId !== 'undefined') {
          await recomputeDerivedPermissions(
            { catalogCollectionId, userId, updateAccessRequests },
            prisma
          )
        } else if (typeof answerCollectionId !== 'undefined') {
          await recomputeDerivedPermissions(
            { answerCollectionId, userId, updateAccessRequests },
            prisma
          )
        } else if (typeof courseId !== 'undefined') {
          await recomputeDerivedPermissions(
            { courseId, userId, updateAccessRequests },
            prisma
          )
        } else if (typeof liveQuizId !== 'undefined') {
          await recomputeDerivedPermissions(
            { liveQuizId, userId, updateAccessRequests },
            prisma
          )
        } else if (typeof practiceQuizId !== 'undefined') {
          await recomputeDerivedPermissions(
            { practiceQuizId, userId, updateAccessRequests },
            prisma
          )
        } else if (typeof microLearningId !== 'undefined') {
          await recomputeDerivedPermissions(
            { microLearningId, userId, updateAccessRequests },
            prisma
          )
        } else if (typeof groupActivityId !== 'undefined') {
          await recomputeDerivedPermissions(
            { groupActivityId, userId, updateAccessRequests },
            prisma
          )
        }

        // create an audit log entry for the newly created permission
        const { objectType, objectId } = getAuditLogObjectType({
          catalogCollectionId,
          answerCollectionId,
          courseId,
          liveQuizId,
          practiceQuizId,
          microLearningId,
          groupActivityId,
        })
        if (objectType && objectId) {
          await prisma.auditLogEntry.create({
            data: {
              type: DB.AuditLogType.PERMISSION_GRANTED,
              objectType,
              objectId,
              sourceUserId: ctx.user.sub,
              targetUserId: userId,
              message: `Direct permission with level ${permissionLevel} granted for ${objectType} (ID ${objectId}) by owner / admin ${ctx.user.sub} to user ${userId}.`,
            },
          })
        } else {
          throw new Error(
            `Could not determine object type or ID for audit log entry. Permission ID: ${newPermission.id}, Details: ${JSON.stringify(
              {
                catalogCollectionId,
                answerCollectionId,
                courseId,
                liveQuizId,
                practiceQuizId,
                microLearningId,
                groupActivityId,
              }
            )}`
          )
        }

        return newPermission
      },
      { timeout: 60000 }
    )

    // invalidate permission
    ctx.emitter.emit('invalidate', {
      typename: 'Permission',
      id: permission.id,
    })

    return {
      permissionId: permission.id,
      userId: user.id,
      username: user.shortname,
      userEmail: user.email,
      userGroupId: undefined,
      userGroupName: undefined,
      permissionLevel: permission.permissionLevel,
      propagation: permission.propagation,
      isOwn: false,
    }
  } else {
    const userGroup = resolvedTarget.target
    const userGroupId = userGroup.id

    if (typeof elementId !== 'undefined') {
      const permission = await shareElementWithResolvedTarget(
        {
          elementId,
          permissionLevel,
          propagation,
          target: resolvedTarget.target,
        },
        ctx
      )

      return {
        permissionId: permission.id,
        userId: undefined,
        username: undefined,
        userEmail: undefined,
        userGroupId: userGroup.id,
        userGroupName: userGroup.name,
        permissionLevel: permission.permissionLevel,
        propagation: permission.propagation,
        isOwn: false,
      }
    }

    const permission = await ctx.prisma.$transaction(
      async (prisma) => {
        // upsert new permission for the answer collection under consideration
        const newPermission = await prisma.permission.upsert({
          where: {
            catalogCollectionId_userGroupId:
              typeof catalogCollectionId !== 'undefined'
                ? {
                    catalogCollectionId,
                    userGroupId,
                  }
                : undefined,
            answerCollectionId_userGroupId:
              typeof answerCollectionId !== 'undefined'
                ? {
                    answerCollectionId,
                    userGroupId,
                  }
                : undefined,
            courseId_userGroupId:
              typeof courseId !== 'undefined'
                ? {
                    courseId,
                    userGroupId,
                  }
                : undefined,
            liveQuizId_userGroupId:
              typeof liveQuizId !== 'undefined'
                ? {
                    liveQuizId,
                    userGroupId,
                  }
                : undefined,
            practiceQuizId_userGroupId:
              typeof practiceQuizId !== 'undefined'
                ? {
                    practiceQuizId,
                    userGroupId,
                  }
                : undefined,
            microLearningId_userGroupId:
              typeof microLearningId !== 'undefined'
                ? {
                    microLearningId,
                    userGroupId,
                  }
                : undefined,
            groupActivityId_userGroupId:
              typeof groupActivityId !== 'undefined'
                ? {
                    groupActivityId,
                    userGroupId,
                  }
                : undefined,
          },
          create: {
            permissionLevel,
            propagation,
            userGroup: {
              connect: {
                id: userGroupId,
              },
            },
            catalogCollection:
              typeof catalogCollectionId !== 'undefined'
                ? {
                    connect: {
                      id: catalogCollectionId,
                    },
                  }
                : undefined,
            answerCollection:
              typeof answerCollectionId !== 'undefined'
                ? {
                    connect: {
                      id: answerCollectionId,
                    },
                  }
                : undefined,
            course:
              typeof courseId !== 'undefined'
                ? {
                    connect: {
                      id: courseId,
                    },
                  }
                : undefined,
            liveQuiz:
              typeof liveQuizId !== 'undefined'
                ? {
                    connect: {
                      id: liveQuizId,
                    },
                  }
                : undefined,
            practiceQuiz:
              typeof practiceQuizId !== 'undefined'
                ? {
                    connect: {
                      id: practiceQuizId,
                    },
                  }
                : undefined,
            microLearning:
              typeof microLearningId !== 'undefined'
                ? {
                    connect: {
                      id: microLearningId,
                    },
                  }
                : undefined,
            groupActivity:
              typeof groupActivityId !== 'undefined'
                ? {
                    connect: {
                      id: groupActivityId,
                    },
                  }
                : undefined,
          },
          update: {
            permissionLevel,
            propagation,
          },
        })

        // check if admin permissions were granted and the corresponding access requests need to be updated
        const updateAccessRequests =
          permissionLevel === DB.PermissionLevel.ADMIN

        // trigger recomputation of derived permissions for the object
        if (typeof catalogCollectionId !== 'undefined') {
          await recomputeDerivedPermissions(
            { catalogCollectionId, updateAccessRequests },
            prisma
          )
        } else if (typeof answerCollectionId !== 'undefined') {
          await recomputeDerivedPermissions(
            { answerCollectionId, updateAccessRequests },
            prisma
          )
        } else if (typeof courseId !== 'undefined') {
          await recomputeDerivedPermissions(
            { courseId, updateAccessRequests },
            prisma
          )
        } else if (typeof liveQuizId !== 'undefined') {
          await recomputeDerivedPermissions(
            { liveQuizId, updateAccessRequests },
            prisma
          )
        } else if (typeof practiceQuizId !== 'undefined') {
          await recomputeDerivedPermissions(
            { practiceQuizId, updateAccessRequests },
            prisma
          )
        } else if (typeof microLearningId !== 'undefined') {
          await recomputeDerivedPermissions(
            { microLearningId, updateAccessRequests },
            prisma
          )
        } else if (typeof groupActivityId !== 'undefined') {
          await recomputeDerivedPermissions(
            { groupActivityId, updateAccessRequests },
            prisma
          )
        }

        // create an audit log entry for the newly created permission
        const { objectType, objectId } = getAuditLogObjectType({
          catalogCollectionId,
          answerCollectionId,
          courseId,
          liveQuizId,
          practiceQuizId,
          microLearningId,
          groupActivityId,
        })
        if (objectType && objectId) {
          await prisma.auditLogEntry.create({
            data: {
              type: DB.AuditLogType.PERMISSION_GRANTED,
              objectType,
              objectId,
              sourceUserId: ctx.user.sub,
              targetUserGroupId: userGroupId,
              message: `Direct permission with level ${permissionLevel} granted for ${objectType} (ID ${objectId}) by owner / admin ${ctx.user.sub} to user group ${userGroupId}.`,
            },
          })
        } else {
          throw new Error(
            `Could not determine object type or ID for audit log entry. Permission ID: ${newPermission.id}, Details: ${JSON.stringify(
              {
                catalogCollectionId,
                answerCollectionId,
                courseId,
                liveQuizId,
                practiceQuizId,
                microLearningId,
                groupActivityId,
              }
            )}`
          )
        }

        return newPermission
      },
      { timeout: 60000 }
    )

    // invalidate permission
    ctx.emitter.emit('invalidate', {
      typename: 'Permission',
      id: permission.id,
    })

    return {
      permissionId: permission.id,
      userId: undefined,
      username: undefined,
      userEmail: undefined,
      userGroupId: userGroup.id,
      userGroupName: userGroup.name,
      permissionLevel: permission.permissionLevel,
      propagation: permission.propagation,
      isOwn: false,
    }
  }
}
// #endregion

// ! Import Functionalities (Public Resources)
// #region
export async function copyAnswerCollectionToAccount(
  {
    collectionId,
    catalogCollectionId,
  }: { collectionId: number; catalogCollectionId?: string | null },
  ctx: ContextWithUser
) {
  // verify that the user has access to the catalog collection the answer collection is contained in
  const validAccess = catalogCollectionId
    ? await verifyCatalogCollectionBrowsable(
        {
          catalogCollectionId:
            catalogCollectionId ?? MISSING_CATALOG_COLLECTION_ID,
        },
        ctx
      )
    : true

  if (!validAccess) {
    return false
  }

  // get catalog assignment of this answer collection, verify public access
  const assignment = await ctx.prisma.catalogCollectionAssignment.findUnique({
    where: {
      answerCollectionId_catalogCollectionId: {
        answerCollectionId: collectionId,
        catalogCollectionId:
          catalogCollectionId ?? MISSING_CATALOG_COLLECTION_ID,
      },
    },
    include: {
      answerCollection: {
        include: {
          entries: true,
        },
      },
    },
  })

  // make sure that the answer collection is assigned to the specified catalog collection and that it is public (import allowed)
  if (!assignment || assignment.access !== DB.ObjectAccess.PUBLIC) {
    return false
  }

  // make sure that the answer collection exists and that the requesting user is not the owner
  const collection = assignment.answerCollection
  if (!collection || collection.ownerId === ctx.user.sub) {
    return false
  }

  // count number of times the answer collection has been imported before
  const importCount = await ctx.prisma.answerCollection.count({
    where: {
      originalId: collection.id,
      ownerId: ctx.user.sub,
    },
  })

  await ctx.prisma.$transaction(async (prisma) => {
    // create new answer collection with the content of the original one
    const newCollection = await prisma.answerCollection.create({
      data: {
        originalId: collection.id,
        name:
          importCount > 0
            ? `${collection.name} (${importCount})`
            : collection.name,
        description: collection.description,
        owner: {
          connect: {
            id: ctx.user.sub,
          },
        },
        entries: {
          create: collection.entries.map((entry) => ({
            value: entry.value,
          })),
        },
      },
      include: {
        entries: true,
      },
    })

    // trigger recomputation of derived permissions for the object within the transaction
    await recomputeDerivedPermissions(
      { answerCollectionId: newCollection.id, userId: ctx.user.sub },
      prisma
    )

    return newCollection
  })

  // invalidate cache for the existing collection
  ctx.emitter.emit('invalidate', {
    typename: 'AnswerCollection',
    id: collection.id,
  })

  return true
}

export async function copyElementToAccount(
  {
    elementId,
    catalogCollectionId,
  }: { elementId: number; catalogCollectionId?: string | null },
  ctx: ContextWithUser
) {
  // verify that the user has access to the catalog collection the element is contained in
  const validAccess = catalogCollectionId
    ? await verifyCatalogCollectionBrowsable(
        {
          catalogCollectionId:
            catalogCollectionId ?? MISSING_CATALOG_COLLECTION_ID,
        },
        ctx
      )
    : true

  if (!validAccess) {
    return false
  }

  // get catalog assignment of this element, verify public access
  const assignment = await ctx.prisma.catalogCollectionAssignment.findUnique({
    where: {
      elementId_catalogCollectionId: {
        elementId,
        catalogCollectionId:
          catalogCollectionId ?? MISSING_CATALOG_COLLECTION_ID,
      },
    },
    include: {
      element: {
        include: {
          answerCollectionItems: true,
        },
      },
    },
  })

  // make sure that the element is assigned to the specified catalog collection and that it is public (import allowed)
  if (!assignment || assignment.access !== DB.ObjectAccess.PUBLIC) {
    return false
  }

  // make sure that the element exists and that the requesting user is not the owner
  const element = assignment.element
  if (!element || element.ownerId === ctx.user.sub) {
    return false
  }

  // count number of times the element has been imported before
  const importCount = await ctx.prisma.element.count({
    where: {
      originalId: String(element.id),
      ownerId: ctx.user.sub,
    },
  })

  await ctx.prisma.$transaction(async (prisma) => {
    // create new element with the content of the original one
    const newElement = await prisma.element.create({
      data: {
        originalId: String(element.id),
        name:
          importCount > 0 ? `${element.name} (${importCount})` : element.name,
        content: element.content,
        explanation: element.explanation,
        basePoints: element.basePoints,
        pointsMultiplier: element.pointsMultiplier,
        type: element.type,
        options: element.options,
        answerCollection:
          element.answerCollectionId !== null
            ? {
                connect: {
                  id: element.answerCollectionId,
                },
              }
            : undefined,
        answerCollectionItems: {
          connect: element.answerCollectionItems.map((item) => ({
            id: item.id,
          })),
        },
        owner: {
          connect: {
            id: ctx.user.sub,
          },
        },
      },
    })

    // trigger recomputation of derived permissions for the object
    await recomputeDerivedPermissions(
      { elementId: newElement.id, userId: ctx.user.sub },
      prisma
    )

    // if an answer collection is linked to the element, recompute the corresponding derived permissions
    if (newElement.answerCollectionId !== null) {
      await recomputeDerivedPermissions(
        {
          answerCollectionId: newElement.answerCollectionId,
          userId: ctx.user.sub,
        },
        prisma
      )
    }

    return newElement
  })

  // invalidate cache for the existing element
  ctx.emitter.emit('invalidate', {
    typename: 'Element',
    id: element.id,
  })

  return true
}

export async function importAnswerCollection(
  {
    collectionId,
    catalogCollectionId,
  }: { collectionId: number; catalogCollectionId?: string | null },
  ctx: ContextWithUser
) {
  // verify that the user has access to the catalog collection the answer collection is contained in
  const validAccess = catalogCollectionId
    ? await verifyCatalogCollectionBrowsable(
        {
          catalogCollectionId:
            catalogCollectionId ?? MISSING_CATALOG_COLLECTION_ID,
        },
        ctx
      )
    : true

  if (!validAccess) {
    return false
  }

  // get catalog assignment of this answer collection, verify public access
  const assignment = await ctx.prisma.catalogCollectionAssignment.findUnique({
    where: {
      answerCollectionId_catalogCollectionId: {
        answerCollectionId: collectionId,
        catalogCollectionId:
          catalogCollectionId ?? MISSING_CATALOG_COLLECTION_ID,
      },
    },
    include: {
      answerCollection: {
        include: {
          entries: true,
        },
      },
    },
  })

  // make sure that the answer collection is assigned to the specified catalog collection and that it is public (import allowed)
  if (!assignment || assignment.access !== DB.ObjectAccess.PUBLIC) {
    return false
  }

  // make sure that the answer collection exists and that the requesting user is not the owner
  const collection = assignment.answerCollection
  if (!collection || collection.ownerId === ctx.user.sub) {
    return false
  }

  await ctx.prisma.$transaction(async (prisma) => {
    // create a read permission for the importing user on the answer collection
    await prisma.permission.upsert({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: collection.id,
          userId: ctx.user.sub,
        },
      },
      create: {
        permissionLevel: DB.PermissionLevel.READ,
        propagation: false,
        user: {
          connect: {
            id: ctx.user.sub,
          },
        },
        answerCollection: {
          connect: {
            id: collection.id,
          },
        },
      },
      update: {},
    })

    // trigger recomputation of derived permissions for the object within the transaction
    await recomputeDerivedPermissions(
      { answerCollectionId: collection.id, userId: ctx.user.sub },
      prisma
    )

    // set audit log entry (granted read permissions)
    await prisma.auditLogEntry.create({
      data: {
        type: DB.AuditLogType.PERMISSION_GRANTED,
        objectType: DB.ObjectType.ANSWER_COLLECTION,
        objectId: String(collection.id),
        sourceUserId: ctx.user.sub,
        targetUserId: ctx.user.sub,
        message: `Read permission granted on answer collection (ID ${collection.id}) through public catalog collection (ID ${catalogCollectionId}) and assignment (ID ${assignment.id}) for user ${ctx.user.sub}.`,
      },
    })
  })

  // invalidate cache for the existing collection
  ctx.emitter.emit('invalidate', {
    typename: 'AnswerCollection',
    id: collection.id,
  })

  return true
}
// #endregion

// ! Catalog Operations
// #region
export async function getAnswerCollectionCatalogInfo(
  {
    collectionId,
    catalogCollectionId,
  }: { collectionId: number; catalogCollectionId?: string | null },
  ctx: ContextWithUser
) {
  // fetch answer collection
  const collection = await ctx.prisma.answerCollection.findUnique({
    where: { id: collectionId },
    include: { entries: true, owner: { select: { shortname: true } } },
  })

  if (!collection) {
    return null
  }

  // verify that the user has access to the catalog collection the answer collection is contained in
  const validAccess = catalogCollectionId
    ? await verifyCatalogCollectionBrowsable({ catalogCollectionId }, ctx)
    : true

  if (!validAccess) {
    return null
  }

  // fetch the corresponding assignement to access the access enum value
  const assignment = await ctx.prisma.catalogCollectionAssignment.findUnique({
    where: {
      answerCollectionId_catalogCollectionId: {
        answerCollectionId: collectionId,
        catalogCollectionId:
          catalogCollectionId ?? MISSING_CATALOG_COLLECTION_ID,
      },
    },
  })

  if (!assignment) {
    return null
  }

  // only if collection is public, the entries should be revealed
  if (assignment.access === DB.ObjectAccess.PUBLIC) {
    return collection
  } else {
    return {
      ...collection,
      entries: [],
    }
  }
}

export async function getCatalogObjects(
  { catalogCollectionId }: { catalogCollectionId?: string | null },
  ctx: ContextWithUser
) {
  // verify that the user has access to the catalog collection (if defined)
  if (catalogCollectionId) {
    const valid = await verifyCatalogCollectionBrowsable(
      { catalogCollectionId },
      ctx
    )

    if (!valid) {
      return []
    }
  }

  const catalogCollection = await ctx.prisma.catalogCollection.findUnique({
    where: {
      id: catalogCollectionId ?? MISSING_CATALOG_COLLECTION_ID,
    },
    include: {
      objectAssignments: {
        include: {
          answerCollection: {
            where: { isDeleted: false },
            select: {
              id: true,
              name: true,
              ownerId: true,
              owner: { select: { shortname: true } },
              permissions: { where: { userId: ctx.user.sub } },
              accessRequests: { where: { userId: ctx.user.sub } },
            },
          },
          element: {
            where: { isDeleted: false },
            select: {
              id: true,
              name: true,
              ownerId: true,
              owner: { select: { shortname: true } },
              permissions: { where: { userId: ctx.user.sub } },
              accessRequests: { where: { userId: ctx.user.sub } },
            },
          },
          liveQuiz: {
            where: { isDeleted: false },
            select: {
              id: true,
              name: true,
              status: true,
              ownerId: true,
              owner: { select: { shortname: true } },
              permissions: { where: { userId: ctx.user.sub } },
              accessRequests: { where: { userId: ctx.user.sub } },
              templateInfo: { select: { id: true } },
            },
          },
        },
      },
    },
  })

  const mappedCatalogObjects: CatalogObject[] =
    catalogCollection?.objectAssignments.flatMap((assignment) => {
      if (assignment.answerCollection) {
        const answerCollection = assignment.answerCollection
        const permission = answerCollection.permissions[0]

        return {
          id: assignment.id,
          objectId: answerCollection.id,
          name: answerCollection.name,
          objectType: DB.ObjectType.ANSWER_COLLECTION,
          access: assignment.access,
          ownerShortname: answerCollection.owner?.shortname,
          isOwner: permission?.permissionLevel === DB.PermissionLevel.OWNER,
          isManager:
            permission?.permissionLevel === DB.PermissionLevel.ADMIN ||
            permission?.permissionLevel === DB.PermissionLevel.OWNER,
          isRequested: answerCollection.accessRequests.length > 0,
          isShared:
            typeof permission !== 'undefined' &&
            permission.permissionLevel !== DB.PermissionLevel.OWNER,
        }
      } else if (assignment.element) {
        const element = assignment.element
        const permission = element.permissions[0]

        return {
          id: assignment.id,
          objectId: element.id,
          name: element.name,
          objectType: DB.ObjectType.ELEMENT,
          access: assignment.access,
          ownerShortname: element.owner?.shortname,
          isOwner: permission?.permissionLevel === DB.PermissionLevel.OWNER,
          isManager:
            permission?.permissionLevel === DB.PermissionLevel.ADMIN ||
            permission?.permissionLevel === DB.PermissionLevel.OWNER,
          isRequested: element.accessRequests.length > 0,
          isShared:
            typeof permission !== 'undefined' &&
            permission.permissionLevel !== DB.PermissionLevel.OWNER,
        }
      } else if (
        assignment.liveQuiz &&
        assignment.liveQuiz.status === DB.PublicationStatus.TEMPLATE
      ) {
        const liveQuiz = assignment.liveQuiz
        const permission = liveQuiz.permissions[0]

        return {
          id: assignment.id,
          objectUuid: liveQuiz.id,
          name: liveQuiz.name,
          templateId: liveQuiz.templateInfo?.id,
          objectType: DB.ObjectType.LIVE_QUIZ,
          access: assignment.access,
          ownerShortname: liveQuiz.owner?.shortname,
          isOwner: permission?.permissionLevel === DB.PermissionLevel.OWNER,
          isManager:
            permission?.permissionLevel === DB.PermissionLevel.ADMIN ||
            permission?.permissionLevel === DB.PermissionLevel.OWNER,
          isRequested: liveQuiz.accessRequests.length > 0,
          isShared:
            typeof permission !== 'undefined' &&
            permission.permissionLevel !== DB.PermissionLevel.OWNER,
        }
        // TODO: add more entries here, once templates also support practice quizzes, microlearnings, and group activities
      }

      return []
    }) ?? []

  return mappedCatalogObjects
}

export async function removeCatalogObjectAssignment(
  { assignmentId }: { assignmentId: number },
  ctx: ContextWithUser
) {
  const { sufficientPermissions, assignment } =
    await verifyCatalogObjectEditPermissions({ assignmentId }, ctx)

  if (!sufficientPermissions || !assignment) {
    return false
  }

  // change the access level of the assignment
  const updatedAssignment = await ctx.prisma.catalogCollectionAssignment.delete(
    { where: { id: assignmentId } }
  )

  // create an audit log entry for the assignment removal
  const { objectType, objectId } = getAuditLogObjectType({
    answerCollectionId: assignment.answerCollectionId,
    elementId: assignment.elementId,
    courseId: assignment.courseId,
    liveQuizId: assignment.liveQuizId,
    practiceQuizId: assignment.practiceQuizId,
    microLearningId: assignment.microLearningId,
    groupActivityId: assignment.groupActivityId,
  })
  if (objectType && objectId) {
    await ctx.prisma.auditLogEntry.create({
      data: {
        type: DB.AuditLogType.CATALOG_ASSIGNMENT_DELETED,
        objectType,
        objectId,
        sourceUserId: ctx.user.sub,
        message: `${objectType} (ID ${objectId}) removed from catalog collection (ID ${assignment.catalogCollectionId}) by user ${ctx.user.sub}.`,
      },
    })
  } else {
    throw new Error(
      `Could not determine object type or ID for audit log entry. Assignment ID: ${assignmentId}, Details: ${JSON.stringify(
        {
          answerCollectionId: assignment.answerCollectionId,
          elementId: assignment.elementId,
          courseId: assignment.courseId,
          liveQuizId: assignment.liveQuizId,
          practiceQuizId: assignment.practiceQuizId,
          microLearningId: assignment.microLearningId,
          groupActivityId: assignment.groupActivityId,
        }
      )}`
    )
  }

  return (
    updatedAssignment.id !== null && typeof updatedAssignment.id !== 'undefined'
  )
}

export async function getCatalogAnswerCollections(ctx: ContextWithUser) {
  // fetch all answer collections, where the user is the owner or has been granted admin access
  const collections = await ctx.prisma.answerCollection.findMany({
    where: {
      isDeleted: false, // soft deleted answer collections cannot be added to the catalog
      permissions: {
        some: {
          userId: ctx.user.sub,
          permissionLevel: {
            in: [DB.PermissionLevel.ADMIN, DB.PermissionLevel.OWNER],
          },
        },
      },
    },
    orderBy: { name: 'asc' },
  })

  return collections.map((collection) => ({
    id: String(collection.id),
    name: collection.name,
  }))
}

export async function getCatalogLiveQuizTemplates(ctx: ContextWithUser) {
  // fetch all live quiz templates, where the user is the owner or has been granted admin access
  const liveQuizzes = await ctx.prisma.liveQuiz.findMany({
    where: {
      status: DB.PublicationStatus.TEMPLATE,
      permissions: {
        some: {
          userId: ctx.user.sub,
          permissionLevel: {
            in: [DB.PermissionLevel.ADMIN, DB.PermissionLevel.OWNER],
          },
        },
      },
    },
    orderBy: { name: 'asc' },
  })

  return liveQuizzes.map((liveQuiz) => ({
    id: liveQuiz.id,
    name: liveQuiz.name,
  }))
}

export async function getCatalogElements(ctx: ContextWithUser) {
  // fetch all elements, where the user is the owner or has been granted admin access
  const elements = await ctx.prisma.element.findMany({
    where: {
      isDeleted: false, // soft deleted answer collections cannot be added to the catalog
      permissions: {
        some: {
          userId: ctx.user.sub,
          permissionLevel: {
            in: [DB.PermissionLevel.ADMIN, DB.PermissionLevel.OWNER],
          },
        },
      },
    },
    orderBy: { name: 'asc' },
  })

  return elements.map((element) => ({
    id: String(element.id),
    name: element.name,
  }))
}

export async function addObjectToCatalog(
  // one of the object ids should be defined for the object that is to be added to the catalog
  // otherwise, the function will return null
  {
    access,
    catalogCollectionId, // catalog collection id to which the shared object should be added to
    answerCollectionId,
    elementId,
    courseId,
    liveQuizId,
    practiceQuizId,
    microLearningId,
    groupActivityId,
  }: {
    access: DB.ObjectAccess
    catalogCollectionId?: string | null
    answerCollectionId?: number
    elementId?: number
    courseId?: string
    liveQuizId?: string
    practiceQuizId?: string
    microLearningId?: string
    groupActivityId?: string
  },
  ctx: ContextWithUser
) {
  // collect shared object information in corresponding object
  let objectInfo: {
    objectId?: number
    objectUuid?: string
    objectType: DB.ObjectType
    objectName: string
    ownerShortname?: string
    ownerId?: string | null
    templateId?: string
    isShared: boolean
  } | null = null

  // verify that the user has sufficient permissions on object
  if (typeof answerCollectionId !== 'undefined') {
    const answerCollection = await ctx.prisma.answerCollection.findUnique({
      where: {
        id: answerCollectionId,
        permissions: {
          some: {
            userId: ctx.user.sub,
            permissionLevel: {
              in: [DB.PermissionLevel.ADMIN, DB.PermissionLevel.OWNER],
            },
          },
        },
      },
      include: {
        owner: { select: { shortname: true } },
        permissions: { where: { userId: ctx.user.sub } },
      },
    })

    if (!answerCollection) {
      return null
    }

    // get (unique) derived permission of this user on the answer collection
    const permission = answerCollection.permissions[0]
    if (!permission) {
      return null
    }

    // set object info
    objectInfo = {
      objectId: answerCollection.id,
      objectUuid: undefined,
      objectType: DB.ObjectType.ANSWER_COLLECTION,
      objectName: answerCollection.name,
      ownerShortname: answerCollection.owner?.shortname,
      ownerId: answerCollection.ownerId,
      isShared: permission.permissionLevel !== DB.PermissionLevel.OWNER,
    }
  } else if (typeof elementId !== 'undefined') {
    const element = await ctx.prisma.element.findUnique({
      where: {
        id: elementId,
        permissions: {
          some: {
            userId: ctx.user.sub,
            permissionLevel: {
              in: [DB.PermissionLevel.ADMIN, DB.PermissionLevel.OWNER],
            },
          },
        },
      },
      include: {
        owner: { select: { shortname: true } },
        permissions: { where: { userId: ctx.user.sub } },
      },
    })

    if (!element) {
      return null
    }

    // get (unique) derived permission of this user on the element
    const permission = element.permissions[0]
    if (!permission) {
      return null
    }

    // set object info
    objectInfo = {
      objectId: element.id,
      objectUuid: undefined,
      objectType: DB.ObjectType.ELEMENT,
      objectName: element.name,
      ownerShortname: element.owner?.shortname,
      ownerId: element.ownerId,
      isShared: permission.permissionLevel !== DB.PermissionLevel.OWNER,
    }
  } else if (typeof liveQuizId !== 'undefined') {
    const liveQuiz = await ctx.prisma.liveQuiz.findUnique({
      where: {
        id: liveQuizId,
        status: DB.PublicationStatus.TEMPLATE, // live quizzes are not supported by the catalog at the moment
        permissions: {
          some: {
            userId: ctx.user.sub,
            permissionLevel: {
              in: [DB.PermissionLevel.ADMIN, DB.PermissionLevel.OWNER],
            },
          },
        },
      },
      include: {
        owner: { select: { shortname: true } },
        templateInfo: { select: { id: true } },
        permissions: { where: { userId: ctx.user.sub } },
      },
    })

    if (!liveQuiz) {
      return null
    }

    // get (unique) derived permission of this user on the live quiz
    const permission = liveQuiz.permissions[0]
    if (!permission) {
      return null
    }

    // set object info
    objectInfo = {
      objectId: undefined,
      objectUuid: liveQuiz.id,
      objectType: DB.ObjectType.LIVE_QUIZ,
      objectName: liveQuiz.name,
      ownerShortname: liveQuiz.owner?.shortname,
      ownerId: liveQuiz.ownerId,
      templateId: liveQuiz.templateInfo?.id,
      isShared: permission.permissionLevel !== DB.PermissionLevel.OWNER,
    }
  }
  // TODO: add more activity template types here, as soon as they are available
  else {
    return null
  }

  // if the object info was not set, return null
  if (typeof objectInfo === 'undefined' || objectInfo === null) {
    return null
  }

  const assignment = await ctx.prisma.$transaction(async (prisma) => {
    // upsert the assignemnt of the answer collection to the catalog collection
    const newAssignment = await prisma.catalogCollectionAssignment.upsert({
      where: {
        answerCollectionId_catalogCollectionId:
          typeof answerCollectionId !== 'undefined'
            ? {
                answerCollectionId,
                catalogCollectionId:
                  catalogCollectionId ?? MISSING_CATALOG_COLLECTION_ID,
              }
            : undefined,
        elementId_catalogCollectionId:
          typeof elementId !== 'undefined'
            ? {
                elementId,
                catalogCollectionId:
                  catalogCollectionId ?? MISSING_CATALOG_COLLECTION_ID,
              }
            : undefined,
        courseId_catalogCollectionId:
          typeof courseId !== 'undefined'
            ? {
                courseId,
                catalogCollectionId:
                  catalogCollectionId ?? MISSING_CATALOG_COLLECTION_ID,
              }
            : undefined,
        liveQuizId_catalogCollectionId:
          typeof liveQuizId !== 'undefined'
            ? {
                liveQuizId,
                catalogCollectionId:
                  catalogCollectionId ?? MISSING_CATALOG_COLLECTION_ID,
              }
            : undefined,
        practiceQuizId_catalogCollectionId:
          typeof practiceQuizId !== 'undefined'
            ? {
                practiceQuizId,
                catalogCollectionId:
                  catalogCollectionId ?? MISSING_CATALOG_COLLECTION_ID,
              }
            : undefined,
        microLearningId_catalogCollectionId:
          typeof microLearningId !== 'undefined'
            ? {
                microLearningId,
                catalogCollectionId:
                  catalogCollectionId ?? MISSING_CATALOG_COLLECTION_ID,
              }
            : undefined,
        groupActivityId_catalogCollectionId:
          typeof groupActivityId !== 'undefined'
            ? {
                groupActivityId,
                catalogCollectionId:
                  catalogCollectionId ?? MISSING_CATALOG_COLLECTION_ID,
              }
            : undefined,
      },
      create: {
        access,
        catalogCollection: {
          connect: {
            id: catalogCollectionId ?? MISSING_CATALOG_COLLECTION_ID,
          },
        },
        answerCollection:
          typeof answerCollectionId !== 'undefined'
            ? {
                connect: {
                  id: answerCollectionId,
                },
              }
            : undefined,
        element:
          typeof elementId !== 'undefined'
            ? {
                connect: {
                  id: elementId,
                },
              }
            : undefined,
        course:
          typeof courseId !== 'undefined'
            ? {
                connect: {
                  id: courseId,
                },
              }
            : undefined,
        liveQuiz:
          typeof liveQuizId !== 'undefined'
            ? {
                connect: {
                  id: liveQuizId,
                },
              }
            : undefined,
        practiceQuiz:
          typeof practiceQuizId !== 'undefined'
            ? {
                connect: {
                  id: practiceQuizId,
                },
              }
            : undefined,
        microLearning:
          typeof microLearningId !== 'undefined'
            ? {
                connect: {
                  id: microLearningId,
                },
              }
            : undefined,
        groupActivity:
          typeof groupActivityId !== 'undefined'
            ? {
                connect: {
                  id: groupActivityId,
                },
              }
            : undefined,
      },
      update: {
        access,
      },
    })

    // create an audit log entry for the assignment creation
    const { objectType, objectId } = getAuditLogObjectType({
      answerCollectionId,
      elementId,
      courseId,
      liveQuizId,
      practiceQuizId,
      microLearningId,
      groupActivityId,
    })
    if (objectType && objectId) {
      await prisma.auditLogEntry.create({
        data: {
          type: DB.AuditLogType.CATALOG_ASSIGNMENT_CREATED,
          objectType,
          objectId,
          sourceUserId: ctx.user.sub,
          message: `${objectType} (ID ${objectId}) added to catalog collection (ID ${catalogCollectionId}) by user ${ctx.user.sub}.`,
        },
      })
    } else {
      throw new Error(
        `Could not determine object type or ID for audit log entry. Assignment ID: ${newAssignment.id}, Details: ${JSON.stringify(
          {
            answerCollectionId,
            elementId,
            courseId,
            liveQuizId,
            practiceQuizId,
            microLearningId,
            groupActivityId,
          }
        )}`
      )
    }

    return newAssignment
  })

  // return the updated catalog object
  return {
    id: assignment.id,
    objectId: objectInfo.objectId,
    objectUuid: objectInfo.objectUuid,
    name: objectInfo.objectName,
    objectType: objectInfo.objectType,
    templateId: objectInfo.templateId,
    access: assignment.access,
    ownerShortname: objectInfo.ownerShortname,
    isOwner: objectInfo.ownerId === ctx.user.sub,
    isManager: true,
    isRequested: false,
    isShared: objectInfo.isShared,
  }
}
// #endregion

// ! Permissions Checking / Access Validation
// #region
const acceptedPermissionLevels: {
  [minimumPermissionLevel: string]: DB.PermissionLevel[]
} = {
  [DB.PermissionLevel.OWNER]: [DB.PermissionLevel.OWNER],
  [DB.PermissionLevel.ADMIN]: [
    DB.PermissionLevel.ADMIN,
    DB.PermissionLevel.OWNER,
  ],
  [DB.PermissionLevel.WRITE]: [
    DB.PermissionLevel.WRITE,
    DB.PermissionLevel.ADMIN,
    DB.PermissionLevel.OWNER,
  ],
  [DB.PermissionLevel.EXECUTE]: [
    DB.PermissionLevel.EXECUTE,
    DB.PermissionLevel.WRITE,
    DB.PermissionLevel.ADMIN,
    DB.PermissionLevel.OWNER,
  ],
  [DB.PermissionLevel.READ]: [
    DB.PermissionLevel.OWNER,
    DB.PermissionLevel.ADMIN,
    DB.PermissionLevel.WRITE,
    DB.PermissionLevel.EXECUTE,
    DB.PermissionLevel.READ,
  ],
}

export type PermissionCheck =
  | {
      catalogCollectionId: string
      minimumPermissionLevel: DB.PermissionLevel
    }
  | {
      answerCollectionId: number
      minimumPermissionLevel: DB.PermissionLevel
    }
  | { elementId: number; minimumPermissionLevel: DB.PermissionLevel }
  | { liveQuizId: string; minimumPermissionLevel: DB.PermissionLevel }
  | { practiceQuizId: string; minimumPermissionLevel: DB.PermissionLevel }
  | { microLearningId: string; minimumPermissionLevel: DB.PermissionLevel }
  | { groupActivityId: string; minimumPermissionLevel: DB.PermissionLevel }
  | { courseId: string; minimumPermissionLevel: DB.PermissionLevel }

export async function checkAccess(
  checks: PermissionCheck[],
  ctx: PrismaTransactionContextWithUser
) {
  for (const check of checks) {
    if (
      'catalogCollectionId' in check &&
      typeof check.catalogCollectionId !== 'undefined'
    ) {
      const permission = await ctx.prisma.derivedPermission.findUnique({
        where: {
          catalogCollectionId_userId: {
            catalogCollectionId: check.catalogCollectionId,
            userId: ctx.user.sub,
          },
          permissionLevel: {
            in: acceptedPermissionLevels[check.minimumPermissionLevel],
          },
        },
      })

      if (!permission) {
        return false
      }
    } else if (
      'answerCollectionId' in check &&
      typeof check.answerCollectionId !== 'undefined'
    ) {
      const permission = await ctx.prisma.derivedPermission.findUnique({
        where: {
          answerCollectionId_userId: {
            answerCollectionId: check.answerCollectionId,
            userId: ctx.user.sub,
          },
          permissionLevel: {
            in: acceptedPermissionLevels[check.minimumPermissionLevel],
          },
        },
      })

      if (!permission) {
        return false
      }
    } else if ('elementId' in check && typeof check.elementId !== 'undefined') {
      const permission = await ctx.prisma.derivedPermission.findUnique({
        where: {
          elementId_userId: {
            elementId: check.elementId,
            userId: ctx.user.sub,
          },
          permissionLevel: {
            in: acceptedPermissionLevels[check.minimumPermissionLevel],
          },
        },
      })

      if (!permission) {
        return false
      }
    } else if (
      'liveQuizId' in check &&
      typeof check.liveQuizId !== 'undefined'
    ) {
      const permission = await ctx.prisma.derivedPermission.findUnique({
        where: {
          liveQuizId_userId: {
            liveQuizId: check.liveQuizId,
            userId: ctx.user.sub,
          },
          permissionLevel: {
            in: acceptedPermissionLevels[check.minimumPermissionLevel],
          },
        },
      })

      if (!permission) {
        return false
      }
    } else if (
      'practiceQuizId' in check &&
      typeof check.practiceQuizId !== 'undefined'
    ) {
      const permission = await ctx.prisma.derivedPermission.findUnique({
        where: {
          practiceQuizId_userId: {
            practiceQuizId: check.practiceQuizId,
            userId: ctx.user.sub,
          },
          permissionLevel: {
            in: acceptedPermissionLevels[check.minimumPermissionLevel],
          },
        },
      })

      if (!permission) {
        return false
      }
    } else if (
      'microLearningId' in check &&
      typeof check.microLearningId !== 'undefined'
    ) {
      const permission = await ctx.prisma.derivedPermission.findUnique({
        where: {
          microLearningId_userId: {
            microLearningId: check.microLearningId,
            userId: ctx.user.sub,
          },
          permissionLevel: {
            in: acceptedPermissionLevels[check.minimumPermissionLevel],
          },
        },
      })

      if (!permission) {
        return false
      }
    } else if (
      'groupActivityId' in check &&
      typeof check.groupActivityId !== 'undefined'
    ) {
      const permission = await ctx.prisma.derivedPermission.findUnique({
        where: {
          groupActivityId_userId: {
            groupActivityId: check.groupActivityId,
            userId: ctx.user.sub,
          },
          permissionLevel: {
            in: acceptedPermissionLevels[check.minimumPermissionLevel],
          },
        },
      })

      if (!permission) {
        return false
      }
    } else if ('courseId' in check && typeof check.courseId !== 'undefined') {
      const coursePermission = await ctx.prisma.derivedPermission.findUnique({
        where: {
          courseId_userId: {
            courseId: check.courseId,
            userId: ctx.user.sub,
          },
          permissionLevel: {
            in: acceptedPermissionLevels[check.minimumPermissionLevel],
          },
        },
      })

      if (!coursePermission) {
        return false
      }
    } else {
      // ? encountered unsupported element type
      return false
    }
  }

  return true
}

export async function checkCatalogAssignment(
  info:
    | {
        answerCollectionId: number
        catalogCollectionId?: string
        access?: DB.ObjectAccess
      }
    | {
        elementId: number
        catalogCollectionId?: string
        access?: DB.ObjectAccess
      }
    | {
        liveQuizId: string
        catalogCollectionId?: string
        access?: DB.ObjectAccess
      }
    | {
        practiceQuizId: string
        catalogCollectionId?: string
        access?: DB.ObjectAccess
      }
    | {
        microLearningId: string
        catalogCollectionId?: string
        access?: DB.ObjectAccess
      }
    | {
        groupActivityId: string
        catalogCollectionId?: string
        access?: DB.ObjectAccess
      }
    | {
        courseId: string
        catalogCollectionId?: string
        access?: DB.ObjectAccess
      },
  ctx: PrismaTransactionContextWithUser
) {
  // verify that the user has access to the catalog collection (if not top-level collection)
  if (
    typeof info.catalogCollectionId !== 'undefined' &&
    info.catalogCollectionId !== MISSING_CATALOG_COLLECTION_ID
  ) {
    // get catalog collection
    const catalogCollection = await ctx.prisma.catalogCollection.findUnique({
      where: {
        id: info.catalogCollectionId,
      },
    })

    // if the catalog collection does not exist, return false
    if (!catalogCollection) {
      return false
    }

    // if the catalog collection has restricted access, verify that a valid permission is given
    if (catalogCollection.access === DB.ObjectAccess.RESTRICTED) {
      const validAccess = await checkAccess(
        [
          {
            catalogCollectionId: info.catalogCollectionId,
            minimumPermissionLevel: DB.PermissionLevel.READ,
          },
        ],
        ctx
      )

      if (!validAccess) {
        return false
      }
    }
  }

  // check if an assignment of the object to the catalog collection exists
  const assignment = await ctx.prisma.catalogCollectionAssignment.findUnique({
    where: {
      access: info.access,
      answerCollectionId_catalogCollectionId:
        'answerCollectionId' in info &&
        typeof info.answerCollectionId !== 'undefined'
          ? {
              answerCollectionId: info.answerCollectionId,
              catalogCollectionId:
                info.catalogCollectionId ?? MISSING_CATALOG_COLLECTION_ID,
            }
          : undefined,
      elementId_catalogCollectionId:
        'elementId' in info && typeof info.elementId !== 'undefined'
          ? {
              elementId: info.elementId,
              catalogCollectionId:
                info.catalogCollectionId ?? MISSING_CATALOG_COLLECTION_ID,
            }
          : undefined,
      liveQuizId_catalogCollectionId:
        'liveQuizId' in info && typeof info.liveQuizId !== 'undefined'
          ? {
              liveQuizId: info.liveQuizId,
              catalogCollectionId:
                info.catalogCollectionId ?? MISSING_CATALOG_COLLECTION_ID,
            }
          : undefined,
      practiceQuizId_catalogCollectionId:
        'practiceQuizId' in info && typeof info.practiceQuizId !== 'undefined'
          ? {
              practiceQuizId: info.practiceQuizId,
              catalogCollectionId:
                info.catalogCollectionId ?? MISSING_CATALOG_COLLECTION_ID,
            }
          : undefined,
      microLearningId_catalogCollectionId:
        'microLearningId' in info && typeof info.microLearningId !== 'undefined'
          ? {
              microLearningId: info.microLearningId,
              catalogCollectionId:
                info.catalogCollectionId ?? MISSING_CATALOG_COLLECTION_ID,
            }
          : undefined,
      groupActivityId_catalogCollectionId:
        'groupActivityId' in info && typeof info.groupActivityId !== 'undefined'
          ? {
              groupActivityId: info.groupActivityId,
              catalogCollectionId:
                info.catalogCollectionId ?? MISSING_CATALOG_COLLECTION_ID,
            }
          : undefined,
      courseId_catalogCollectionId:
        'courseId' in info && typeof info.courseId !== 'undefined'
          ? {
              courseId: info.courseId,
              catalogCollectionId:
                info.catalogCollectionId ?? MISSING_CATALOG_COLLECTION_ID,
            }
          : undefined,
    },
  })

  return assignment !== null
}

export type ObjectSelectorFunction = (
  args: any
) =>
  | { catalogCollectionId: string }
  | { answerCollectionId: number }
  | { elementId: number }
  | { courseId: string }
  | { liveQuizId: string }
  | { practiceQuizId: string }
  | { microLearningId: string }
  | { groupActivityId: string }

// higher-level interface function that returns a wrapped resolver
// (simplified notation for calls in mutation.ts and query.ts)
export function withPermission<TSource, TArgs, TReturn>(
  selector: ObjectSelectorFunction,
  level: DB.PermissionLevel,
  resolver: (
    root: TSource,
    args: TArgs,
    ctx: ContextWithUser
  ) => Promise<TReturn>
) {
  return async (
    root: TSource,
    args: TArgs,
    ctx: ContextWithUser
  ): Promise<TReturn | null> => {
    const access = await checkAccess(
      [{ ...selector(args), minimumPermissionLevel: level }],
      ctx
    )

    if (!access) return null
    return resolver(root, args, ctx)
  }
}
// #endregion

// ! User Group Management
// #region
async function recomputePermissionsUserGroupMember(
  { permissions, userId }: { permissions: DB.Permission[]; userId: string },
  prisma: PrismaTransactionClient
) {
  // trigger a derived permission recomputation for all objects that were shared with this group and this user
  for (const permission of permissions) {
    if (permission.catalogCollectionId !== null) {
      await recomputeDerivedPermissions(
        {
          catalogCollectionId: permission.catalogCollectionId,
          userId,
        },
        prisma
      )
    } else if (permission.answerCollectionId !== null) {
      await recomputeDerivedPermissions(
        {
          answerCollectionId: permission.answerCollectionId,
          userId,
        },
        prisma
      )
    } else if (permission.elementId !== null) {
      await recomputeDerivedPermissions(
        {
          elementId: permission.elementId,
          userId,
        },
        prisma
      )
    } else if (permission.courseId !== null) {
      await recomputeDerivedPermissions(
        {
          courseId: permission.courseId,
          userId,
        },
        prisma
      )
    } else if (permission.liveQuizId !== null) {
      await recomputeDerivedPermissions(
        {
          liveQuizId: permission.liveQuizId,
          userId,
        },
        prisma
      )
    } else if (permission.practiceQuizId !== null) {
      await recomputeDerivedPermissions(
        {
          practiceQuizId: permission.practiceQuizId,
          userId,
        },
        prisma
      )
    } else if (permission.microLearningId !== null) {
      await recomputeDerivedPermissions(
        {
          microLearningId: permission.microLearningId,
          userId,
        },
        prisma
      )
    } else if (permission.groupActivityId !== null) {
      await recomputeDerivedPermissions(
        {
          groupActivityId: permission.groupActivityId,
          userId,
        },
        prisma
      )
    }
  }
}

export async function createUserGroup(
  {
    name,
    members,
  }: {
    name: string
    members: { shortnameOrEmail: string; isAdmin?: boolean | null }[]
  },
  ctx: ContextWithUser
) {
  // check if a user group with this name already exists in the owner's account
  const userGroup = await ctx.prisma.userGroup.findUnique({
    where: {
      ownerId_name: {
        ownerId: ctx.user.sub,
        name,
      },
    },
  })

  if (userGroup) {
    // `User group with name "${name}" already exists for user ${ctx.user.sub}.`
    return null
  }

  // fetch all users that are to be added to the group
  const users = await ctx.prisma.user.findMany({
    where: {
      id: { not: ctx.user.sub }, // owner should not be added to the group as member / admin
      OR: members.flatMap((member) => [
        { shortname: member.shortnameOrEmail },
        { email: member.shortnameOrEmail },
      ]),
    },
  })

  // if none of the specified members were found, throw an error
  if (users.length === 0) {
    // `No users found for the specified members: ${JSON.stringify(members)}`
    return null
  }

  // create an object with all members / admins for the group with their ids as key and the isAdmin boolean as a value
  const { memberIds, adminIds } = users.reduce<{
    memberIds: string[]
    adminIds: string[]
  }>(
    (acc, user) => {
      const isAdmin = members.find(
        (member) =>
          member.shortnameOrEmail === user.shortname ||
          member.shortnameOrEmail === user.email
      )?.isAdmin

      if (isAdmin) {
        acc.adminIds.push(user.id)
      } else {
        acc.memberIds.push(user.id)
      }
      return acc
    },
    {
      memberIds: [],
      adminIds: [],
    }
  )

  const newUserGroup = await ctx.prisma.$transaction(async (prisma) => {
    // create the user group
    const createdUserGroup = await prisma.userGroup.create({
      data: {
        name,
        members: { connect: memberIds.map((id) => ({ id })) },
        admins: { connect: adminIds.map((id) => ({ id })) },
        owner: { connect: { id: ctx.user.sub } },
      },
      include: {
        members: {
          select: { id: true, shortname: true, email: true },
          orderBy: { shortname: 'asc' },
        },
        admins: {
          select: { id: true, shortname: true, email: true },
          orderBy: { shortname: 'asc' },
        },
        owner: {
          select: { id: true, shortname: true, email: true },
        },
      },
    })

    // create an audit log entry
    await prisma.auditLogEntry.create({
      data: {
        type: DB.AuditLogType.USER_GROUP_CREATED,
        objectType: DB.ObjectType.USER_GROUP,
        objectId: String(createdUserGroup.id),
        sourceUserId: ctx.user.sub,
        message: `User group created with members [${createdUserGroup.members.map((member) => member.id).join(',')}] and admins [${createdUserGroup.admins.map((admin) => admin.id).join(',')}].`,
      },
    })

    return createdUserGroup
  })

  return {
    ...newUserGroup,
    owner: {
      ...newUserGroup.owner,
      isSelf: true,
    },
    numOfMembers: newUserGroup.members.length + newUserGroup.admins.length + 1,
    isMember: false,
    isAdmin: false,
    isOwner: true,
  }
}

export async function getUserGroupsUser(ctx: ContextWithUser) {
  const user = await ctx.prisma.user.findUnique({
    where: { id: ctx.user.sub },
    include: {
      // user is MEMBER
      userGroups: {
        include: {
          members: {
            select: { id: true, shortname: true, email: true },
          },
          admins: {
            select: { id: true, shortname: true, email: true },
          },
          owner: {
            select: { id: true, shortname: true, email: true },
          },
        },
      },
      // user is ADMIN
      adminUserGroups: {
        include: {
          members: {
            select: { id: true, shortname: true, email: true },
          },
          admins: {
            select: { id: true, shortname: true, email: true },
          },
          owner: {
            select: { id: true, shortname: true, email: true },
          },
        },
      },
      // user is OWNER
      managedUserGroups: {
        include: {
          members: {
            select: { id: true, shortname: true, email: true },
          },
          admins: {
            select: { id: true, shortname: true, email: true },
          },
          owner: {
            select: { id: true, shortname: true, email: true },
          },
        },
      },
    },
  })

  if (!user) {
    return null
  }

  return [
    ...user.managedUserGroups.map((group) => ({
      ...group,
      owner: {
        ...group.owner,
        isSelf: group.owner.id === ctx.user.sub,
      },
      numOfMembers: group.admins.length + group.members.length + 1,
      isMember: false,
      isAdmin: false,
      isOwner: true,
    })),
    ...user.adminUserGroups.map((group) => ({
      ...group,
      admins: group.admins.map((admin) => ({
        ...admin,
        isSelf: admin.id === ctx.user.sub,
      })),
      numOfMembers: group.admins.length + group.members.length + 1,
      isMember: false,
      isAdmin: true,
      isOwner: false,
    })),
    ...user.userGroups.map((group) => ({
      ...group,
      members: group.members.map((member) => ({
        ...member,
        isSelf: member.id === ctx.user.sub,
      })),
      numOfMembers: group.admins.length + group.members.length + 1,
      isMember: true,
      isAdmin: false,
      isOwner: false,
    })),
  ]
}

export async function leaveUserGroup(
  { groupId }: { groupId: number },
  ctx: ContextWithUser
) {
  // check if the user is a member or admin of the group
  const userGroup = await ctx.prisma.userGroup.findUnique({
    where: { id: groupId },
    include: {
      members: { where: { id: ctx.user.sub } },
      admins: { where: { id: ctx.user.sub } },
    },
  })

  if (
    !userGroup ||
    (userGroup.members.length === 0 && userGroup.admins.length === 0)
  ) {
    return false
  }

  await ctx.prisma.$transaction(
    async (prisma) => {
      const updated = await prisma.userGroup.update({
        where: { id: groupId },
        data: {
          members:
            userGroup.members.length > 0
              ? { disconnect: { id: ctx.user.sub } }
              : undefined,
          admins:
            userGroup.admins.length > 0
              ? { disconnect: { id: ctx.user.sub } }
              : undefined,
        },
        include: {
          permissions: true,
        },
      })

      // create an audit log entry
      await prisma.auditLogEntry.create({
        data: {
          type: DB.AuditLogType.USER_GROUP_USER_REMOVED,
          objectType: DB.ObjectType.USER_GROUP,
          objectId: String(updated.id),
          sourceUserId: ctx.user.sub,
          targetUserId: ctx.user.sub,
          message: `User left user group.`,
        },
      })

      // trigger a derived permission recomputation for all objects that were shared with this group and this user
      await recomputePermissionsUserGroupMember(
        { permissions: updated.permissions, userId: ctx.user.sub },
        prisma
      )

      return updated
    },
    { timeout: 60000 }
  )

  return true
}

export async function deleteUserGroup(
  { groupId }: { groupId: number },
  ctx: ContextWithUser
) {
  // check if the user is the owner of the group
  const userGroup = await ctx.prisma.userGroup.findUnique({
    where: { id: groupId, ownerId: ctx.user.sub },
    include: { permissions: true },
  })

  if (!userGroup) {
    return false
  }

  await ctx.prisma.$transaction(
    async (prisma) => {
      // delete the user group
      await prisma.userGroup.delete({
        where: { id: groupId },
      })

      // create an audit log entry
      await prisma.auditLogEntry.create({
        data: {
          type: DB.AuditLogType.USER_GROUP_DELETED,
          objectType: DB.ObjectType.USER_GROUP,
          objectId: String(userGroup.id),
          sourceUserId: ctx.user.sub,
          message: `User group deleted by owner.`,
        },
      })

      // recompute the permissions for all objects that were shared with this user gruop
      for (const permission of userGroup.permissions) {
        if (permission.catalogCollectionId !== null) {
          await recomputeDerivedPermissions(
            { catalogCollectionId: permission.catalogCollectionId },
            prisma
          )
        } else if (permission.answerCollectionId !== null) {
          await recomputeDerivedPermissions(
            { answerCollectionId: permission.answerCollectionId },
            prisma
          )
        } else if (permission.elementId !== null) {
          await recomputeDerivedPermissions(
            { elementId: permission.elementId },
            prisma
          )
        } else if (permission.courseId !== null) {
          await recomputeDerivedPermissions(
            { courseId: permission.courseId },
            prisma
          )
        } else if (permission.liveQuizId !== null) {
          await recomputeDerivedPermissions(
            { liveQuizId: permission.liveQuizId },
            prisma
          )
        } else if (permission.practiceQuizId !== null) {
          await recomputeDerivedPermissions(
            { practiceQuizId: permission.practiceQuizId },
            prisma
          )
        } else if (permission.microLearningId !== null) {
          await recomputeDerivedPermissions(
            { microLearningId: permission.microLearningId },
            prisma
          )
        } else if (permission.groupActivityId !== null) {
          await recomputeDerivedPermissions(
            { groupActivityId: permission.groupActivityId },
            prisma
          )
        }
      }
    },
    { timeout: 60000 }
  )

  return true
}

export async function promoteGroupMemberToAdmin(
  { groupId, memberId }: { groupId: number; memberId: string },
  ctx: ContextWithUser
) {
  const group = await ctx.prisma.userGroup.findUnique({
    where: { id: groupId },
    include: {
      members: { where: { id: memberId } },
      admins: { where: { id: ctx.user.sub } },
    },
  })

  // if the group does not exist, the requesting user has insufficient permissions or the member does not exist, return early
  if (
    !group ||
    group.members.length === 0 ||
    (group.admins.length === 0 && group.ownerId !== ctx.user.sub)
  ) {
    return false
  }

  await ctx.prisma.$transaction(async (prisma) => {
    // disconnect the member from the members and add them to the admins
    await prisma.userGroup.update({
      where: { id: groupId },
      data: {
        members: { disconnect: { id: memberId } },
        admins: { connect: { id: memberId } },
      },
    })

    // create an audit log entry
    await prisma.auditLogEntry.create({
      data: {
        type: DB.AuditLogType.USER_GROUP_USER_MODIFIED,
        objectType: DB.ObjectType.USER_GROUP,
        objectId: String(group.id),
        sourceUserId: ctx.user.sub,
        targetUserId: memberId,
        message: `User promoted from member to admin.`,
      },
    })
  })

  return true
}

export async function demoteGroupAdminToMember(
  { groupId, adminId }: { groupId: number; adminId: string },
  ctx: ContextWithUser
) {
  const group = await ctx.prisma.userGroup.findUnique({
    where: { id: groupId },
    include: {
      admins: true,
    },
  })

  // if the group does not exist, the requesting user has insufficient permissions or the member does not exist, return early
  const adminUserIds = group?.admins.map((admin) => admin.id) ?? []
  if (
    !group ||
    !adminUserIds.includes(adminId) ||
    (!adminUserIds.includes(ctx.user.sub) && group.ownerId !== ctx.user.sub)
  ) {
    return false
  }

  await ctx.prisma.$transaction(async (prisma) => {
    // disconnect the admin from the admins and add them to the members
    await prisma.userGroup.update({
      where: { id: groupId },
      data: {
        admins: { disconnect: { id: adminId } },
        members: { connect: { id: adminId } },
      },
    })

    // create an audit log entry
    await prisma.auditLogEntry.create({
      data: {
        type: DB.AuditLogType.USER_GROUP_USER_MODIFIED,
        objectType: DB.ObjectType.USER_GROUP,
        objectId: String(group.id),
        sourceUserId: ctx.user.sub,
        targetUserId: adminId,
        message: `User demoted from admin to member.`,
      },
    })
  })

  return true
}

export async function removeUserFromGroup(
  { groupId, userId }: { groupId: number; userId: string },
  ctx: ContextWithUser
) {
  // if the user that should be removed is the acting user, return early
  if (userId === ctx.user.sub) {
    return false
  }

  const group = await ctx.prisma.userGroup.findUnique({
    where: { id: groupId },
    include: {
      members: { where: { id: userId } },
      admins: true,
    },
  })

  // if the group does not exist, the requesting user has insufficient permissions or the member does not exist, return early
  const adminUserIds = group?.admins.map((admin) => admin.id) ?? []
  const userIsAdmin = adminUserIds.includes(userId)
  const userIsMember = (group?.members.length ?? -1) > 0
  if (
    !group ||
    (group.members.length === 0 && !adminUserIds.includes(userId)) ||
    (!adminUserIds.includes(ctx.user.sub) && group.ownerId !== ctx.user.sub) ||
    (userIsAdmin && userIsMember) // user should not be admin and member at the same time
  ) {
    return false
  }

  await ctx.prisma.$transaction(
    async (prisma) => {
      // disconnect the member from the members and admins
      const updatedUserGroup = await prisma.userGroup.update({
        where: { id: groupId },
        data: {
          admins: userIsAdmin ? { disconnect: { id: userId } } : undefined,
          members: userIsMember ? { disconnect: { id: userId } } : undefined,
        },
        include: {
          permissions: true,
        },
      })

      // create an audit log entry
      await prisma.auditLogEntry.create({
        data: {
          type: DB.AuditLogType.USER_GROUP_USER_REMOVED,
          objectType: DB.ObjectType.USER_GROUP,
          objectId: String(updatedUserGroup.id),
          sourceUserId: ctx.user.sub,
          targetUserId: userId,
          message: `User removed from group.`,
        },
      })

      // trigger a derived permission recomputation for all objects that were shared with this group and this user
      await recomputePermissionsUserGroupMember(
        { permissions: updatedUserGroup.permissions, userId },
        prisma
      )
    },
    { timeout: 60000 }
  )

  return true
}

export async function changeUserGroupName(
  { id, name }: { id: number; name: string },
  ctx: ContextWithUser
) {
  // check if the user is owner or admin of the group
  const userGroup = await ctx.prisma.userGroup.findUnique({
    where: { id },
    include: {
      admins: { where: { id: ctx.user.sub } },
    },
  })

  if (
    !userGroup ||
    (userGroup.admins.length === 0 && userGroup.ownerId !== ctx.user.sub)
  ) {
    return false
  }

  // update the name of the group
  await ctx.prisma.userGroup.update({
    where: { id },
    data: { name },
  })

  // create an audit log entry
  await ctx.prisma.auditLogEntry.create({
    data: {
      type: DB.AuditLogType.USER_GROUP_MODIFIED,
      objectType: DB.ObjectType.USER_GROUP,
      objectId: String(userGroup.id),
      sourceUserId: ctx.user.sub,
      message: `User group name changed to ${name}.`,
    },
  })

  return true
}

export async function transferGroupOwnership(
  { id, newOwnerId }: { id: number; newOwnerId: string },
  ctx: ContextWithUser
) {
  const userGroup = await ctx.prisma.userGroup.findUnique({
    where: { id },
    include: {
      admins: { where: { id: newOwnerId } },
    },
  })

  // check if the requesting user is the current owner of the group and if the new owner exists as an admin on the group
  if (
    !userGroup ||
    userGroup.ownerId !== ctx.user.sub ||
    userGroup.admins.length === 0
  ) {
    return false
  }

  await ctx.prisma.$transaction(async (prisma) => {
    // check if the owner already has an user group with the same name -> potential issues with uniqueness
    let groupName = userGroup.name
    let counter = 0
    let valid = false
    do {
      const existingGroup = await prisma.userGroup.findUnique({
        where: {
          ownerId_name: {
            ownerId: newOwnerId,
            name: groupName,
          },
        },
      })

      if (existingGroup) {
        counter += 1
        groupName = `${userGroup.name} (${counter})`
      } else {
        valid = true
      }
    } while (valid === false && counter < 100)

    // if there was still no valid name found, return null (more than 100 copies of an answer collection with the same name are not realistic -> rate limit)
    if (!valid) {
      throw new Error(
        `Could not find a valid name for the new answer collection.`
      )
    }

    // update the user group
    await prisma.userGroup.update({
      where: { id },
      data: {
        name: groupName,
        owner: { connect: { id: newOwnerId } },
        admins: {
          connect: { id: ctx.user.sub },
          disconnect: { id: newOwnerId },
        },
      },
    })

    // create an audit log entry
    await prisma.auditLogEntry.create({
      data: {
        type: DB.AuditLogType.USER_GROUP_MODIFIED,
        objectType: DB.ObjectType.USER_GROUP,
        objectId: String(userGroup.id),
        sourceUserId: ctx.user.sub,
        targetUserId: newOwnerId,
        message: `User group ownership transferred to group admin.`,
      },
    })
  })

  return true
}

export async function addUserToUserGroup(
  {
    groupId,
    shortnameOrEmail,
    asAdmin = false,
  }: { groupId: number; shortnameOrEmail: string; asAdmin?: boolean | null },
  ctx: ContextWithUser
) {
  // fetch the user that should be added and make sure it exists
  const user = await ctx.prisma.user.findFirst({
    where: {
      OR: [{ shortname: shortnameOrEmail }, { email: shortnameOrEmail }],
    },
  })

  if (!user) {
    return null
  }

  const userGroup = await ctx.prisma.userGroup.findUnique({
    where: { id: groupId },
    include: {
      members: true,
      admins: true,
    },
  })

  // check that the requesting user is an admin or owner
  const adminUserIds = userGroup?.admins.map((admin) => admin.id) ?? []
  if (
    !userGroup ||
    (!adminUserIds.includes(ctx.user.sub) && userGroup.ownerId !== ctx.user.sub)
  ) {
    return null
  }

  // check if the user that should be added is already a member or admin of the group, or if user doesn't exist
  const userId = user.id
  const memberUserIds = userGroup.members.map((member) => member.id)
  if (memberUserIds.includes(userId) || adminUserIds.includes(userId)) {
    return null
  }

  await ctx.prisma.$transaction(
    async (prisma) => {
      // add the user to the group
      const updatedUserGroup = await prisma.userGroup.update({
        where: { id: groupId },
        data: {
          members: !asAdmin ? { connect: { id: userId } } : undefined,
          admins: asAdmin ? { connect: { id: userId } } : undefined,
        },
        include: {
          permissions: true,
        },
      })

      // create an audit log entry
      await prisma.auditLogEntry.create({
        data: {
          type: DB.AuditLogType.USER_GROUP_USER_ADDED,
          objectType: DB.ObjectType.USER_GROUP,
          objectId: String(updatedUserGroup.id),
          sourceUserId: ctx.user.sub,
          targetUserId: userId,
          message: `New user added to group as ${asAdmin ? 'admin' : 'member'}.`,
        },
      })

      // recompute all permissions for the newly added user for objects shared with the group
      await recomputePermissionsUserGroupMember(
        { permissions: updatedUserGroup.permissions, userId },
        prisma
      )
    },
    { timeout: 60000 }
  )

  return {
    id: user.id,
    shortname: user.shortname,
    email: user.email,
    isSelf: false,
  }
}
// #endregion

// ! Activity Entries
// #region
export async function addActivityMessage(
  {
    objectId,
    objectType,
    message,
  }: { objectId: string; objectType: DB.ObjectType; message: string },
  ctx: ContextWithUser
) {
  const newActivityEntry = await ctx.prisma.activityLogEntry.create({
    data: {
      type: DB.ActivityLogType.MESSAGE,
      message,
      objectType,
      answerCollectionId:
        objectType === DB.ObjectType.ANSWER_COLLECTION
          ? parseInt(objectId)
          : undefined,
      elementId:
        objectType === DB.ObjectType.ELEMENT ? parseInt(objectId) : undefined,
      courseId: objectType === DB.ObjectType.COURSE ? objectId : undefined,
      liveQuizId: objectType === DB.ObjectType.LIVE_QUIZ ? objectId : undefined,
      practiceQuizId:
        objectType === DB.ObjectType.PRACTICE_QUIZ ? objectId : undefined,
      microLearningId:
        objectType === DB.ObjectType.MICRO_LEARNING ? objectId : undefined,
      groupActivityId:
        objectType === DB.ObjectType.GROUP_ACTIVITY ? objectId : undefined,
      userId: ctx.user.sub,
    },
    include: { user: { select: { shortname: true } } },
  })

  return {
    ...newActivityEntry,
    username: newActivityEntry.user!.shortname,
    isOwn: true, // created message has to be the user's own message
    isEdited: false, // flag to signal if an object has been edited
    options: {},
  }
}

export async function deleteActivityMessage(
  { messageId }: { messageId: number },
  ctx: ContextWithUser
) {
  // fetch the activity message
  const activityMessage = await ctx.prisma.activityLogEntry.findUnique({
    where: { id: messageId },
  })

  // check if the message exists and if it belongs to the user
  if (!activityMessage || activityMessage.userId !== ctx.user.sub) {
    return false
  }

  // delete the message
  await ctx.prisma.activityLogEntry.delete({
    where: { id: messageId, userId: ctx.user.sub },
  })

  return true
}

export async function getObjectActivity(
  { objectId, objectType }: { objectId: string; objectType: DB.ObjectType },
  ctx: ContextWithUser
) {
  // query the ActivityLogEntry table with the appropriate filter
  const activityLog = await ctx.prisma.activityLogEntry.findMany({
    where: {
      elementId:
        objectType === DB.ObjectType.ELEMENT
          ? parseInt(objectId, 10)
          : undefined,
      answerCollectionId:
        objectType === DB.ObjectType.ANSWER_COLLECTION
          ? parseInt(objectId, 10)
          : undefined,
      courseId:
        objectType === DB.ObjectType.COURSE ? String(objectId) : undefined,
      liveQuizId:
        objectType === DB.ObjectType.LIVE_QUIZ ? String(objectId) : undefined,
      practiceQuizId:
        objectType === DB.ObjectType.PRACTICE_QUIZ
          ? String(objectId)
          : undefined,
      microLearningId:
        objectType === DB.ObjectType.MICRO_LEARNING
          ? String(objectId)
          : undefined,
      groupActivityId:
        objectType === DB.ObjectType.GROUP_ACTIVITY
          ? String(objectId)
          : undefined,
    },
    include: { user: { select: { shortname: true } } },
    orderBy: { createdAt: 'asc' },
  })

  return activityLog.map((entry) => ({
    ...entry,
    message: entry.message,
    options: {
      field: entry.modificationDetails
        ?.field as ActivityLogModificationFieldType,
      oldValue: entry.modificationDetails?.oldValue,
      newValue: entry.modificationDetails?.newValue,
    },
    username: entry.user?.shortname ?? '',
    isOwn: entry.userId === ctx.user.sub,
    isEdited: entry.updatedAt.getTime() > entry.createdAt.getTime(),
  }))
}
// #endregion
