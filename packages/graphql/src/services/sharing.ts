import * as DB from '@klicker-uzh/prisma'
import {
  CatalogObject,
  CatalogObjectType,
  ObjectSharingRequest,
} from '@klicker-uzh/types'
import type { ContextWithUser } from '../lib/context.js'
import { validateAnswerCollectionPermissions } from './resources.js'

// ! do not modify - required for the import of objects not assigned to any catalogue
const MISSING_CATALOG_COLLECTION_ID = 'fde06b3c-d515-4907-99cf-c2ba67583155'

// ! Helper functions
// #region

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
  const catalogCollection = await ctx.prisma.catalogCollection.findUnique({
    where: {
      id: catalogCollectionId,
    },
    include: {
      permissions: {
        where: {
          userId: ctx.user.sub,
          permissionStatus: DB.PermissionStatus.GRANTED,
          permissionLevel: {
            in: acceptedPermissionLevels,
          },
        },
        // TODO: handle user groups
      },
    },
  })

  if (!catalogCollection) {
    return { valid: false, catalogCollection: null }
  }

  const validAccess =
    catalogCollection.permissions.length > 0 ||
    catalogCollection.ownerId === ctx.user.sub

  return { valid: validAccess, catalogCollection }
}

// function that verifies that a user has sufficient permissions to edit an object in the catalog
// - for items in the default collection, the permissions on the object are checked
// - for items in a catalog collection, the permissions on the catalog collection are checked
async function verifyCatalogItemEditPermissions(
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
    },
  })

  if (!collection) {
    return null
  }

  const isRequested = collection.permissions.some(
    (permission) =>
      permission.permissionStatus === DB.PermissionStatus.REQUESTED
  )
  const isShared = collection.permissions.some(
    (permission) => permission.permissionStatus === DB.PermissionStatus.GRANTED
  )
  const isManager =
    collection.ownerId === ctx.user.sub ||
    collection.permissions.some(
      (permission) =>
        permission.permissionLevel === DB.PermissionLevel.ADMIN &&
        permission.permissionStatus === DB.PermissionStatus.GRANTED
    )
  const isEditor =
    collection.permissions.some(
      (permission) =>
        (permission.permissionLevel === DB.PermissionLevel.WRITE ||
          permission.permissionLevel === DB.PermissionLevel.ADMIN) &&
        permission.permissionStatus === DB.PermissionStatus.GRANTED
    ) || collection.ownerId === ctx.user.sub

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
        DB.PermissionLevel.ADMIN,
        DB.PermissionLevel.WRITE,
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
  const sufficientPermissions = await verifyCatalogItemEditPermissions(
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

  return !!updatedAssignment.id
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
        !(
          collection.ownerId !== ctx.user.sub &&
          collection.access === DB.ObjectAccess.PUBLIC &&
          collection._count.objectAssignments === 0 &&
          collection.permissions.length === 0
        )
    )
    .map((collection) => {
      const isRequested = collection.permissions.some(
        (permission) =>
          permission.permissionStatus === DB.PermissionStatus.REQUESTED
      )
      const isShared = collection.permissions.some(
        (permission) =>
          permission.permissionStatus === DB.PermissionStatus.GRANTED
      )
      const isManager =
        collection.ownerId === ctx.user.sub ||
        collection.permissions.some(
          (permission) =>
            permission.permissionLevel === DB.PermissionLevel.ADMIN &&
            permission.permissionStatus === DB.PermissionStatus.GRANTED
        )
      const isEditor =
        collection.permissions.some(
          (permission) =>
            (permission.permissionLevel === DB.PermissionLevel.WRITE ||
              permission.permissionLevel === DB.PermissionLevel.ADMIN) &&
            permission.permissionStatus === DB.PermissionStatus.GRANTED
        ) || collection.ownerId === ctx.user.sub

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
  { catalogCollectionId }: { catalogCollectionId: string },
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
        },
      },
      owner: {
        select: {
          shortname: true,
        },
      },
    },
  })

  // check if granted / requested permission already exist
  if (
    !catalogCollection ||
    catalogCollection.permissions.length > 0 ||
    !catalogCollection.ownerId
  ) {
    return null
  }

  // create a new permission request
  await ctx.prisma.permission.create({
    data: {
      permissionLevel: DB.PermissionLevel.READ,
      permissionStatus: DB.PermissionStatus.REQUESTED,
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
      objectOwner: {
        connect: {
          id: catalogCollection.ownerId,
        },
      },
    },
    include: {
      objectOwner: {
        select: {
          shortname: true,
        },
      },
    },
  })

  // TODO: notify owner of the collection by e-mail that there is a new access request

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
  // verify that the user has sufficient access to delete the catalog collection
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
      objectPermissions: {
        where: {
          permissionStatus: DB.PermissionStatus.REQUESTED,
        },
      },
    },
  })

  if (!user) {
    return 0
  }

  return user.objectPermissions.length
}

