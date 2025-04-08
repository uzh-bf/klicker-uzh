import * as DB from '@klicker-uzh/prisma'
import {
  ActivityType,
  CatalogObject,
  CatalogObjectType,
  ObjectSharingRequest,
} from '@klicker-uzh/types'
import type { ContextWithUser } from '../lib/context.js'
import { recomputeDerivedPermissions } from './permissions.js'
import { validateAnswerCollectionPermissions } from './resources.js'
import { validateActivityPermissions } from './templates.js'

// ! do not modify - required for the import of objects not assigned to any catalogue
export const MISSING_CATALOG_COLLECTION_ID =
  'fde06b3c-d515-4907-99cf-c2ba67583155'

// ! Helper functions
// #region

// helper function to check for a specific access level on the catalog collection
async function validateCatalogCollectionPermissions(
  {
    catalogCollectionId,
    acceptedPermissionLevels,
  }: {
    catalogCollectionId: string
    acceptedPermissionLevels: DB.PermissionLevel[]
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

  const catalogCollection = await ctx.prisma.catalogCollection.findUnique({
    where: {
      id: catalogCollectionId,
    },
    include: {
      permissions: {
        where: {
          userId: ctx.user.sub,
          permissionLevel: {
            in: [...acceptedPermissionLevels, DB.PermissionLevel.OWNER],
          },
        },
      },
    },
  })

  if (!catalogCollection) {
    return { valid: false, catalogCollection: null }
  }

  const validAccess = catalogCollection.permissions.length > 0
  return { valid: validAccess, catalogCollection }
}

// verify that a user has access to a specific catalog collection (= can browse its content)
// this is fullfiled if the the catalog collection is either public or the user has been granted access
async function verifyCatalogCollectionBrowsable(
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
        acceptedPermissionLevels: [
          DB.PermissionLevel.READ,
          DB.PermissionLevel.WRITE,
          DB.PermissionLevel.ADMIN,
        ],
      },
      ctx
    )

  return (
    catalogCollection &&
    (valid || catalogCollection.access === DB.ObjectAccess.PUBLIC)
  )
}

// function that verifies that a user has sufficient permissions to edit an object in the catalog
// - for items in the default collection, the permissions on the object are checked
// - for items in a catalog collection, the permissions on the catalog collection are checked
async function verifyCatalogObjectEditPermissions(
  { assignmentId }: { assignmentId: number },
  ctx: ContextWithUser
) {
  // fetch current assignment
  const assignment = await ctx.prisma.catalogCollectionAssignment.findUnique({
    where: {
      id: assignmentId,
    },
    include: {
      answerCollection: {
        select: {
          id: true,
        },
      },
      liveQuiz: {
        select: {
          id: true,
        },
      },
      // ... add more object types once they are supported for sharing
    },
  })

  if (!assignment) {
    return false
  }

  // boolean to check for sufficient permissions
  let sufficientPermissions = false

  // ! Case 1: Object in Catalog Collection -> access level on catalog collection decides permissions
  // write permissions are required for content management of catalog collection
  if (assignment.catalogCollectionId !== MISSING_CATALOG_COLLECTION_ID) {
    const { valid } = await validateCatalogCollectionPermissions(
      {
        catalogCollectionId: assignment.catalogCollectionId,
        acceptedPermissionLevels: [
          DB.PermissionLevel.WRITE,
          DB.PermissionLevel.ADMIN,
        ],
      },
      ctx
    )
    sufficientPermissions = valid
  }
  // ! Case 2: Object in top-level collection -> access level on object decides permissions
  else {
    if (typeof assignment.answerCollection?.id !== 'undefined') {
      // verify that the user has access to the answer collection
      const { valid } = await validateAnswerCollectionPermissions(
        {
          collectionId: assignment.answerCollection.id,
          acceptedPermissionLevels: [DB.PermissionLevel.ADMIN],
        },
        ctx
      )
      sufficientPermissions = valid
    } else if (typeof assignment.liveQuiz?.id !== 'undefined') {
      // verify that the user has access to the live quiz / live quiz template
      const { valid } = await validateActivityPermissions(
        {
          activityId: assignment.liveQuiz.id,
          activityType: ActivityType.LIVE_QUIZ,
          acceptedPermissionLevels: [DB.PermissionLevel.ADMIN],
        },
        ctx
      )
      sufficientPermissions = valid
    }
    // ... add more object types once they are supported for sharing
  }

  return sufficientPermissions
}

// #endregion

