import * as DB from '@klicker-uzh/prisma'
import {
  AccessType,
  CatalogObject,
  CatalogObjectType,
  ObjectSharingRequest,
} from '@klicker-uzh/types'
import type { ContextWithUser } from '../lib/context.js'

// ! do not modify - required for the import of objects not assigned to any catalogue
const MISSING_CATALOG_COLLECTION_ID = 'fde06b3c-d515-4907-99cf-c2ba67583155'

// ! Answer Collections
// #region
export async function createAnswerCollection(
  {
    name,
    access,
    description,
    answers,
    catalogCollectionId,
  }: {
    name: string
    access: DB.ObjectAccess
    description: string
    answers: string[]
    catalogCollectionId?: string | null
  },
  ctx: ContextWithUser
) {
  const collection = await ctx.prisma.answerCollection.findUnique({
    where: {
      ownerId_name: {
        ownerId: ctx.user.sub,
        name,
      },
    },
  })

  // if collection already exists for the user, notify him that a new name needs to be chosen
  if (collection) {
    return null
  }

  const newCollection = await ctx.prisma.answerCollection.create({
    data: {
      name,
      access,
      description,
      entries: {
        create: answers.map((answer) => ({
          value: answer,
        })),
      },
      owner: {
        connect: {
          id: ctx.user.sub,
        },
      },
      // connect to catalog collection if provided (and to empty catalog if not private)
      catalogCollection:
        access !== DB.ObjectAccess.PRIVATE
          ? {
              connect: {
                id: catalogCollectionId ?? MISSING_CATALOG_COLLECTION_ID,
              },
            }
          : undefined,
    },
    include: {
      entries: true,
      owner: {
        select: {
          shortname: true,
        },
      },
    },
  })

  return {
    ...newCollection,
    ownerShortname: newCollection.owner?.shortname,
    accessType: AccessType.OWNER,
  }
}

// TODO: split up to only fetch entries on modal opening
export async function getAnswerCollections(ctx: ContextWithUser) {
  const user = await ctx.prisma.user.findUnique({
    where: {
      id: ctx.user.sub,
    },
    include: {
      answerCollections: {
        include: {
          entries: {
            include: {
              _count: {
                select: {
                  itemUsages: true,
                },
              },
            },
            orderBy: {
              value: 'asc',
            },
          },
          _count: {
            select: {
              linkedElements: {
                where: {
                  ownerId: ctx.user.sub,
                },
              },
              permissions: {
                where: {
                  permissionStatus: DB.PermissionStatus.GRANTED,
                },
              },
            },
          },
        },
        orderBy: {
          name: 'asc',
        },
      },
      sharedObjects: {
        where: {
          answerCollectionId: {
            not: null,
          },
        },
        include: {
          answerCollection: {
            include: {
              _count: {
                select: {
                  linkedElements: {
                    where: {
                      ownerId: ctx.user.sub,
                    },
                  },
                },
              },
              owner: {
                select: {
                  shortname: true,
                },
              },
              // entries are only relevant for users with granted access
              entries: {
                include: {
                  _count: {
                    select: {
                      // solution usage information is only relevant for write access
                      itemUsages: true,
                    },
                  },
                },
                orderBy: {
                  value: 'asc',
                },
              },
            },
          },
        },
      },
    },
  })

  if (!user) {
    return []
  }

  const ownedCollections = user.answerCollections.map((collection) => ({
    ...collection,
    accessType: AccessType.OWNER,
    numSharedUsers: collection._count?.permissions,
    catalogCollectionId:
      collection.catalogCollectionId === MISSING_CATALOG_COLLECTION_ID
        ? null // return null if collection is not linked to any catalog
        : collection.catalogCollectionId,
    entries: collection.entries.map((entry) => ({
      ...entry,
      numSolutionUsages: entry._count?.itemUsages,
    })),
    isOwner: true,
    isEditable: true,
    isImported: collection.originalId !== null,
    isAccessGranted: false,
    isRemovable: collection._count?.linkedElements === 0,
  }))

  const sharedCollections = user.sharedObjects.flatMap((object) => {
    const collection = object.answerCollection

    if (!collection) {
      return []
    }

    return {
      ...collection,
      accessType: AccessType.SHARED,
      sharingStatus: object.permissionStatus,
      sharingLevel: object.accessLevel,
      ownerShortname: collection.owner?.shortname,
      catalogCollectionId:
        collection.catalogCollectionId === MISSING_CATALOG_COLLECTION_ID
          ? null // return null if collection is not linked to any catalog
          : collection.catalogCollectionId,
      entries:
        object.permissionStatus === DB.PermissionStatus.GRANTED
          ? collection.entries
          : undefined,
      isOwner: false,
      isEditable: false,
      isImported: false,
      isAccessGranted: object.permissionStatus === DB.PermissionStatus.GRANTED,
      isRemovable: collection._count?.linkedElements === 0,
    }
  })

  return [...ownedCollections, ...sharedCollections]
}