export async function getCatalogSharingRequests(ctx: ContextWithUser) {
  const user = await ctx.prisma.user.findUnique({
    where: {
      id: ctx.user.sub,
    },
    include: {
      objectPermissions: {
        where: {
          permissionStatus: DB.PermissionStatus.REQUESTED,
          OR: [
            {
              catalogCollectionId: {
                not: null,
              },
            },
            {
              answerCollectionId: {
                not: null,
              },
            },
          ],
        },
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
        },
      },
    },
  })

  if (!user) {
    return null
  }

  const sharingRequests = user.objectPermissions.reduce<ObjectSharingRequest[]>(
    (acc, request) => {
      // sharing request for catalog collection
      if (
        typeof request.catalogCollection !== 'undefined' &&
        request.catalogCollection !== null &&
        request.user
      ) {
        acc.push({
          permissionId: request.id,
          objectName: request.catalogCollection.name,
          objectType: CatalogObjectType.CATALOG_COLLECTION,
          userId: request.userId!,
          userShortname: request.user.shortname,
          userEmail: request.user.email,
        })
      }

      // sharing request for answer collection
      else if (
        typeof request.answerCollection !== 'undefined' &&
        request.answerCollection !== null &&
        request.user
      ) {
        acc.push({
          permissionId: request.id,
          objectName: request.answerCollection.name,
          objectType: CatalogObjectType.ANSWER_COLLECTION,
          userId: request.userId!,
          userShortname: request.user.shortname,
          userEmail: request.user.email,
        })
      }

      return acc
    },
    []
  )

  return sharingRequests
}

export async function requestAnswerCollection(
  {
    collectionId,
    catalogCollectionId,
  }: { collectionId: number; catalogCollectionId?: string | null },
  ctx: ContextWithUser
) {
  // fetch the answer collection including potential pending permission requests
  const collection = await ctx.prisma.answerCollection.findUnique({
    where: {
      id: collectionId,
      ownerId: {
        not: null,
      },
    },
    include: {
      permissions: {
        where: {
          userId: ctx.user.sub,
        },
      },
    },
  })

  // check if granted / requested permission already exist and if there is still an owner that can grant access
  if (
    !collection ||
    collection.ownerId === null ||
    collection.permissions.length > 0
  ) {
    return null
  }

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
    return null
  }

  // get catalog assignment of this answer collection
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

  // create a new permission request
  const permissionRequest = await ctx.prisma.permission.create({
    data: {
      permissionLevel: DB.PermissionLevel.READ,
      permissionStatus: DB.PermissionStatus.REQUESTED,
      answerCollection: {
        connect: {
          id: collectionId,
        },
      },
      user: {
        connect: {
          id: ctx.user.sub,
        },
      },
      objectOwner: {
        connect: {
          id: collection.ownerId,
        },
      },
    },
    include: {
      answerCollection: true,
      objectOwner: {
        select: {
          shortname: true,
        },
      },
    },
  })

  // TODO: notify owner of the collection by e-mail that there is a new access request

  // invalidate cache for the imported collection
  const updatedCollection = permissionRequest.answerCollection
  ctx.emitter.emit('invalidate', {
    typename: 'AnswerCollection',
    id: updatedCollection?.id,
  })

  // return updated catalog object
  return updatedCollection
    ? {
        id: updatedCollection.id,
        name: updatedCollection.name,
        objectType: CatalogObjectType.ANSWER_COLLECTION,
        assignmentId: assignment.id,
        access: assignment.access,
        ownerShortname: permissionRequest.objectOwner?.shortname,
        isOwner: false,
        isManager: false,
        isRequested: true,
        isShared: false,
      }
    : null
}

