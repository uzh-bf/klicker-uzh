import * as DB from '@klicker-uzh/prisma'
import {
  AccessType,
  CatalogObject,
  CatalogObjectType,
  ObjectSharingRequest,
} from '@klicker-uzh/types'
import type { ContextWithUser } from '../lib/context.js'
import { validateCollectionPermissions } from './resources.js'

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

  const catalogCollection = await ctx.prisma.catalogCollection.findUnique({
    where: {
      id: catalogCollectionId,
    },
    include: {
      permissions: {
        where: {
          OR: [
            {
              userId: ctx.user.sub,
              permissionStatus: DB.PermissionStatus.GRANTED,
            },
            // {
            //   userGroup: {
            //     members: {
            //       some: {
            //         id: ctx.user.sub,
            //       },
            //     },
            //   },
            // },
          ],
        },
      },
    },
  })

  return (
    catalogCollection &&
    (catalogCollection.access === DB.ObjectAccess.PUBLIC ||
      catalogCollection.permissions.length > 0)
  )
}

// #endregion

// ! Catalog Objects
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
    isRequested: false,
    isShared: false,
    isOwner: true,
    isOwnerOrAdmin: true,
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
  const isOwnerOrAdmin =
    collection.ownerId === ctx.user.sub ||
    collection.permissions.some(
      (permission) =>
        permission.accessLevel === DB.AccessLevel.ADMIN &&
        permission.permissionStatus === DB.PermissionStatus.GRANTED
    )

  return {
    ...collection,
    ownerShortname: collection.owner?.shortname,
    isRequested,
    isShared,
    isOwner: collection.ownerId === ctx.user.sub,
    isOwnerOrAdmin,
  }
}

// TODO: when querying catalog collections, only show the ones that have elements inside of them or the user is the owner or has at least writing access (= filter out public without collections elements)
// TODO: in UI show hint if someone only has read access on restricted catalog collection or no access on public catalog collection that with these access rights, nothing can be added

// #endregion

// ! Catalog Operations
// #region

// function to retrieve all catalog collections except from public ones without any linked objects
export async function getCatalogCollectionsList(ctx: ContextWithUser) {
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
          collection._count.objectAssignments === 0
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
      const isOwnerOrAdmin =
        collection.ownerId === ctx.user.sub ||
        collection.permissions.some(
          (permission) =>
            permission.accessLevel === DB.AccessLevel.ADMIN &&
            permission.permissionStatus === DB.PermissionStatus.GRANTED
        )

      return {
        ...collection,
        ownerShortname: collection.owner?.shortname,
        isRequested,
        isShared,
        isOwner: collection.ownerId === ctx.user.sub,
        isOwnerOrAdmin,
      }
    })

  return mappedCollections
}

// function to retrieve information on a single answer collection that is available in the catalog (no private collections)
export async function getSingleAnswerCollectionCatalog(
  {
    collectionId,
    catalogCollectionId,
  }: { collectionId: number; catalogCollectionId?: string | null },
  ctx: ContextWithUser
) {
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
    return {
      ...collection,
      objectAccess: assignment.access,
      accessType: AccessType.SHARED,
      ownerShortname: collection.owner?.shortname,
    }
  } else {
    return {
      ...collection,
      entries: [],
      objectAccess: assignment.access,
      accessType: AccessType.SHARED,
      ownerShortname: collection.owner?.shortname,
    }
  }
}

export async function getCatalogObjects(
  { catalogCollectionId }: { catalogCollectionId?: string | null },
  ctx: ContextWithUser
) {
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
        const collection = assignment.answerCollection
        const permission = collection.permissions[0]

        return {
          id: collection.id,
          name: collection.name,
          assignmentId: assignment.id,
          objectType: CatalogObjectType.ANSWER_COLLECTION,
          access: assignment.access,
          ownerShortname: collection.owner?.shortname,
          isRequested:
            collection.permissions.length > 0 &&
            typeof permission !== 'undefined' &&
            permission.permissionStatus === DB.PermissionStatus.REQUESTED,
          isShared:
            collection.permissions.length > 0 &&
            typeof permission !== 'undefined' &&
            permission.permissionStatus === DB.PermissionStatus.GRANTED,
          isOwner: collection.ownerId === ctx.user.sub,
          isOwnerOrAdmin:
            collection.ownerId === ctx.user.sub ||
            permission?.accessLevel === DB.AccessLevel.ADMIN,
        }
      }

      return []
    }) ?? []

  return mappedAnswerCollections
}

export async function changeCatalogObjectAccessLevel(
  {
    assignmentId,
    accessLevel,
  }: { assignmentId: number; accessLevel: DB.ObjectAccess },
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

  // verify that the user has sufficient access for this action
  let verified = false
  if (assignment.answerCollection?.id) {
    // verify that the user has access to the answer collection
    const { valid } = await validateCollectionPermissions(
      {
        collectionId: assignment.answerCollection.id,
        acceptedAccessLevels: [DB.AccessLevel.ADMIN],
      },
      ctx
    )
    verified = valid
  }

  if (!verified) {
    return false
  }

  // change the access level of the assignment
  const updatedAssignment = await ctx.prisma.catalogCollectionAssignment.update(
    {
      where: {
        id: assignmentId,
      },
      data: {
        access: accessLevel,
      },
    }
  )

  return !!updatedAssignment.id
}

export async function removeCatalogObjectAssignment(
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

  // verify that the user has sufficient access for this action
  let verified = false
  if (assignment.answerCollection?.id) {
    // verify that the user has access to the answer collection
    const { valid } = await validateCollectionPermissions(
      {
        collectionId: assignment.answerCollection.id,
        acceptedAccessLevels: [DB.AccessLevel.ADMIN],
      },
      ctx
    )
    verified = valid
  }

  if (!verified) {
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
              accessLevel: DB.AccessLevel.ADMIN,
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
              accessLevel: DB.AccessLevel.ADMIN,
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
    },
  })

  if (!collection) {
    return null
  }

  // TODO: check if the user has sufficient permissions on the catalog collection

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
    isRequested: false,
    isShared: true,
    isOwner: collection.ownerId === ctx.user.sub,
    isOwnerOrAdmin: true,
  }
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
      accessLevel: DB.AccessLevel.READ,
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
        isRequested: true,
        isShared: false,
        isOwner: false,
        isOwnerOrAdmin: false,
      }
    : null
}

export async function importAnswerCollection(
  {
    collectionId,
    catalogCollectionId,
  }: { collectionId: number; catalogCollectionId?: string | null },
  ctx: ContextWithUser
) {
  // get answer collection, verify public access and check if access has already been granted
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

  if (!assignment || assignment.access !== DB.ObjectAccess.PUBLIC) {
    return false
  }

  // create new answer collection with the content of the original one
  await ctx.prisma.answerCollection.create({
    data: {
      originalId: collection.id,
      name: collection.name,
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
          answerCollectionId: {
            not: null,
          },
        },
        include: {
          user: {
            select: {
              shortname: true,
              email: true,
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
      // sharing request for answer collection
      if (
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

export async function resolveObjectSharingRequest(
  {
    permissionId,
    userId,
    accessLevel,
    approved,
  }: {
    permissionId: number
    userId: string
    accessLevel?: DB.AccessLevel
    approved: boolean
  },
  ctx: ContextWithUser
) {
  // check that the access request exists and that the user is the owner of the collection
  const accessRequest = await ctx.prisma.permission.findUnique({
    where: {
      id: permissionId,
      userId,
      accessLevel: DB.AccessLevel.READ, // access requests are always assigned read access level
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
        accessLevel,
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