// ! Catalog Collection Operations
// #region
export async function createCatalogCollection(
  {
    name,
    access,
  }: {
    name: string
    access: DB.ObjectAccess
  },
  ctx: ContextWithUser
) {
  const collection = await ctx.prisma.catalogCollection.create({
    data: {
      name,
      access,
      owner: {
        connect: {
          id: ctx.user.sub,
        },
      },
    },
    include: {
      owner: {
        select: {
          shortname: true,
        },
      },
    },
  })

  // trigger recomputation of derived permissions
  await recomputeDerivedPermissions(
    {
      catalogCollectionId: collection.id,
      userId: ctx.user.sub,
    },
    ctx.prisma
  )

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
  const isShared = collection.permissions.length > 0
  const isManager = collection.permissions.some(
    (permission) =>
      permission.permissionLevel === DB.PermissionLevel.ADMIN ||
      permission.permissionLevel === DB.PermissionLevel.OWNER
  )
  const isEditor = collection.permissions.some(
    (permission) =>
      permission.permissionLevel === DB.PermissionLevel.WRITE ||
      permission.permissionLevel === DB.PermissionLevel.ADMIN ||
      permission.permissionLevel === DB.PermissionLevel.OWNER
  )

  return {
    ...collection,
    ownerShortname: collection.owner?.shortname,
    isOwner: collection.ownerId === ctx.user.sub,
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
  }: {
    catalogCollectionId: string
    access: DB.ObjectAccess
  },
  ctx: ContextWithUser
) {
  // verify that user has sufficient access (ADMIN or OWNER) to change the catalog collection access level
  const { valid } = await validateCatalogCollectionPermissions(
    {
      catalogCollectionId,
      acceptedPermissionLevels: [DB.PermissionLevel.ADMIN],
    },
    ctx
  )

  if (!valid) {
    return false
  }

  // update the access level of the catalog collection
  const updatedCollection = await ctx.prisma.catalogCollection.update({
    where: {
      id: catalogCollectionId,
    },
    data: {
      access,
    },
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

export async function changeCatalogCollectionName(
  { catalogCollectionId, name }: { catalogCollectionId: string; name: string },
  ctx: ContextWithUser
) {
  // verify that user has sufficient access (at least WRITE) to change the catalog collection access level
  const { valid } = await validateCatalogCollectionPermissions(
    {
      catalogCollectionId,
      acceptedPermissionLevels: [
        DB.PermissionLevel.WRITE,
        DB.PermissionLevel.ADMIN,
      ],
    },
    ctx
  )

  if (!valid) {
    return false
  }

  // update the access level of the catalog collection
  const updatedCollection = await ctx.prisma.catalogCollection.update({
    where: {
      id: catalogCollectionId,
    },
    data: {
      name,
    },
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
  const sufficientPermissions = await verifyCatalogObjectEditPermissions(
    { assignmentId },
    ctx
  )
  if (!sufficientPermissions) {
    return false
  }

  // change the access level of the assignment
  const updatedAssignment = await ctx.prisma.catalogCollectionAssignment.update(
    {
      where: {
        id: assignmentId,
      },
      data: {
        access,
      },
    }
  )

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
    where: {
      id: {
        not: MISSING_CATALOG_COLLECTION_ID,
      },
    },
    include: {
      _count: {
        select: {
          objectAssignments: true,
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
      owner: {
        select: {
          shortname: true,
        },
      },
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
      const isShared = collection.permissions.length > 0
      const isManager = collection.permissions.some(
        (permission) =>
          permission.permissionLevel === DB.PermissionLevel.ADMIN ||
          permission.permissionLevel === DB.PermissionLevel.OWNER
      )
      const isEditor = collection.permissions.some(
        (permission) =>
          permission.permissionLevel === DB.PermissionLevel.WRITE ||
          permission.permissionLevel === DB.PermissionLevel.ADMIN ||
          permission.permissionLevel === DB.PermissionLevel.OWNER
      )

      return {
        ...collection,
        ownerShortname: collection.owner?.shortname,
        isOwner: collection.ownerId === ctx.user.sub,
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
      ownerId: {
        not: ctx.user.sub,
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
      owner: {
        select: {
          shortname: true,
        },
      },
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

  // TODO: upsert audit log entry (wrapped into transaction with access request upsert)

  // upsert access requests for all owners and admins
  const ownerAdminIds = adminOwnerPermissions.map(
    (permission) => permission.userId
  )
  await Promise.all(
    ownerAdminIds.map(async (adminOwnerId) => {
      await ctx.prisma.accessRequest.upsert({
        where: {
          catalogCollectionId_userId_objectAdminOrOwnerId: {
            catalogCollectionId,
            userId: ctx.user.sub,
            objectAdminOrOwnerId: adminOwnerId,
          },
        },
        create: {
          permissionLevel: requestedPermissionLevel ?? DB.PermissionLevel.READ,
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
          permissionLevel: requestedPermissionLevel ?? DB.PermissionLevel.READ,
        },
      })
    })
  )

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
  {
    catalogCollectionId,
  }: {
    catalogCollectionId: string
  },
  ctx: ContextWithUser
) {
  // verify that the user has sufficient permissions (ADMIN or OWNER) to delete the catalog collection
  const { valid } = await validateCatalogCollectionPermissions(
    {
      catalogCollectionId,
      acceptedPermissionLevels: [DB.PermissionLevel.ADMIN],
    },
    ctx
  )

  if (!valid) {
    return null
  }

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
    where: {
      id: ctx.user.sub,
    },
    include: {
      pendingRequests: true,
    },
  })

  if (!user) {
    return 0
  }

  return user.pendingRequests.length
}

export async function getCatalogSharingRequests(ctx: ContextWithUser) {
  const user = await ctx.prisma.user.findUnique({
    where: {
      id: ctx.user.sub,
    },
    include: {
      pendingRequests: {
        include: {
          user: {
            select: {
              shortname: true,
              email: true,
            },
          },
          catalogCollection: {
            select: {
              name: true,
            },
          },
          answerCollection: {
            select: {
              name: true,
            },
          },
          element: {
            select: {
              name: true,
            },
          },
          course: {
            select: {
              name: true,
            },
          },
          liveQuiz: {
            select: {
              name: true,
            },
          },
          practiceQuiz: {
            select: {
              name: true,
            },
          },
          microLearning: {
            select: {
              name: true,
            },
          },
          groupActivity: {
            select: {
              name: true,
            },
          },
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
        permissionId: request.id,
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
          objectType: CatalogObjectType.CATALOG_COLLECTION,
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
          objectType: CatalogObjectType.ANSWER_COLLECTION,
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
        ownerId: {
          not: null,
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

  // TODO: upsert audit log entry (wrapped into transaction with access request upsert)

  // upsert access requests for all owners and admins
  const ownerAdminIds = adminOwnerPermissions.map(
    (permission) => permission.userId
  )
  await Promise.all(
    ownerAdminIds.map(async (adminOwnerId) => {
      await ctx.prisma.accessRequest.upsert({
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
          permissionLevel: requestedPermissionLevel ?? DB.PermissionLevel.READ,
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
          permissionLevel: requestedPermissionLevel ?? DB.PermissionLevel.READ,
        },
      })
    })
  )

  // invalidate cache for the imported object
  if (typeof answerCollectionId !== 'undefined') {
    ctx.emitter.emit('invalidate', {
      typename: 'AnswerCollection',
      id: answerCollectionId,
    })
  }
  // TODO: ... add more object types once they are supported for

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

  // remove the access request
  await ctx.prisma.accessRequest.deleteMany({
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

  await ctx.prisma.$transaction(async (prisma) => {
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

    // trigger recomputation of derived permissions within the same transaction
    if (pendingRequest.catalogCollectionId !== null) {
      await recomputeDerivedPermissions(
        {
          userId,
          catalogCollectionId: pendingRequest.catalogCollectionId,
        },
        prisma
      )
    } else if (pendingRequest.answerCollectionId !== null) {
      await recomputeDerivedPermissions(
        {
          userId,
          answerCollectionId: pendingRequest.answerCollectionId,
        },
        prisma
      )
    } else if (pendingRequest.elementId !== null) {
      await recomputeDerivedPermissions(
        {
          userId,
          elementId: pendingRequest.elementId,
        },
        prisma
      )
    } else if (pendingRequest.courseId !== null) {
      await recomputeDerivedPermissions(
        {
          userId,
          courseId: pendingRequest.courseId,
        },
        prisma
      )
    } else if (pendingRequest.liveQuizId !== null) {
      await recomputeDerivedPermissions(
        {
          userId,
          liveQuizId: pendingRequest.liveQuizId,
        },
        prisma
      )
    } else if (pendingRequest.practiceQuizId !== null) {
      await recomputeDerivedPermissions(
        {
          userId,
          practiceQuizId: pendingRequest.practiceQuizId,
        },
        prisma
      )
    } else if (pendingRequest.microLearningId !== null) {
      await recomputeDerivedPermissions(
        {
          userId,
          microLearningId: pendingRequest.microLearningId,
        },
        prisma
      )
    } else if (pendingRequest.groupActivityId !== null) {
      await recomputeDerivedPermissions(
        {
          userId,
          groupActivityId: pendingRequest.groupActivityId,
        },
        prisma
      )
    }
  })

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
export async function changeCatalogCollectionPermissionLevel(
  {
    catalogCollectionId,
    permissionId,
    permissionLevel,
  }: {
    catalogCollectionId: string
    permissionId: number
    permissionLevel: DB.PermissionLevel
  },
  ctx: ContextWithUser
) {
  // verify that the requesting user has sufficient permissions to modify access level (ADMIN or OWNER)
  const { valid } = await validateCatalogCollectionPermissions(
    {
      catalogCollectionId,
      acceptedPermissionLevels: [DB.PermissionLevel.ADMIN],
    },
    ctx
  )

  if (!valid) {
    return false
  }

  // update the access level of the permission
  const permission = await ctx.prisma.permission.update({
    where: {
      id: permissionId,
      catalogCollectionId,
    },
    data: {
      permissionLevel,
    },
  })

  // TODO: trigger recomputation of derived permissions for the object (in transaction with update above)

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

export async function changeCatalogObjectPermissionLevel(
  {
    permissionId,
    permissionLevel,
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
  // verify that the user has sufficient permissions on the object in question
  if (typeof answerCollectionId !== 'undefined') {
    const { valid } = await validateAnswerCollectionPermissions(
      {
        collectionId: answerCollectionId,
        acceptedPermissionLevels: [DB.PermissionLevel.ADMIN],
      },
      ctx
    )

    if (!valid) {
      return false
    }
  }
  // TODO: ... add more object types once they are supported for sharing
  else {
    return false
  }

  // update the access level of the permission
  const permission = await ctx.prisma.permission.update({
    where: {
      id: permissionId,
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
    },
  })

  // if the permission did not exist in the first place, return null
  if (!permission) {
    return false
  }

  // TODO: trigger recomputation of derived permissions for the object

  // invalidate permission
  ctx.emitter.emit('invalidate', {
    typename: 'Permission',
    id: permission.id,
  })

  return true
}

export async function revokeCatalogCollectionAccess(
  {
    permissionId,
    catalogCollectionId,
  }: { permissionId: number; catalogCollectionId: string },
  ctx: ContextWithUser
) {
  // verify that the requesting user has sufficient permissions to revoke access (ADMIN or OWNER)
  const { valid } = await validateCatalogCollectionPermissions(
    {
      catalogCollectionId,
      acceptedPermissionLevels: [DB.PermissionLevel.ADMIN],
    },
    ctx
  )

  if (!valid) {
    return null
  }

  // verify that the direct permission belongs to the specified catalog collection
  const permission = await ctx.prisma.permission.findUnique({
    where: {
      id: permissionId,
      catalogCollectionId,
    },
    include: {
      user: {
        select: {
          id: true,
        },
      },
    },
  })

  if (!permission) {
    return null
  }

  const deletedPermission = await ctx.prisma.$transaction(async (prisma) => {
    // delete the direct permission
    const deleted = await prisma.permission.delete({
      where: {
        id: permissionId,
      },
    })

    // trigger recomputation of derived permissions
    await recomputeDerivedPermissions(
      {
        catalogCollectionId,
        userId: permission.userId ?? undefined,
        userGroupId: permission.userGroupId ?? undefined,
      },
      prisma
    )

    return deleted
  })

  // invalidate permission
  ctx.emitter.emit('invalidate', {
    typename: 'Permission',
    id: deletedPermission.id,
  })

  return deletedPermission.id
}

export async function revokeAnswerCollectionAccess(
  {
    permissionId,
    collectionId,
  }: { permissionId: number; collectionId: number },
  ctx: ContextWithUser
) {
  // verify that the direct permission belongs to the specified collection
  const permission = await ctx.prisma.permission.findUnique({
    where: {
      id: permissionId,
      answerCollectionId: collectionId,
    },
    include: {
      user: {
        select: {
          id: true,
        },
      },
    },
  })

  if (!permission || permission.id !== permissionId) {
    return null
  }

  // TODO: access control should be handled separately on level above
  // verify that the requesting user has sufficient permissions to revoke access (ADMIN or OWNER)
  const collection = await ctx.prisma.answerCollection.findUnique({
    where: {
      id: collectionId,
      permissions: {
        some: {
          userId: ctx.user.sub,
          permissionLevel: {
            in: [DB.PermissionLevel.ADMIN, DB.PermissionLevel.OWNER],
          },
        },
      },
    },
  })

  if (!collection) {
    return null
  }

  // delete the direct permission
  const deletedPermission = await ctx.prisma.permission.delete({
    where: {
      id: permissionId,
    },
  })

  // TODO: trigger recomputation of derived permissions for the object (in transaction with deletion)

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
export async function getCatalogCollectionPermissions(
  { catalogCollectionId }: { catalogCollectionId: string },
  ctx: ContextWithUser
) {
  // TODO: move access control with where and some permission checking to outside of this function (if possible)
  // verify that sufficient permissions are given (ADMIN / OWNER for sharing) and load linked permissions
  const catalogCollection = await ctx.prisma.catalogCollection.findUnique({
    where: {
      id: catalogCollectionId,
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
      directPermissions: {
        include: {
          user: {
            select: {
              id: true,
              shortname: true,
              email: true,
            },
          },
          // TODO: also include permissions awarded to user groups and set in return object
        },
      },
    },
  })

  if (!catalogCollection) {
    return []
  }

  return catalogCollection.directPermissions
    .map((permission) => ({
      permissionId: permission.id,
      userId: permission.user?.id,
      username: permission.user?.shortname,
      userEmail: permission.user?.email,
      userGroupId: undefined,
      userGroupName: undefined,
      permissionLevel: permission.permissionLevel,
      isOwn: permission.userId === ctx.user.sub,
    }))
    .sort((a, b) => {
      if (a.username === b.username) {
        return (a.userGroupName ?? '').localeCompare(b.userGroupName ?? '')
      }
      return (a.username ?? '').localeCompare(b.username ?? '')
    })
}

export async function transferCatalogCollectionOwnership(
  {
    catalogCollectionId,
    shortnameOrEmail,
  }: {
    catalogCollectionId: string
    shortnameOrEmail: string
  },
  ctx: ContextWithUser
) {
  // verify that the specified user exists
  const newOwner = await ctx.prisma.user.findFirst({
    where: {
      OR: [
        {
          shortname: shortnameOrEmail,
        },
        {
          email: shortnameOrEmail,
        },
      ],
    },
    include: {
      directlySharedObjects: {
        where: {
          catalogCollectionId,
        },
      },
    },
  })

  if (!newOwner) {
    return null
  }

  // verify that the current user has ownership of the collection
  const collection = await ctx.prisma.catalogCollection.findUnique({
    where: {
      id: catalogCollectionId,
      ownerId: ctx.user.sub,
    },
  })

  if (!collection) {
    return null
  }

  // update the owner of the collection and grant admin permissions to the current user
  const updatedCollection = await ctx.prisma.catalogCollection.update({
    where: {
      id: catalogCollectionId,
    },
    data: {
      owner: {
        connect: {
          id: newOwner.id,
        },
      },
      directPermissions: {
        upsert: {
          where: {
            catalogCollectionId_userId: {
              catalogCollectionId,
              userId: ctx.user.sub,
            },
          },
          create: {
            permissionLevel: DB.PermissionLevel.ADMIN,
            user: {
              connect: {
                id: ctx.user.sub,
              },
            },
          },
          update: {
            permissionLevel: DB.PermissionLevel.ADMIN,
          },
        },
      },
    },
    include: {
      directPermissions: {
        where: {
          userId: ctx.user.sub,
        },
        include: {
          user: {
            select: {
              id: true,
              shortname: true,
              email: true,
            },
          },
        },
      },
    },
  })

  // if the new owner previously had a permission on the collection, delete it
  if (newOwner.directlySharedObjects.length > 0) {
    await ctx.prisma.permission.delete({
      where: {
        catalogCollectionId_userId: {
          catalogCollectionId,
          userId: newOwner.id,
        },
      },
    })
  }

  // TODO: trigger recomputation of derived permissions for the object (and wrap deletion and upsert in transaction together with this update)

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

export async function shareCatalogCollection(
  {
    catalogCollectionId,
    permissionLevel,
    shortnameOrEmail,
    userGroupId,
  }: {
    catalogCollectionId: string
    permissionLevel: DB.PermissionLevel
    shortnameOrEmail?: string | null
    userGroupId?: number | null
  },
  ctx: ContextWithUser
) {
  // TODO: move access validation out of the function itself (to pothos, if possible)
  // verify that the requesting user has sufficient permissions to share object (ADMIN or OWNER)
  const { valid, catalogCollection } =
    await validateCatalogCollectionPermissions(
      {
        catalogCollectionId,
        acceptedPermissionLevels: [DB.PermissionLevel.ADMIN],
      },
      ctx
    )

  if (!valid) {
    return null
  }

  // create new permission with the defined access level
  if (shortnameOrEmail && shortnameOrEmail.length > 0) {
    // check if a user with the provided username or email exists and is not the owner of the catalog collection
    const user = await ctx.prisma.user.findFirst({
      where: {
        OR: [
          {
            shortname: shortnameOrEmail,
          },
          {
            email: shortnameOrEmail,
          },
        ],
      },
      select: {
        id: true,
        shortname: true,
        email: true,
      },
    })

    const userId = user?.id
    if (!userId || catalogCollection?.ownerId === userId) {
      return null
    }

    const permission = await ctx.prisma.$transaction(async (prisma) => {
      // upsert new permission for the catalog collection
      const newPermission = await prisma.permission.upsert({
        where: {
          catalogCollectionId_userId: {
            catalogCollectionId,
            userId,
          },
        },
        create: {
          permissionLevel,
          catalogCollection: {
            connect: {
              id: catalogCollectionId,
            },
          },
          user: {
            connect: {
              id: userId,
            },
          },
        },
        update: {
          permissionLevel,
        },
      })

      // trigger recomputation of derived permissions within the same transaction
      await recomputeDerivedPermissions(
        {
          catalogCollectionId,
          userId,
        },
        prisma
      )

      return newPermission
    })

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
      isOwn: false,
    }
  } else if (userGroupId) {
    // TODO: implement sharing with user groups
  } else {
    return null
  }
}

export async function getAnswerCollectionPermissions(
  { collectionId }: { collectionId: number },
  ctx: ContextWithUser
) {
  // verify that the requesting user has sufficient permissions to view the permissions (sharing for ADMIN or OWNER)
  const collection = await ctx.prisma.answerCollection.findUnique({
    where: {
      id: collectionId,
      // TODO: move access check out of this mutation (to pothos level, if possible)
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
      directPermissions: {
        include: {
          user: {
            select: {
              id: true,
              shortname: true,
              email: true,
            },
          },
          // TODO: also include permissions awarded to user groups and set in return object
        },
      },
    },
  })

  if (!collection) {
    return []
  }

  return collection.directPermissions
    .map((permission) => ({
      permissionId: permission.id,
      userId: permission.user?.id,
      username: permission.user?.shortname,
      userEmail: permission.user?.email,
      userGroupId: undefined,
      userGroupName: undefined,
      permissionLevel: permission.permissionLevel,
      isOwn: permission.user?.id === ctx.user.sub,
    }))
    .sort((a, b) => {
      if (a.username === b.username) {
        return (a.userGroupName ?? '').localeCompare(b.userGroupName ?? '')
      }
      return (a.username ?? '').localeCompare(b.username ?? '')
    })
}

export async function transferAnswerCollectionOwnership(
  {
    collectionId,
    shortnameOrEmail,
  }: {
    collectionId: number
    shortnameOrEmail: string
  },
  ctx: ContextWithUser
) {
  // verify that the specified user exists
  const newOwner = await ctx.prisma.user.findFirst({
    where: {
      OR: [
        {
          shortname: shortnameOrEmail,
        },
        {
          email: shortnameOrEmail,
        },
      ],
    },
    include: {
      directlySharedObjects: {
        where: {
          answerCollectionId: collectionId,
        },
      },
    },
  })

  if (!newOwner) {
    return null
  }

  // verify that the current user has ownership of the collection
  const collection = await ctx.prisma.answerCollection.findUnique({
    where: {
      id: collectionId,
      ownerId: ctx.user.sub,
    },
  })

  if (!collection) {
    return null
  }

  // update the owner of the collection and grant admin permissions to the current user
  const updatedCollection = await ctx.prisma.answerCollection.update({
    where: {
      id: collectionId,
    },
    data: {
      owner: {
        connect: {
          id: newOwner.id,
        },
      },
      directPermissions: {
        upsert: {
          where: {
            answerCollectionId_userId: {
              answerCollectionId: collectionId,
              userId: ctx.user.sub,
            },
          },
          create: {
            permissionLevel: DB.PermissionLevel.ADMIN,
            user: {
              connect: {
                id: ctx.user.sub,
              },
            },
          },
          update: {
            permissionLevel: DB.PermissionLevel.ADMIN,
          },
        },
      },
    },
    include: {
      directPermissions: {
        where: {
          userId: ctx.user.sub,
        },
        include: {
          user: {
            select: {
              id: true,
              shortname: true,
              email: true,
            },
          },
        },
      },
    },
  })

  // if the new owner previously had a permission on the collection, delete it
  if (newOwner.directlySharedObjects.length > 0) {
    await ctx.prisma.permission.delete({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: collectionId,
          userId: newOwner.id,
        },
      },
    })
  }

  // TODO: trigger recomputation of derived permissions for the object (and wrap deletion and upsert in transaction together with this update)

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

export async function shareCatalogObject(
  {
    permissionLevel,
    shortnameOrEmail,
    userGroupId,
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
  // verify that user has either owner or admin access (sufficient permissions for sharing)
  let objectOwner: string | undefined | null = null

  if (typeof answerCollectionId !== 'undefined') {
    const { valid, collection } = await validateAnswerCollectionPermissions(
      {
        collectionId: answerCollectionId,
        acceptedPermissionLevels: [DB.PermissionLevel.ADMIN],
      },
      ctx
    )

    objectOwner = collection?.ownerId
    if (!valid) {
      return null
    }
  }

  // create new permission with the defined access level
  if (shortnameOrEmail && shortnameOrEmail.length > 0) {
    // check if a user with the provided username or email exists and is not the owner of the collection
    const user = await ctx.prisma.user.findFirst({
      where: {
        OR: [
          {
            shortname: shortnameOrEmail,
          },
          {
            email: shortnameOrEmail,
          },
        ],
      },
      select: {
        id: true,
        shortname: true,
        email: true,
      },
    })

    const userId = user?.id
    if (!userId || objectOwner === userId) {
      return null
    }

    // upsert new permission for the answer collection under consideration
    const permission = await ctx.prisma.permission.upsert({
      where: {
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
        user: {
          connect: {
            id: userId,
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
        permissionLevel,
      },
    })

    // TODO: trigger recomputation of derived permissions for the object (in transaction with upsert above)

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
      isOwn: false,
    }
  } else if (userGroupId) {
    // TODO: implement sharing with user groups
  } else {
    return null
  }
}
// #endregion

// ! Import Functionalities (Public Resources)
// #region
export async function importAnswerCollection(
  {
    collectionId,
    catalogCollectionId,
  }: { collectionId: number; catalogCollectionId?: string | null },
  ctx: ContextWithUser
) {
  // TODO: move access control to pothos level (if possible)
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

  // create new answer collection with the content of the original one
  await ctx.prisma.answerCollection.create({
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

  // TODO: trigger recomputation of derived permissions for the object (in transaction with creation)

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
  // fetch answer collection and verify that the user has access to it
  const collection = await ctx.prisma.answerCollection.findUnique({
    where: {
      id: collectionId,
    },
    include: {
      permissions: {
        where: {
          userId: ctx.user.sub,
        },
      },
      entries: true,
      owner: {
        select: {
          shortname: true,
        },
      },
    },
  })

  // check if the user has access to the collection
  if (!collection || collection.permissions.length === 0) {
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
            where: {
              ownerId: {
                not: null,
              },
            },
            select: {
              id: true,
              name: true,
              ownerId: true,
              owner: {
                select: {
                  shortname: true,
                },
              },
              directPermissions: {
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
          },
          liveQuiz: {
            select: {
              id: true,
              name: true,
              status: true,
              ownerId: true,
              owner: {
                select: {
                  shortname: true,
                },
              },
              directPermissions: {
                where: {
                  userId: ctx.user.sub,
                },
              },
              accessRequests: {
                where: {
                  userId: ctx.user.sub,
                },
              },
              templateInfo: {
                select: {
                  id: true,
                },
              },
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
        const permission = answerCollection.directPermissions[0]

        return {
          id: answerCollection.id,
          name: answerCollection.name,
          assignmentId: assignment.id,
          objectType: CatalogObjectType.ANSWER_COLLECTION,
          access: assignment.access,
          ownerShortname: answerCollection.owner?.shortname,
          isOwner: answerCollection.ownerId === ctx.user.sub,
          isManager:
            permission?.permissionLevel === DB.PermissionLevel.ADMIN ||
            permission?.permissionLevel === DB.PermissionLevel.OWNER,
          isRequested: answerCollection.accessRequests.length > 0,
          isShared: typeof permission !== 'undefined',
        }
      } else if (assignment.liveQuiz) {
        const liveQuiz = assignment.liveQuiz
        const permission = liveQuiz.directPermissions[0]

        return {
          uuid: liveQuiz.id,
          name: liveQuiz.name,
          assignmentId: assignment.id,
          templateId: liveQuiz.templateInfo?.id,
          objectType:
            // TODO: replace or type with normal live quiz catalog object type
            liveQuiz.status === DB.PublicationStatus.TEMPLATE
              ? CatalogObjectType.LIVE_QUIZ_TEMPLATE
              : CatalogObjectType.LIVE_QUIZ_TEMPLATE,
          access: assignment.access,
          ownerShortname: liveQuiz.owner?.shortname,
          isOwner: liveQuiz.ownerId === ctx.user.sub,
          isManager:
            permission?.permissionLevel === DB.PermissionLevel.ADMIN ||
            permission?.permissionLevel === DB.PermissionLevel.OWNER,
          isRequested: liveQuiz.accessRequests.length > 0,
          isShared: typeof permission !== 'undefined',
        }
      }

      return []
    }) ?? []

  return mappedCatalogObjects
}

export async function removeCatalogObjectAssignment(
  { assignmentId }: { assignmentId: number },
  ctx: ContextWithUser
) {
  const sufficientPermissions = await verifyCatalogObjectEditPermissions(
    { assignmentId },
    ctx
  )

  if (!sufficientPermissions) {
    return false
  }

  // change the access level of the assignment
  const updatedAssignment = await ctx.prisma.catalogCollectionAssignment.delete(
    { where: { id: assignmentId } }
  )

  return (
    updatedAssignment.id !== null && typeof updatedAssignment.id !== 'undefined'
  )
}

export async function getCatalogAnswerCollections(ctx: ContextWithUser) {
  // fetch all answer collections, where the user is the owner or has been granted admin access
  const collections = await ctx.prisma.answerCollection.findMany({
    where: {
      ownerId: {
        not: null, // soft deleted answer collections cannot be added to the catalog
      },
      permissions: {
        some: {
          userId: ctx.user.sub,
          permissionLevel: {
            in: [DB.PermissionLevel.ADMIN, DB.PermissionLevel.OWNER],
          },
        },
      },
    },
    orderBy: {
      name: 'asc',
    },
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
    orderBy: {
      name: 'asc',
    },
  })

  return liveQuizzes.map((liveQuiz) => ({
    id: liveQuiz.id,
    name: liveQuiz.name,
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
  // verify that the user has sufficient permissions on the catalog collection to add objects (if collection is defined)
  if (catalogCollectionId) {
    const { valid } = await validateCatalogCollectionPermissions(
      {
        catalogCollectionId,
        acceptedPermissionLevels: [
          DB.PermissionLevel.WRITE,
          DB.PermissionLevel.ADMIN,
        ],
      },
      ctx
    )

    if (!valid) {
      return null
    }
  }

  // collect shared object information in corresponding object
  let objectInfo: {
    objectId?: number
    objectUuid?: string
    objectType: CatalogObjectType
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
        owner: {
          select: {
            shortname: true,
          },
        },
        _count: {
          select: { permissions: { where: { userId: ctx.user.sub } } },
        },
      },
    })

    if (!answerCollection) {
      return null
    }

    // set object info
    objectInfo = {
      objectId: answerCollection.id,
      objectUuid: undefined,
      objectType: CatalogObjectType.ANSWER_COLLECTION,
      objectName: answerCollection.name,
      ownerShortname: answerCollection.owner?.shortname,
      ownerId: answerCollection.ownerId,
      isShared: answerCollection._count.permissions > 0,
    }
  } else if (typeof liveQuizId !== 'undefined') {
    const liveQuiz = await ctx.prisma.liveQuiz.findUnique({
      where: {
        id: liveQuizId,
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
        owner: {
          select: {
            shortname: true,
          },
        },
        templateInfo: {
          select: {
            id: true,
          },
        },
        _count: {
          select: { permissions: { where: { userId: ctx.user.sub } } },
        },
      },
    })

    if (!liveQuiz) {
      return null
    }

    // set object info
    objectInfo = {
      objectId: undefined,
      objectUuid: liveQuiz.id,
      objectType:
        liveQuiz.status === DB.PublicationStatus.TEMPLATE
          ? CatalogObjectType.LIVE_QUIZ_TEMPLATE
          : CatalogObjectType.LIVE_QUIZ_TEMPLATE, // TODO: replace with LIVE_QUIZ
      objectName: liveQuiz.name,
      ownerShortname: liveQuiz.owner?.shortname,
      ownerId: liveQuiz.ownerId,
      templateId: liveQuiz.templateInfo?.id,
      isShared: liveQuiz._count.permissions > 0,
    }
  }
  // TODO: ... implement more supported object types
  else {
    return null
  }

  // if the object info was not set, return null
  if (typeof objectInfo === 'undefined' || objectInfo === null) {
    return null
  }

  // upsert the assignemnt of the answer collection to the catalog collection
  const assignment = await ctx.prisma.catalogCollectionAssignment.upsert({
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

  // return the updated catalog object
  return {
    id: objectInfo.objectId,
    uuid: objectInfo.objectUuid,
    name: objectInfo.objectName,
    objectType: objectInfo.objectType,
    assignmentId: assignment.id,
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
