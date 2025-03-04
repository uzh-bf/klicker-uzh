import * as DB from '@klicker-uzh/prisma'
import {
  AccessType,
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

// helper function to check for a specific access level on the catalog collection
export async function validateCatalogCollectionPermissions(
  {
    catalogCollectionId,
    acceptedAccessLevels,
  }: {
    catalogCollectionId: string
    acceptedAccessLevels: DB.AccessLevel[]
  },
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
              accessLevel: {
                in: acceptedAccessLevels,
              },
            },
          },
        },
      ],
    },
  })

  if (!catalogCollection) {
    return { valid: false, collection: null }
  }

  return { valid: true, catalogCollection }
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
        acceptedAccessLevels: [DB.AccessLevel.WRITE, DB.AccessLevel.ADMIN],
      },
      ctx
    )
    sufficientPermissions = valid
  }
  // ! Case 2: Object in top-level collection -> access level on object decides permissions
  else {
    if (assignment.answerCollection?.id) {
      // verify that the user has access to the answer collection
      const { valid } = await validateAnswerCollectionPermissions(
        {
          collectionId: assignment.answerCollection.id,
          acceptedAccessLevels: [DB.AccessLevel.ADMIN],
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
  const isEditor =
    collection.permissions.some(
      (permission) =>
        (permission.accessLevel === DB.AccessLevel.WRITE ||
          permission.accessLevel === DB.AccessLevel.ADMIN) &&
        permission.permissionStatus === DB.PermissionStatus.GRANTED
    ) || collection.ownerId === ctx.user.sub
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
    isEditor,
    isOwner: collection.ownerId === ctx.user.sub,
    isOwnerOrAdmin,
  }
}

export async function changeCatalogCollectionAccessLevel(
  {
    catalogCollectionId,
    permissionId,
    accessLevel,
  }: {
    catalogCollectionId: string
    permissionId: number
    accessLevel: DB.AccessLevel
  },
  ctx: ContextWithUser
) {
  // verify that the requesting user has sufficient permissions to modify access level (ADMIN or OWNER)
  const { valid } = await validateCatalogCollectionPermissions(
    {
      catalogCollectionId,
      acceptedAccessLevels: [DB.AccessLevel.ADMIN],
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
      accessLevel,
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
    accessLevel: permission.accessLevel,
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
      acceptedAccessLevels: [DB.AccessLevel.ADMIN],
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

export async function shareCatalogCollection(
  {
    catalogCollectionId,
    accessLevel,
    usernameOrEmail,
    userGroupId,
  }: {
    catalogCollectionId: string
    accessLevel: DB.AccessLevel
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
        acceptedAccessLevels: [DB.AccessLevel.ADMIN],
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
        accessLevel,
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
        accessLevel,
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
      accessLevel: permission.accessLevel,
      isRevokable: true,
      isOwn: false,
    }
  } else if (userGroupId) {
    // TODO: implement sharing with user groups
  } else {
    return null
  }
}

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
              accessLevel: DB.AccessLevel.ADMIN,
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
      accessLevel: permission.accessLevel,
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
            accessLevel: DB.AccessLevel.ADMIN,
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
            accessLevel: DB.AccessLevel.ADMIN,
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
        accessLevel: permission.accessLevel,
        isRevokable: true,
        isOwn: true,
      }
    : null
}

export async function changeCatalogObjectAccessLevel(
  {
    assignmentId,
    accessLevel,
  }: { assignmentId: number; accessLevel: DB.ObjectAccess },
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
        access: accessLevel,
      },
    }
  )

  return !!updatedAssignment.id
}

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

// #endregion

// ! Catalog Operations
// #region

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
        const answerCollection = assignment.answerCollection
        const permission = answerCollection.permissions[0]

        return {
          id: answerCollection.id,
          name: answerCollection.name,
          assignmentId: assignment.id,
          objectType: CatalogObjectType.ANSWER_COLLECTION,
          access: assignment.access,
          ownerShortname: answerCollection.owner?.shortname,
          isRequested:
            answerCollection.permissions.length > 0 &&
            typeof permission !== 'undefined' &&
            permission.permissionStatus === DB.PermissionStatus.REQUESTED,
          isShared:
            answerCollection.permissions.length > 0 &&
            typeof permission !== 'undefined' &&
            permission.permissionStatus === DB.PermissionStatus.GRANTED,
          isOwner: answerCollection.ownerId === ctx.user.sub,
          isOwnerOrAdmin:
            answerCollection.ownerId === ctx.user.sub ||
            permission?.accessLevel === DB.AccessLevel.ADMIN,
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

  // verify that the user has sufficient permissions on the catalog collection to add objects (if collection is defined)
  if (catalogCollectionId) {
    const { valid } = await validateCatalogCollectionPermissions(
      {
        catalogCollectionId,
        acceptedAccessLevels: [DB.AccessLevel.WRITE, DB.AccessLevel.ADMIN],
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