export async function cancelAnswerCollectionRequest(
  {
    collectionId,
  }: {
    collectionId: number
  },
  ctx: ContextWithUser
) {
  // verify that the user has requested access to the collection
  const permission = await ctx.prisma.permission.findUnique({
    where: {
      answerCollectionId_userId: {
        answerCollectionId: collectionId,
        userId: ctx.user.sub,
      },
      permissionStatus: DB.PermissionStatus.REQUESTED,
    },
  })

  if (!permission) {
    return false
  }

  // remove the access request
  const deletedPermission = await ctx.prisma.permission.delete({
    where: {
      id: permission.id,
    },
  })

  ctx.emitter.emit('invalidate', {
    typename: 'Permission',
    id: deletedPermission.id,
  })

  return true
}

export async function resolveObjectSharingRequest(
  {
    permissionId,
    userId,
    permissionLevel,
    approved,
  }: {
    permissionId: number
    userId: string
    permissionLevel?: DB.PermissionLevel
    approved: boolean
  },
  ctx: ContextWithUser
) {
  // check that the access request exists and that the user is the owner of the collection
  const accessRequest = await ctx.prisma.permission.findUnique({
    where: {
      id: permissionId,
      userId,
      permissionLevel: DB.PermissionLevel.READ, // access requests are always assigned read access level
      permissionStatus: DB.PermissionStatus.REQUESTED,
      objectOwnerId: ctx.user.sub,
    },
  })

  if (!accessRequest) {
    return false
  }

  // update the collection with the new access rights
  if (approved) {
    await ctx.prisma.permission.update({
      where: {
        id: accessRequest.id,
      },
      data: {
        permissionStatus: DB.PermissionStatus.GRANTED,
        permissionLevel,
      },
    })
  } else {
    await ctx.prisma.permission.delete({
      where: {
        id: accessRequest.id,
      },
    })
  }

  // TODO: send email to user that requested access about the approval / (and denial?)

  // invalidate the corresponding permission
  ctx.emitter.emit('invalidate', {
    typename: 'Permission',
    id: permissionId,
  })

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
    return null
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
    include: {
      user: {
        select: {
          id: true,
          shortname: true,
          email: true,
        },
      },
    },
  })

  // if the permission did not exist in the first place, return null
  if (!permission) {
    return null
  }

  // invalidate permission
  ctx.emitter.emit('invalidate', {
    typename: 'Permission',
    id: permission.id,
  })

  return {
    permissionId: permission.id,
    userId: permission.user?.id,
    username: permission.user?.shortname,
    userEmail: permission.user?.email,
    userGroupId: undefined,
    userGroupName: undefined,
    permissionLevel: permission.permissionLevel,
  }
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

  // verify that the permission belongs to the specified catalog collection
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

  if (!permission || permission.id !== permissionId) {
    return null
  }

  // delete the permission
  const deletedPermission = await ctx.prisma.permission.delete({
    where: {
      id: permissionId,
    },
  })

  // invalidate permission
  ctx.emitter.emit('invalidate', {
    typename: 'Permission',
    id: deletedPermission.id,
  })

  return deletedPermission.id
}

