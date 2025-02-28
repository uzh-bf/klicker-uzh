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
    description,
    answers,
  }: {
    name: string
    description: string
    answers: string[]
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
    },
    include: {
      _count: {
        select: {
          entries: true,
          permissions: {
            where: {
              permissionStatus: DB.PermissionStatus.GRANTED,
            },
          },
        },
      },
    },
  })

  return {
    ...newCollection,
    accessType: AccessType.OWNER,
    numSharedUsers: newCollection._count?.permissions,
    numOfEntries: newCollection._count.entries,
    isOwner: true,
    isImported: false,
    isEditable: true,
    isShareable: true,
    isRemovable: true,
    isDeletionAllowed: true,
  }
}

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
          permissionStatus: DB.PermissionStatus.GRANTED,
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

  return [
    ...user.answerCollections.map((collection) => ({
      ...collection,
      accessType: AccessType.OWNER,
    })),
    ...user.sharedObjects.flatMap((object) =>
      object.answerCollection
        ? {
            ...object.answerCollection,
            accessType: AccessType.SHARED,
            sharingStatus: DB.PermissionStatus.GRANTED,
          }
        : []
    ),
  ]
}

export async function getSingleAnswerCollection(
  { id }: { id: number },
  ctx: ContextWithUser
) {
  const collection = await ctx.prisma.answerCollection.findUnique({
    where: {
      id,
      OR: [
        {
          ownerId: ctx.user.sub,
        },
        {
          permissions: {
            some: {
              userId: ctx.user.sub,
              permissionStatus: DB.PermissionStatus.GRANTED,
            },
          },
        },
      ],
    },
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
      _count: {
        select: {
          permissions: {
            where: {
              permissionStatus: DB.PermissionStatus.GRANTED,
            },
          },
        },
      },
    },
  })

  if (!collection) {
    return null
  }

  // return owned collection (editable, etc. if the ownerId is the user's id)
  if (collection.ownerId === ctx.user.sub) {
    return {
      ...collection,
      accessType: AccessType.OWNER,
      numSharedUsers: collection._count?.permissions,
      entries: collection.entries.map((entry) => ({
        ...entry,
        numSolutionUsages: entry._count?.itemUsages,
      })),
      isOwner: true,
      isEditable: true,
    }
  } else {
    const accessLevel = collection.permissions[0]?.accessLevel
    return {
      ...collection,
      accessType: AccessType.SHARED,
      sharingStatus: DB.PermissionStatus.GRANTED, // need to be granted for query above to succeed
      sharingLevel: accessLevel ?? DB.AccessLevel.READ,
      ownerShortname: collection.owner?.shortname,
      isOwner: false,
      isEditable:
        accessLevel === DB.AccessLevel.WRITE ||
        accessLevel === DB.AccessLevel.ADMIN,
    }
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
      accessLevel: permission.accessLevel,
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

export async function transferCollectionOwnership(
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
        accessLevel: permission.accessLevel,
        isRevokable: true,
        isOwn: true,
      }
    : null
}

