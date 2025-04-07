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
  // type modification required for method to be usable inside transaction without type errors
  ctx: Omit<ContextWithUser, 'prisma'> & {
    prisma: Omit<
      DB.PrismaClient<DB.Prisma.PrismaClientOptions, never>,
      '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
    >
  }
) {
  const collection = await ctx.prisma.answerCollection.findUnique({
    where: {
      id: collectionId,
      permissions: {
        some: {
          userId: ctx.user.sub,
          permissionLevel: {
            in: [...acceptedPermissionLevels, DB.PermissionLevel.OWNER],
          },
        },
      },
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
        },
      },
    },
  })

  // TODO: trigger recomputation of derived permissions (-> owner should get new one)

  return {
    ...newCollection,
    numSharedUsers: 0,
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
        where: {
          isDeleted: false,
        },
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
    const { accessible } = await validateTemplateAccessible({ templateId }, ctx)
    if (accessible) {
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
    } else {
      templateAnswerCollections = []
    }
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
      permissions: {
        some: {
          userId: ctx.user.sub,
        },
      },
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
          directPermissions: true,
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
      numSharedUsers: collection._count?.directPermissions,
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
                  permissions: {
                    some: {
                      userId: ctx.user.sub,
                    },
                  },
                },
              },
              linkedTemplates: {
                where: {
                  OR: [
                    {
                      liveQuiz: {
                        permissions: {
                          some: {
                            userId: ctx.user.sub,
                          },
                        },
                      },
                    },
                    {
                      practiceQuiz: {
                        permissions: {
                          some: {
                            userId: ctx.user.sub,
                          },
                        },
                      },
                    },
                    {
                      microLearning: {
                        permissions: {
                          some: {
                            userId: ctx.user.sub,
                          },
                        },
                      },
                    },
                    {
                      groupActivity: {
                        permissions: {
                          some: {
                            userId: ctx.user.sub,
                          },
                        },
                      },
                    },
                  ],
                },
              },
              directPermissions: true,
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
                  entries: true,
                  linkedElements: {
                    where: {
                      permissions: {
                        some: {
                          userId: ctx.user.sub,
                        },
                      },
                    },
                  },
                  linkedTemplates: {
                    where: {
                      OR: [
                        {
                          liveQuiz: {
                            permissions: {
                              some: {
                                userId: ctx.user.sub,
                              },
                            },
                          },
                        },
                        {
                          practiceQuiz: {
                            permissions: {
                              some: {
                                userId: ctx.user.sub,
                              },
                            },
                          },
                        },
                        {
                          microLearning: {
                            permissions: {
                              some: {
                                userId: ctx.user.sub,
                              },
                            },
                          },
                        },
                        {
                          groupActivity: {
                            permissions: {
                              some: {
                                userId: ctx.user.sub,
                              },
                            },
                          },
                        },
                      ],
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
    numSharedUsers: collection._count?.directPermissions,
    numOfEntries: collection._count.entries,
    isOwner: true,
    isManager: true,
    isEditor: true,
    isImported: collection.originalId !== null,
    isShared: false,
    isRemovable:
      collection._count.linkedElements === 0 &&
      collection._count.linkedTemplates === 0,
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
      isRemovable:
        collection._count.linkedElements === 0 &&
        collection._count.linkedTemplates === 0,
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
      permissions: {
        some: {
          userId: ctx.user.sub,
          permissionLevel: {
            in: [
              DB.PermissionLevel.WRITE,
              DB.PermissionLevel.ADMIN,
              DB.PermissionLevel.OWNER,
            ],
          },
        },
      },
    },
    include: {
      _count: {
        select: {
          permissions: true,
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
  // fetch answer collection as owner or admin
  const collectionUser = await ctx.prisma.answerCollection.findUnique({
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
    include: {
      _count: {
        select: {
          linkedElements: {
            where: {
              permissions: {
                some: {
                  userId: ctx.user.sub,
                },
              },
            },
          },
          linkedTemplates: {
            where: {
              OR: [
                {
                  liveQuiz: {
                    permissions: {
                      some: {
                        userId: ctx.user.sub,
                      },
                    },
                  },
                },
                {
                  practiceQuiz: {
                    permissions: {
                      some: {
                        userId: ctx.user.sub,
                      },
                    },
                  },
                },
                {
                  microLearning: {
                    permissions: {
                      some: {
                        userId: ctx.user.sub,
                      },
                    },
                  },
                },
                {
                  groupActivity: {
                    permissions: {
                      some: {
                        userId: ctx.user.sub,
                      },
                    },
                  },
                },
              ],
            },
          },
          permissions: true,
        },
      },
    },
  })

  // if collection does not exist or is still linked to own elements, do not allow deletion
  if (
    !collectionUser ||
    collectionUser._count.linkedElements > 0 ||
    collectionUser._count.linkedTemplates > 0
  ) {
    return null
  }

  // check if any elements or templates are still linked to the collection (--> soft delete)
  const collection = await ctx.prisma.answerCollection.findUnique({
    where: {
      id: collectionId,
    },
    include: {
      _count: {
        select: {
          linkedElements: true,
          linkedTemplates: true,
        },
      },
    },
  })

  if (!collection) {
    return null
  }

  const remainingLinkedElements = collection._count.linkedElements
  const remainingLinkedTemplates = collection._count.linkedTemplates

  // if there are any elements or templates still linked to the collection, revoke all unused permissions and then soft-delete the collection
  let updatedCollection: DB.AnswerCollection
  if (remainingLinkedElements > 0 || remainingLinkedTemplates > 0) {
    updatedCollection = await ctx.prisma.$transaction(async (tx) => {
      // ? Remove all access requests
      await tx.accessRequest.deleteMany({
        where: {
          answerCollectionId: collectionId,
        },
      })

      // ? Revoke all direct permissions on the answer collection
      // only users with linked elements or templates should retain valid access --> stored in derived permissions
      await tx.permission.deleteMany({
        where: {
          answerCollectionId: collectionId,
        },
      })

      // ? Remove all catalog assignments
      await tx.catalogCollectionAssignment.deleteMany({
        where: {
          answerCollectionId: collectionId,
        },
      })

      // ? Disconnect the owner from the answer collection
      const updatedAnswerCollection = await tx.answerCollection.update({
        where: {
          id: collectionId,
        },
        data: {
          owner: {
            disconnect: true,
          },
        },
      })

      // TODO: trigger recomputation of derived permissions (potentially removed derived permissions need to be re-added due to valid access to linked objects)

      return updatedAnswerCollection
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
    },
    include: {
      answerCollection: {
        include: {
          _count: {
            select: {
              linkedElements: {
                where: {
                  permissions: {
                    some: {
                      userId: ctx.user.sub,
                    },
                  },
                },
              },
              linkedTemplates: {
                where: {
                  OR: [
                    {
                      liveQuiz: {
                        permissions: {
                          some: {
                            userId: ctx.user.sub,
                          },
                        },
                      },
                    },
                    {
                      practiceQuiz: {
                        permissions: {
                          some: {
                            userId: ctx.user.sub,
                          },
                        },
                      },
                    },
                    {
                      microLearning: {
                        permissions: {
                          some: {
                            userId: ctx.user.sub,
                          },
                        },
                      },
                    },
                    {
                      groupActivity: {
                        permissions: {
                          some: {
                            userId: ctx.user.sub,
                          },
                        },
                      },
                    },
                  ],
                },
              },
              // count derived permissions to determine if the collection can be deleted
              // (i.e. if other users still have access to it or not)
              permissions: true,
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
    collection._count.linkedTemplates > 0 ||
    collection.ownerId === ctx.user.sub
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

    // TODO: trigger recomputation of derived permissions (combined transaction with the deletion above?)
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

  // verify that the answer collection entry is not linked to any elements
  const entry = await ctx.prisma.answerCollectionEntry.findUnique({
    where: {
      id,
    },
    include: {
      _count: {
        select: {
          itemUsages: true,
        },
      },
    },
  })

  if (!entry || entry._count.itemUsages > 0) {
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