export async function modifyAnswerCollection(
  {
    id,
    name,
    access,
    description,
    catalogCollectionId,
  }: {
    id: number
    name?: string | null
    access?: DB.ObjectAccess | null
    description?: string | null
    catalogCollectionId?: string | null
  },
  ctx: ContextWithUser
) {
  // fetch the existing answer collection
  const collection = await ctx.prisma.answerCollection.findUnique({
    where: {
      id,
    },
    include: {
      _count: {
        select: {
          permissions: {
            where: {
              permissionStatus: DB.PermissionStatus.GRANTED,
            },
          },
        },
      },
      permissions: {
        where: {
          permissionStatus: DB.PermissionStatus.REQUESTED,
        },
      },
    },
  })

  if (!collection) {
    return null
  }

  const updatedCollection = await ctx.prisma.$transaction(async (tx) => {
    // update changes in the database
    const updateResult = await tx.answerCollection.update({
      where: {
        id,
        ownerId: ctx.user.sub,
      },
      data: {
        name: name ?? undefined,
        access: access ?? undefined,
        description: description ?? undefined,
        version: {
          increment: 1,
        },
        // for non-private collections, set a catalog collection, for private ones, remove it
        catalogCollection:
          access !== DB.ObjectAccess.PRIVATE
            ? {
                connect: {
                  id: catalogCollectionId ?? MISSING_CATALOG_COLLECTION_ID,
                },
              }
            : { disconnect: true },
      },
      include: {
        entries: true,
      },
    })

    // if access is changed from restricted or public to private, all access requests will be declined automatically
    if (
      (collection.access === DB.ObjectAccess.PUBLIC ||
        collection.access === DB.ObjectAccess.RESTRICTED) &&
      access === DB.ObjectAccess.PRIVATE
    ) {
      await tx.permission.deleteMany({
        where: {
          answerCollectionId: id,
          permissionStatus: DB.PermissionStatus.REQUESTED,
        },
      })

      // invalidate the corresponding cache entries
      collection.permissions.forEach((permission) => {
        ctx.emitter.emit('invalidate', {
          typename: 'Permission',
          id: permission.id,
        })
      })
    }

    return {
      ...updateResult,
      numSharedUsers: collection._count.permissions,
      accessType: AccessType.OWNER,
    }
  })

  return updatedCollection
}