export async function changeAnswerCollectionPermissionLevel(
  {
    collectionId,
    permissionId,
    permissionLevel,
  }: {
    collectionId: number
    permissionId: number
    permissionLevel: DB.PermissionLevel
  },
  ctx: ContextWithUser
) {
  // verify that user has either owner or admin access
  const { valid } = await validateAnswerCollectionPermissions(
    {
      collectionId,
      acceptedPermissionLevels: [DB.PermissionLevel.ADMIN],
    },
    ctx
  )

  if (!valid) {
    return null
  }

  // update the access level of the permission
  const permission = await ctx.prisma.permission.update({
    where: {
      id: permissionId,
      answerCollectionId: collectionId,
    },
    data: {
      permissionLevel,
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
  })

  // if the permission did not exist in the first place, return null
  if (!permission) {
    return null
  }

  // invalidate permission
  ctx.emitter.emit('invalidate', {
    typename: 'Permission',
    id: permission.id,
  })

  return {
    permissionId: permission.id,
    userId: permission.user?.id,
    username: permission.user?.shortname,
    userEmail: permission.user?.email,
    userGroupId: undefined,
    userGroupName: undefined,
    permissionLevel: permission.permissionLevel,
  }
}

export async function revokeAnswerCollectionAccess(
  {
    permissionId,
    collectionId,
  }: { permissionId: number; collectionId: number },
  ctx: ContextWithUser
) {
  // verify that the permission belongs to the specified collection
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

  // verify that the requesting user has sufficient permissions to revoke access (ADMIN or OWNER)
  const collection = await ctx.prisma.answerCollection.findUnique({
    where: {
      id: collectionId,
      OR: [
        {
          ownerId: ctx.user.sub,
        },
        {
          permissions: {
            some: {
              userId: ctx.user.sub,
              permissionStatus: DB.PermissionStatus.GRANTED,
              permissionLevel: DB.PermissionLevel.ADMIN,
            },
          },
        },
      ],
    },
    include: {
      // TODO: the access should also not be revokable if the collection is used in a shared element
      linkedElements: {
        where: {
          ownerId: permission.user?.id,
        },
      },
    },
  })

  if (!collection) {
    return null
  }

  // verify that the collection is not used (access cannot be removed in these cases)
  if (collection.linkedElements.length > 0) {
    return null
  }

  // delete the permission
  const deletedPermission = await ctx.prisma.permission.delete({
    where: {
      id: permissionId,
    },
  })

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
  const catalogCollection = await ctx.prisma.catalogCollection.findUnique({
    where: {
      id: catalogCollectionId,
      OR: [
        {
          ownerId: ctx.user.sub,
        },
        {
          permissions: {
            some: {
              userId: ctx.user.sub,
              permissionStatus: DB.PermissionStatus.GRANTED,
              permissionLevel: DB.PermissionLevel.ADMIN,
            },
          },
        },
      ],
    },
    include: {
      permissions: {
        where: {
          permissionStatus: DB.PermissionStatus.GRANTED,
        },
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

  // TODO: once permissions from user groups are included, deduplicate and use highest available permission level
  return catalogCollection.permissions
    .map((permission) => ({
      permissionId: permission.id,
      userId: permission.user?.id,
      username: permission.user?.shortname,
      userEmail: permission.user?.email,
      userGroupId: undefined,
      userGroupName: undefined,
      permissionLevel: permission.permissionLevel,
      isRevokable: true,
      isOwn: permission.user?.id === ctx.user.sub,
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
    usernameOrEmail,
  }: {
    catalogCollectionId: string
    usernameOrEmail: string
  },
  ctx: ContextWithUser
) {
  // verify that the specified user exists
  const newOwner = await ctx.prisma.user.findFirst({
    where: {
      OR: [
        {
          shortname: usernameOrEmail,
        },
        {
          email: usernameOrEmail,
        },
      ],
    },
    include: {
      sharedObjects: {
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
      permissions: {
        upsert: {
          where: {
            catalogCollectionId_userId: {
              catalogCollectionId,
              userId: ctx.user.sub,
            },
          },
          create: {
            permissionLevel: DB.PermissionLevel.ADMIN,
            permissionStatus: DB.PermissionStatus.GRANTED,
            user: {
              connect: {
                id: ctx.user.sub,
              },
            },
            objectOwner: {
              connect: {
                id: newOwner.id,
              },
            },
          },
          update: {
            permissionLevel: DB.PermissionLevel.ADMIN,
            permissionStatus: DB.PermissionStatus.GRANTED,
          },
        },
      },
    },
    include: {
      permissions: {
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
  if (newOwner.sharedObjects.length > 0) {
    await ctx.prisma.permission.delete({
      where: {
        catalogCollectionId_userId: {
          catalogCollectionId,
          userId: newOwner.id,
        },
      },
    })
  }

  // return info for new admin permission and corresponding cache update
  const permission = updatedCollection.permissions[0]
  return permission && permission.user
    ? {
        permissionId: permission.id,
        userId: permission.user.id,
        username: permission.user.shortname,
        userEmail: permission.user.email,
        userGroupId: undefined,
        userGroupName: undefined,
        permissionLevel: permission.permissionLevel,
        isRevokable: true,
        isOwn: true,
      }
    : null
}

export async function shareCatalogCollection(
  {
    catalogCollectionId,
    permissionLevel,
    usernameOrEmail,
    userGroupId,
  }: {
    catalogCollectionId: string
    permissionLevel: DB.PermissionLevel
    usernameOrEmail?: string | null
    userGroupId?: number | null
  },
  ctx: ContextWithUser
) {
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
  if (usernameOrEmail && usernameOrEmail.length > 0) {
    // check if a user with the provided username or email exists and is not the owner of the catalog collection
    const user = await ctx.prisma.user.findFirst({
      where: {
        OR: [
          {
            shortname: usernameOrEmail,
          },
          {
            email: usernameOrEmail,
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

    // upsert new permission for the answer collection under consideration
    const permission = await ctx.prisma.permission.upsert({
      where: {
        catalogCollectionId_userId: {
          catalogCollectionId,
          userId,
        },
      },
      create: {
        permissionLevel,
        permissionStatus: DB.PermissionStatus.GRANTED,
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
        objectOwner: {
          connect: {
            id: ctx.user.sub,
          },
        },
      },
      update: {
        permissionLevel,
        permissionStatus: DB.PermissionStatus.GRANTED,
      },
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
      isRevokable: true,
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
  const collection = await ctx.prisma.answerCollection.findUnique({
    where: {
      id: collectionId,
      OR: [
        {
          ownerId: ctx.user.sub,
        },
        {
          permissions: {
            some: {
              userId: ctx.user.sub,
              permissionStatus: DB.PermissionStatus.GRANTED,
              permissionLevel: DB.PermissionLevel.ADMIN,
            },
          },
        },
      ],
    },
    include: {
      permissions: {
        where: {
          permissionStatus: DB.PermissionStatus.GRANTED,
        },
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
      linkedElements: {
        include: {
          permissions: {
            where: {
              permissionStatus: DB.PermissionStatus.GRANTED,
            },
            include: {
              user: {
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

  if (!collection) {
    return []
  }

  // aggregate which users have permissions / are the owner of at least one linked element
  const usersWithUsage = collection.linkedElements.reduce<{
    [userId: string]: boolean
  }>((acc, element) => {
    // owner of the element
    if (element.ownerId) {
      acc[element.ownerId] = true
    }

    // users with whom the element is shared
    element.permissions.forEach((permission) => {
      if (permission.user?.id) {
        acc[permission.user.id] = true
      }
    })

    return acc
  }, {})

  // TODO: once permissions from user groups are included, deduplicate and use highest available permission level
  return collection.permissions
    .map((permission) => ({
      permissionId: permission.id,
      userId: permission.user?.id,
      username: permission.user?.shortname,
      userEmail: permission.user?.email,
      userGroupId: undefined,
      userGroupName: undefined,
      permissionLevel: permission.permissionLevel,
      isRevokable: !usersWithUsage[permission.user?.id ?? ''],
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
    usernameOrEmail,
  }: {
    collectionId: number
    usernameOrEmail: string
  },
  ctx: ContextWithUser
) {
  // verify that the specified user exists
  const newOwner = await ctx.prisma.user.findFirst({
    where: {
      OR: [
        {
          shortname: usernameOrEmail,
        },
        {
          email: usernameOrEmail,
        },
      ],
    },
    include: {
      sharedObjects: {
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
      permissions: {
        upsert: {
          where: {
            answerCollectionId_userId: {
              answerCollectionId: collectionId,
              userId: ctx.user.sub,
            },
          },
          create: {
            permissionLevel: DB.PermissionLevel.ADMIN,
            permissionStatus: DB.PermissionStatus.GRANTED,
            user: {
              connect: {
                id: ctx.user.sub,
              },
            },
            objectOwner: {
              connect: {
                id: newOwner.id,
              },
            },
          },
          update: {
            permissionLevel: DB.PermissionLevel.ADMIN,
            permissionStatus: DB.PermissionStatus.GRANTED,
          },
        },
      },
    },
    include: {
      permissions: {
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
  if (newOwner.sharedObjects.length > 0) {
    await ctx.prisma.permission.delete({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: collectionId,
          userId: newOwner.id,
        },
      },
    })
  }

  // return info for new admin permission and corresponding cache update
  const permission = updatedCollection.permissions[0]
  return permission && permission.user
    ? {
        permissionId: permission.id,
        userId: permission.user.id,
        username: permission.user.shortname,
        userEmail: permission.user.email,
        userGroupId: undefined,
        userGroupName: undefined,
        permissionLevel: permission.permissionLevel,
        isRevokable: true,
        isOwn: true,
      }
    : null
}

export async function shareAnswerCollection(
  {
    collectionId,
    permissionLevel,
    usernameOrEmail,
    userGroupId,
  }: {
    collectionId: number
    permissionLevel: DB.PermissionLevel
    usernameOrEmail?: string | null
    userGroupId?: number | null
  },
  ctx: ContextWithUser
) {
  // verify that user has either owner or admin access
  const { valid, collection } = await validateAnswerCollectionPermissions(
    {
      collectionId,
      acceptedPermissionLevels: [DB.PermissionLevel.ADMIN],
    },
    ctx
  )

  if (!valid) {
    return null
  }

  // create new permission with the defined access level
  if (usernameOrEmail && usernameOrEmail.length > 0) {
    // check if a user with the provided username or email exists and is not the owner of the collection
    const user = await ctx.prisma.user.findFirst({
      where: {
        OR: [
          {
            shortname: usernameOrEmail,
          },
          {
            email: usernameOrEmail,
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
    if (!userId || collection?.ownerId === userId) {
      return null
    }

    // upsert new permission for the answer collection under consideration
    const permission = await ctx.prisma.permission.upsert({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: collectionId,
          userId,
        },
      },
      create: {
        permissionLevel,
        permissionStatus: DB.PermissionStatus.GRANTED,
        answerCollection: {
          connect: {
            id: collectionId,
          },
        },
        user: {
          connect: {
            id: userId,
          },
        },
        objectOwner: {
          connect: {
            id: ctx.user.sub,
          },
        },
      },
      update: {
        permissionLevel,
        permissionStatus: DB.PermissionStatus.GRANTED,
      },
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
      isRevokable: true,
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
  // get answer collection
  const collection = await ctx.prisma.answerCollection.findUnique({
    where: {
      id: collectionId,
    },
    include: {
      entries: true,
    },
  })

  if (!collection || collection.ownerId === null) {
    return false
  }

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
  })

  if (!assignment || assignment.access !== DB.ObjectAccess.PUBLIC) {
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
  // function to retrieve information on a single answer collection that is available in the catalog (no private collections)
  // fetch the answer collection
  const collection = await ctx.prisma.answerCollection.findUnique({
    where: {
      id: collectionId,
    },
    include: {
      permissions: {
        where: {
          userId: ctx.user.sub,
          permissionStatus: DB.PermissionStatus.GRANTED,
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

  if (!collection) {
    return null
  }

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
              permissions: {
                where: {
                  userId: ctx.user.sub,
                },
              },
            },
          },
        },
      },
    },
  })

  const mappedAnswerCollections: CatalogObject[] =
    catalogCollection?.objectAssignments.flatMap((assignment) => {
      if (assignment.answerCollection) {
        const answerCollection = assignment.answerCollection
        const permission = answerCollection.permissions[0]

        return {
          id: answerCollection.id,
          name: answerCollection.name,
          assignmentId: assignment.id,
          objectType: CatalogObjectType.ANSWER_COLLECTION,
          access: assignment.access,
          ownerShortname: answerCollection.owner?.shortname,
          isOwner: answerCollection.ownerId === ctx.user.sub,
          isManager:
            answerCollection.ownerId === ctx.user.sub ||
            permission?.permissionLevel === DB.PermissionLevel.ADMIN,
          isRequested:
            answerCollection.permissions.length > 0 &&
            typeof permission !== 'undefined' &&
            permission.permissionStatus === DB.PermissionStatus.REQUESTED,
          isShared:
            answerCollection.permissions.length > 0 &&
            typeof permission !== 'undefined' &&
            permission.permissionStatus === DB.PermissionStatus.GRANTED,
        }
      }

      return []
    }) ?? []

  return mappedAnswerCollections
}

export async function removeCatalogObjectAssignment(
  { assignmentId }: { assignmentId: number },
  ctx: ContextWithUser
) {
  const sufficientPermissions = await verifyCatalogItemEditPermissions(
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

  return !!updatedAssignment.id
}

export async function getCatalogAnswerCollections(ctx: ContextWithUser) {
  // fetch all answer collections, where the user is the owner or has been granted admin access
  const collections = await ctx.prisma.answerCollection.findMany({
    where: {
      ownerId: {
        not: null, // soft deleted answer collections cannot be added to the catalog
      },
      OR: [
        {
          ownerId: ctx.user.sub,
        },
        {
          permissions: {
            some: {
              userId: ctx.user.sub,
              permissionStatus: DB.PermissionStatus.GRANTED,
              permissionLevel: DB.PermissionLevel.ADMIN,
            },
          },
        },
      ],
    },
  })

  return collections.map((collection) => ({
    id: String(collection.id),
    name: collection.name,
  }))
}

export async function addAnswerCollectionToCatalog(
  {
    collectionId,
    access,
    catalogCollectionId,
  }: {
    collectionId: number
    access: DB.ObjectAccess
    catalogCollectionId?: string | null
  },
  ctx: ContextWithUser
) {
  // verify that the user has sufficient permissions on the answer collection
  const collection = await ctx.prisma.answerCollection.findUnique({
    where: {
      id: collectionId,
      OR: [
        {
          ownerId: ctx.user.sub,
        },
        {
          permissions: {
            some: {
              userId: ctx.user.sub,
              permissionStatus: DB.PermissionStatus.GRANTED,
              permissionLevel: DB.PermissionLevel.ADMIN,
            },
          },
        },
      ],
    },
    include: {
      owner: {
        select: {
          shortname: true,
        },
      },
      _count: {
        select: {
          permissions: {
            where: {
              userId: ctx.user.sub,
              permissionStatus: DB.PermissionStatus.GRANTED,
              permissionLevel: DB.PermissionLevel.ADMIN,
            },
          },
        },
      },
    },
  })

  if (!collection) {
    return null
  }

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

  // upsert the assignemnt of the answer collection to the catalog collection
  const assignment = await ctx.prisma.catalogCollectionAssignment.upsert({
    where: {
      answerCollectionId_catalogCollectionId: {
        answerCollectionId: collectionId,
        catalogCollectionId:
          catalogCollectionId ?? MISSING_CATALOG_COLLECTION_ID,
      },
    },
    create: {
      access,
      answerCollection: {
        connect: {
          id: collectionId,
        },
      },
      catalogCollection: {
        connect: {
          id: catalogCollectionId ?? MISSING_CATALOG_COLLECTION_ID,
        },
      },
    },
    update: {
      access,
    },
  })

  // return the updated catalog object
  return {
    id: collection.id,
    name: collection.name,
    objectType: CatalogObjectType.ANSWER_COLLECTION,
    assignmentId: assignment.id,
    access: assignment.access,
    ownerShortname: collection.owner?.shortname,
    isOwner: collection.ownerId === ctx.user.sub,
    isManager: true,
    isRequested: false,
    isShared: collection._count.permissions > 0,
  }
}
// #endregion
