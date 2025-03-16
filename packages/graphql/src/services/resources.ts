import * as DB from '@klicker-uzh/prisma'
import type { ContextWithUser } from '../lib/context.js'
import { validateTemplateAccessible } from './templates.js'

// ! Answer Collections
// #region
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

export async function validateAnswerCollectionPermissions(
  {
    collectionId,
    acceptedPermissionLevels,
  }: {
    collectionId: number
    acceptedPermissionLevels: DB.PermissionLevel[]
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
              permissionLevel: {
                in: acceptedPermissionLevels,
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
    numSharedUsers: newCollection._count?.permissions,
    numOfEntries: newCollection._count.entries,
    isOwner: true,
    isManager: true,
    isEditor: true,
    isImported: false,
    isShared: false,
    isRemovable: true,
  }
}

export async function getAnswerCollectionsElements(
  { templateId }: { templateId?: string | null },
  ctx: ContextWithUser
) {
  // fetch all answer collections, which are available to be included in elements
  const user = await ctx.prisma.user.findUnique({
    where: {
      id: ctx.user.sub,
    },
    include: {
      answerCollections: {
        include: {
          entries: {
            orderBy: {
              value: 'asc',
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
              owner: {
                select: {
                  shortname: true,
                },
              },
              entries: {
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

  // include answer collections used in any element of the template (required for preview / editing)
  // in case the instances were not modified, the user would get access to them either way
  let templateAnswerCollections: (DB.AnswerCollection & {
    entries: DB.AnswerCollectionEntry[]
  })[] = []
  if (templateId) {
    // verify that the user has access to the template activity
    const accessible = await validateTemplateAccessible({ templateId }, ctx)
    if (!accessible) {
      return []
    }

    const template = await ctx.prisma.activityTemplate.findUnique({
      where: {
        id: templateId,
      },
      include: {
        answerCollections: {
          include: {
            entries: {
              orderBy: {
                value: 'asc',
              },
            },
          },
          orderBy: {
            name: 'asc',
          },
        },
      },
    })

    templateAnswerCollections = template?.answerCollections ?? []
  }

  const combinedAnswerCollections = [
    ...user.answerCollections.map((collection) => ({
      ...collection,
      isShared: false,
    })),
    ...user.sharedObjects.flatMap((object) =>
      object.answerCollection
        ? {
            ...object.answerCollection,
            isShared: true,
          }
        : []
    ),
    ...templateAnswerCollections.map((collection) => ({
      ...collection,
      isShared: false,
    })),
  ]

  // return deduplicated list of answer collections (based on id)
  return combinedAnswerCollections.reduce<
    (DB.AnswerCollection & { entries: DB.AnswerCollectionEntry[] })[]
  >((acc, collection) => {
    if (!acc.some((c) => c.id === collection.id)) {
      acc.push(collection)
    }

    return acc
  }, [])
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
      entries: collection.entries.map((entry) => ({
        ...entry,
        numSolutionUsages: entry._count?.itemUsages,
      })),
      numSharedUsers: collection._count?.permissions,
      isOwner: true,
      isManager: true,
      isEditor: true,
      isShared: false,
    }
  } else {
    const permissionLevel = collection.permissions[0]?.permissionLevel
    return {
      ...collection,
      permissionLevel: permissionLevel ?? DB.PermissionLevel.READ,
      ownerShortname: collection.owner?.shortname,
      isOwner: false,
      isManager: permissionLevel === DB.PermissionLevel.ADMIN,
      isEditor:
        permissionLevel === DB.PermissionLevel.WRITE ||
        permissionLevel === DB.PermissionLevel.ADMIN,
      isShared: true,
    }
  }
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
    numSharedUsers: collection._count?.permissions,
    numOfEntries: collection._count.entries,
    isOwner: true,
    isManager: true,
    isEditor: true,
    isImported: collection.originalId !== null,
    isShared: false,
    isRemovable: collection._count.linkedElements === 0,
  }))

  const sharedCollections = user.sharedObjects.flatMap((object) => {
    const collection = object.answerCollection

    if (!collection) {
      return []
    }

    return {
      ...collection,
      numOfEntries: collection._count.entries,
      permissionLevel: object.permissionLevel,
      ownerShortname: collection.owner?.shortname,
      isOwner: false,
      isManager: object.permissionLevel === DB.PermissionLevel.ADMIN,
      isEditor:
        object.permissionLevel === DB.PermissionLevel.WRITE ||
        object.permissionLevel === DB.PermissionLevel.ADMIN,
      isImported: false, // shared objects cannot be imported
      isShared: true,
      isRemovable: collection._count.linkedElements === 0,
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
              permissionLevel: {
                in: [DB.PermissionLevel.WRITE, DB.PermissionLevel.ADMIN],
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

    // invalidate the answer collection
    ctx.emitter.emit('invalidate', {
      typename: 'AnswerCollection',
      id: id,
    })

    return {
      ...updateResult,
      numSharedUsers: collection._count.permissions,
      isShared: false,
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
      OR: [
        {
          ownerId: ctx.user.sub,
        },
        {
          permissions: {
            some: {
              userId: ctx.user.sub,
              permissionStatus: DB.PermissionStatus.GRANTED,
              permissionLevel: {
                in: [DB.PermissionLevel.ADMIN],
              },
            },
          },
        },
      ],
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

  let remainingPermissions = collection._count.permissions
  let updatedCollection: DB.AnswerCollection
  if (remainingPermissions > 0) {
    // only disconnect answer collection, since other users have access
    updatedCollection = await ctx.prisma.$transaction(async (tx) => {
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

              // decrease the number of remaining permissions
              remainingPermissions--

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

      // depending on the number of remaining permissions, update or delete the answer collection
      const mutationResult =
        remainingPermissions > 0
          ? await tx.answerCollection.update({
              where: {
                id: collectionId,
              },
              data: {
                owner: {
                  disconnect: true,
                },
              },
            })
          : await tx.answerCollection.delete({
              where: {
                id: collectionId,
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
  const { valid } = await validateAnswerCollectionPermissions(
    {
      collectionId,
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
  const { valid } = await validateAnswerCollectionPermissions(
    {
      collectionId,
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
  const { valid } = await validateAnswerCollectionPermissions(
    {
      collectionId,
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
// #endregion