export async function deleteAnswerCollection(
  {
    collectionId,
  }: {
    collectionId: number
  },
  ctx: ContextWithUser
) {
  // fetch answer collection as owner
  const collection = await ctx.prisma.answerCollection.findUnique({
    where: {
      id: collectionId,
      ownerId: ctx.user.sub,
    },
    include: {
      _count: {
        select: {
          linkedElements: {
            where: {
              ownerId: ctx.user.sub,
            },
          },
          permissions: {
            where: {
              permissionStatus: DB.PermissionStatus.GRANTED,
            },
          },
        },
      },
    },
  })

  // if collection does not exist or is still linked to own elements, do not allow deletion
  if (!collection || collection._count.linkedElements > 0) {
    return null
  }

  let updatedCollection: DB.AnswerCollection
  if (collection._count.permissions > 0) {
    // only disconnect answer collection, since other users have access
    updatedCollection = await ctx.prisma.$transaction(async (tx) => {
      const mutationResult = await tx.answerCollection.update({
        where: {
          id: collectionId,
        },
        data: {
          owner: {
            disconnect: true,
          },
        },
      })

      // remove all access requests in the same transaction
      await tx.permission.deleteMany({
        where: {
          answerCollectionId: collectionId,
          permissionStatus: DB.PermissionStatus.REQUESTED,
        },
      })

      // disconnect granted permissions from user
      await tx.permission.updateMany({
        where: {
          answerCollectionId: collectionId,
          permissionStatus: DB.PermissionStatus.GRANTED,
        },
        data: {
          objectOwnerId: null,
        },
      })

      return mutationResult
    })
  } else {
    // otherwise delete the collection
    updatedCollection = await ctx.prisma.answerCollection.delete({
      where: {
        id: collectionId,
      },
    })
  }

  ctx.emitter.emit('invalidate', {
    typename: 'AnswerCollection',
    id: collectionId,
  })

  return updatedCollection.id
}

export async function removeAnswerCollection(
  {
    collectionId,
  }: {
    collectionId: number
  },
  ctx: ContextWithUser
) {
  // fetch existing permission and collection
  const permission = await ctx.prisma.permission.findUnique({
    where: {
      answerCollectionId_userId: {
        answerCollectionId: collectionId,
        userId: ctx.user.sub,
      },
      permissionStatus: DB.PermissionStatus.GRANTED,
    },
    include: {
      answerCollection: {
        include: {
          _count: {
            select: {
              linkedElements: {
                where: {
                  ownerId: ctx.user.sub,
                },
              },
              permissions: {
                where: {
                  permissionStatus: DB.PermissionStatus.GRANTED,
                },
              },
            },
          },
        },
      },
    },
  })

  // if collection does not exist, is linked to own elements, or does belong to the user, do not allow removal
  const collection = permission?.answerCollection
  if (
    !permission ||
    !collection ||
    collection._count.linkedElements > 0 ||
    permission.objectOwnerId === ctx.user.sub
  ) {
    return null
  }

  // if no other users have access to this collection and the owner is already disconnected, delete it
  if (collection._count.permissions === 1 && collection.ownerId === null) {
    await ctx.prisma.answerCollection.delete({
      where: {
        id: collectionId,
      },
    })
  } else {
    // otherwise, delete the sharing permission
    await ctx.prisma.permission.delete({
      where: {
        id: permission.id,
      },
    })
  }

  ctx.emitter.emit('invalidate', {
    typename: 'AnswerCollection',
    id: collection.id,
  })

  return collection.id
}

async function incrementCollectionVersion(
  { collectionId }: { collectionId: number },
  ctx: ContextWithUser
) {
  const collection = await ctx.prisma.answerCollection.update({
    where: {
      id: collectionId,
    },
    data: {
      version: {
        increment: 1,
      },
    },
  })

  return collection
}

export async function editAnswerCollectionEntry(
  {
    id,
    value,
  }: {
    id: number
    value: string
  },
  ctx: ContextWithUser
) {
  // update entry in the database
  const updatedEntry = await ctx.prisma.answerCollectionEntry.update({
    where: {
      id,
    },
    data: {
      value,
    },
  })

  // increment version of the collection to keep track of changes
  await incrementCollectionVersion(
    { collectionId: updatedEntry.collectionId },
    ctx
  )

  return updatedEntry
}

export async function deleteAnswerCollectionEntry(
  { id }: { id: number },
  ctx: ContextWithUser
) {
  // delete answer option from the database
  const updatedEntry = await ctx.prisma.answerCollectionEntry.delete({
    where: {
      id,
    },
  })

  // increment version of the collection to keep track of changes
  await incrementCollectionVersion(
    { collectionId: updatedEntry.collectionId },
    ctx
  )

  return updatedEntry.id
}