export async function shareAnswerCollection(
  {
    collectionId,
    accessLevel,
    usernameOrEmail,
    userGroupId,
  }: {
    collectionId: number
    accessLevel: DB.AccessLevel
    usernameOrEmail?: string | null
    userGroupId?: number | null
  },
  ctx: ContextWithUser
) {
  // verify that user has either owner or admin access
  const { valid, collection } = await validateCollectionPermissions(
    {
      collectionId,
      acceptedAccessLevels: [DB.AccessLevel.ADMIN],
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
        accessLevel,
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

export async function changeCollectionAccessLevel(
  {
    collectionId,
    permissionId,
    accessLevel,
  }: {
    collectionId: number
    permissionId: number
    accessLevel: DB.AccessLevel
  },
  ctx: ContextWithUser
) {
  // verify that user has either owner or admin access
  const { valid } = await validateCollectionPermissions(
    {
      collectionId,
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

export async function revokeCollectionAccess(
  {
    permissionId,
    collectionId,
  }: { permissionId: number; collectionId: number },
  ctx: ContextWithUser
) {
  // verify that the permission belongs to the specified user and collection
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
              accessLevel: DB.AccessLevel.ADMIN,
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
  return deletedPermission.id
}

export async function getAnswerCollectionsInfo(ctx: ContextWithUser) {
  const user = await ctx.prisma.user.findUnique({
    where: {
      id: ctx.user.sub,
    },
    include: {
      answerCollections: {
        include: {
          _count: {
            select: {
              entries: true,
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
          permissionStatus: DB.PermissionStatus.GRANTED,
        },
        include: {
          answerCollection: {
            include: {
              _count: {
                select: {
                  entries: true,
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
    numOfEntries: collection._count.entries,
    isOwner: true,
    isImported: collection.originalId !== null,
    isEditable: true, // owner always has editing permissions
    isShareable: true, // owner always has sharing permissions
    isRemovable: collection._count.linkedElements === 0, // can be removed from own account if not linked to any elements
    isDeletionAllowed: true, // owner always has deletion objects
  }))

  const sharedCollections = user.sharedObjects.flatMap((object) => {
    const collection = object.answerCollection

    if (!collection) {
      return []
    }

    return {
      ...collection,
      accessType: AccessType.SHARED,
      numOfEntries: collection._count.entries,
      sharingStatus: object.permissionStatus,
      sharingLevel: object.accessLevel,
      ownerShortname: collection.owner?.shortname,
      isOwner: false,
      isImported: false, // shared objects cannot be imported
      isEditable:
        object.accessLevel === DB.AccessLevel.WRITE ||
        object.accessLevel === DB.AccessLevel.ADMIN, // only users with write or admin access can edit shared answer collections
      isShareable: object.accessLevel === DB.AccessLevel.ADMIN, // only users with admin access can share a shared answer collection
      isRemovable: collection._count.linkedElements === 0, // can be removed from own account if not linked to any elements
      isDeletionAllowed: object.accessLevel === DB.AccessLevel.ADMIN, // only users with admin access can delete answer collections
    }
  })

  return [...ownedCollections, ...sharedCollections]
}

export async function modifyAnswerCollection(
  {
    id,
    name,
    description,
  }: {
    id: number
    name?: string | null
    description?: string | null
  },
  ctx: ContextWithUser
) {
  // fetch the existing answer collection
  const collection = await ctx.prisma.answerCollection.findUnique({
    where: {
      id,
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
                in: [DB.AccessLevel.WRITE, DB.AccessLevel.ADMIN],
              },
            },
          },
        },
      ],
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
      },
      data: {
        name: name ?? undefined,
        description: description ?? undefined,
        version: {
          increment: 1,
        },
      },
      include: {
        entries: true,
      },
    })

    // TODO: MIGRATE - MOVE THIS TO CORRESPONDING CATALOG OPERATION
    // // if access is changed from restricted or public to private, all access requests will be declined automatically
    // if (
    //   (collection.access === DB.ObjectAccess.PUBLIC ||
    //     collection.access === DB.ObjectAccess.RESTRICTED) &&
    //   access === DB.ObjectAccess.PRIVATE
    // ) {
    //   await tx.permission.deleteMany({
    //     where: {
    //       answerCollectionId: id,
    //       permissionStatus: DB.PermissionStatus.REQUESTED,
    //     },
    //   })

    //   // invalidate the corresponding cache entries
    //   collection.permissions.forEach((permission) => {
    //     ctx.emitter.emit('invalidate', {
    //       typename: 'Permission',
    //       id: permission.id,
    //     })
    //   })
    // }

    // invalidate the answer collection
    ctx.emitter.emit('invalidate', {
      typename: 'AnswerCollection',
      id: id,
    })

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

      // remove all access requests
      await tx.permission.deleteMany({
        where: {
          answerCollectionId: collectionId,
          permissionStatus: DB.PermissionStatus.REQUESTED,
        },
      })

      // TODO: make this more efficient by using derived permissions
      // revoke access for all users that have not used it
      const grantedPermissions = await tx.permission.findMany({
        where: {
          answerCollectionId: collectionId,
          permissionStatus: DB.PermissionStatus.GRANTED,
        },
      })

      await Promise.all(
        grantedPermissions.map(async (permission) => {
          if (permission.answerCollectionId && permission.userId) {
            // check if the user has used the collection
            const permissionUsage = await tx.permission.findUnique({
              where: {
                id: permission.id,
              },
              include: {
                answerCollection: {
                  include: {
                    linkedElements: {
                      where: {
                        OR: [
                          {
                            ownerId: permission.userId,
                          },
                          {
                            permissions: {
                              some: {
                                userId: permission.userId,
                                permissionStatus: DB.PermissionStatus.GRANTED,
                              },
                            },
                          },
                        ],
                      },
                    },
                  },
                },
              },
            })

            if (
              !permissionUsage ||
              permissionUsage.answerCollection?.linkedElements.length === 0
            ) {
              // delete the permission
              await tx.permission.delete({
                where: {
                  id: permission.id,
                },
              })

              // invalidate permission
              ctx.emitter.emit('invalidate', {
                typename: 'Permission',
                id: permission.id,
              })
            }
          }
        })
      )

      // disconnect granted permissions for remaining users
      await tx.permission.updateMany({
        where: {
          answerCollectionId: collectionId,
          permissionStatus: DB.PermissionStatus.GRANTED,
        },
        data: {
          objectOwnerId: null,
        },
      })

      // remove all catalog assignments
      await tx.catalogCollectionAssignment.deleteMany({
        where: {
          answerCollectionId: collectionId,
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

  // invalidate the answer collection
  ctx.emitter.emit('invalidate', {
    typename: 'AnswerCollection',
    id: collectionId,
  })

  return collection
}

async function validateCollectionPermissions(
  {
    collectionId,
    acceptedAccessLevels,
  }: {
    collectionId: number
    acceptedAccessLevels: DB.AccessLevel[]
  },
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
              accessLevel: {
                in: acceptedAccessLevels,
              },
            },
          },
        },
      ],
    },
  })

  if (!collection) {
    return { valid: false, collection: null }
  }

  return { valid: true, collection }
}

export async function editAnswerCollectionEntry(
  {
    id,
    value,
    collectionId,
  }: {
    id: number
    value: string
    collectionId: number
  },
  ctx: ContextWithUser
) {
  // verify that the user has at least writer permissions for the collection
  const { valid } = await validateCollectionPermissions(
    {
      collectionId,
      acceptedAccessLevels: [DB.AccessLevel.WRITE, DB.AccessLevel.ADMIN],
    },
    ctx
  )

  if (!valid) {
    return null
  }

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
  { id, collectionId }: { id: number; collectionId: number },
  ctx: ContextWithUser
) {
  // verify that the user has at least writer permissions for the collection
  const { valid } = await validateCollectionPermissions(
    {
      collectionId,
      acceptedAccessLevels: [DB.AccessLevel.WRITE, DB.AccessLevel.ADMIN],
    },
    ctx
  )

  if (!valid) {
    return null
  }

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
  // verify that the user has at least writer permissions for the collection
  const { valid } = await validateCollectionPermissions(
    {
      collectionId,
      acceptedAccessLevels: [DB.AccessLevel.WRITE, DB.AccessLevel.ADMIN],
    },
    ctx
  )

  if (!valid) {
    return null
  }

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
    ? await verifyUserAccessCatalogCollection(
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
    ? await verifyUserAccessCatalogCollection(
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
    ? await verifyUserAccessCatalogCollection(
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