export async function addAnswerCollectionOption(
  {
    collectionId,
    value,
  }: {
    collectionId: number
    value: string
  },
  ctx: ContextWithUser
) {
  // add new answer option to the database
  const newEntry = await ctx.prisma.answerCollectionEntry.create({
    data: {
      value,
      collection: {
        connect: {
          id: collectionId,
        },
      },
    },
  })

  // increment version of the collection to keep track of changes
  await incrementCollectionVersion({ collectionId: newEntry.collectionId }, ctx)

  return newEntry
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
// #endregion

// ! Catalog Objects
// #region

// verify that a user has access to a specific catalog collection (no access level enforced)
// TODO: extend this function with an additional parameter to check for a specific access level
async function verifyUserAccessCatalogCollection(
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

  return catalogCollection && catalogCollection.permissions.length > 0
}

// function to retrieve information on a single answer collection that is available in the catalog (no private collections)
export async function getSingleAnswerCollectionCatalog(
  { collectionId }: { collectionId: number },
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

  if (!collection || collection.access === DB.ObjectAccess.PRIVATE) {
    return null
  }

  // verify that the user has access to the catalog collection the answer collection is contained in
  const validAccess = collection.catalogCollectionId
    ? await verifyUserAccessCatalogCollection(
        { catalogCollectionId: collection.catalogCollectionId },
        ctx
      )
    : true

  if (!validAccess) {
    return null
  }

  // only if collection is public, the entries should be revealed
  if (collection.access === DB.ObjectAccess.PUBLIC) {
    return {
      ...collection,
      accessType: AccessType.SHARED,
      ownerShortname: collection.owner?.shortname,
    }
  } else {
    return {
      ...collection,
      entries: [],
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
      answerCollections: {
        where: {
          ownerId: {
            not: null,
          },
          access: {
            in: [DB.ObjectAccess.PUBLIC, DB.ObjectAccess.RESTRICTED],
          },
        },
        select: {
          id: true,
          name: true,
          access: true,
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
  })

  const mappedAnswerCollections: CatalogObject[] =
    catalogCollection?.answerCollections.map((collection) => ({
      id: collection.id,
      name: collection.name,
      objectType: CatalogObjectType.ANSWER_COLLECTION,
      access: collection.access,
      ownerShortname: collection.owner?.shortname,
      isRequested:
        collection.permissions.length > 0 &&
        typeof collection.permissions[0] !== 'undefined' &&
        collection.permissions[0].permissionStatus ===
          DB.PermissionStatus.REQUESTED,
      isShared:
        collection.permissions.length > 0 &&
        typeof collection.permissions[0] !== 'undefined' &&
        collection.permissions[0].permissionStatus ===
          DB.PermissionStatus.GRANTED,
      isOwner: collection.ownerId === ctx.user.sub,
    })) ?? []

  return [...mappedAnswerCollections]
}

export async function requestAnswerCollection(
  { collectionId }: { collectionId: number },
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
  const validAccess = collection.catalogCollectionId
    ? await verifyUserAccessCatalogCollection(
        { catalogCollectionId: collection.catalogCollectionId },
        ctx
      )
    : true

  if (!validAccess) {
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
        access: updatedCollection.access,
        ownerShortname: permissionRequest.objectOwner?.shortname,
        isRequested: true,
        isShared: false,
        isOwner: false,
      }
    : null
}

export async function importAnswerCollection(
  { collectionId }: { collectionId: number },
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

  if (
    !collection ||
    collection.ownerId === null ||
    collection.access !== DB.ObjectAccess.PUBLIC
  ) {
    return false
  }

  // verify that the user has access to the catalog collection the answer collection is contained in
  const validAccess = collection.catalogCollectionId
    ? await verifyUserAccessCatalogCollection(
        { catalogCollectionId: collection.catalogCollectionId },
        ctx
      )
    : true

  if (!validAccess) {
    return false
  }

  // create new answer collection with the content of the original one
  await ctx.prisma.answerCollection.create({
    data: {
      originalId: collection.id,
      name: collection.name,
      description: collection.description,
      access: DB.ObjectAccess.PRIVATE,
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
      accessLevel: accessLevel ?? DB.AccessLevel.READ,
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

  return true
}

// #endregion
