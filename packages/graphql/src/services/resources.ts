import * as DB from '@klicker-uzh/prisma'
import { AccessType, AnswerCollectionSharingRequest } from '@klicker-uzh/types'
import type { ContextWithUser } from '../lib/context.js'

export async function createAnswerCollection(
  {
    name,
    access,
    description,
    answers,
  }: {
    name: string
    access: DB.CollectionAccess
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

  return { ...newCollection, ownerShortname: newCollection.owner?.shortname }
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
                  solutionUsages: true,
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
                      solutionUsages: true,
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
    entries: collection.entries.map((entry) => ({
      ...entry,
      numSolutionUsages: entry._count?.solutionUsages,
    })),
    numSharedUsers: collection._count?.permissions,
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
      entries:
        object.permissionStatus === DB.PermissionStatus.GRANTED
          ? collection.entries.map((entry) => ({
              ...entry,
              numSolutionUsages:
                object.accessLevel === DB.AccessLevel.WRITE
                  ? entry._count?.solutionUsages
                  : null,
            }))
          : undefined,
      ownerShortname: collection.owner?.shortname,
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
  }: {
    id: number
    name?: string | null
    access?: DB.CollectionAccess | null
    description?: string | null
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

  // if other users are already using the collection, their access rights must not be restricted
  let numSharedUsers = collection._count.permissions
  if (
    (numSharedUsers > 0 &&
      (collection.access === DB.CollectionAccess.RESTRICTED ||
        collection.access === DB.CollectionAccess.PUBLIC) &&
      access === DB.CollectionAccess.PRIVATE) ||
    (numSharedUsers > 0 &&
      collection.access === DB.CollectionAccess.PUBLIC &&
      access === DB.CollectionAccess.RESTRICTED)
  ) {
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
      },
      include: {
        entries: true,
      },
    })

    // if access is changed from restricted to public, accept all access requests
    if (
      collection.access === DB.CollectionAccess.RESTRICTED &&
      access === DB.CollectionAccess.PUBLIC
    ) {
      await Promise.all(
        collection.permissions.map((permission) =>
          tx.permission.update({
            where: {
              id: permission.id,
            },
            data: {
              permissionStatus: DB.PermissionStatus.GRANTED,
            },
          })
        )
      )

      // update number of shared users
      numSharedUsers += collection.permissions.length
    }

    return {
      ...updateResult,
      numSharedUsers,
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
  // fetch answer collection as user
  const collection = await ctx.prisma.answerCollection.findUnique({
    where: {
      id: collectionId,
    },
    include: {
      _count: {
        select: {
          linkedElements: {
            where: {
              ownerId: ctx.user.sub,
            },
          },
          accessGranted: true,
        },
      },
    },
  })

  // if collection does not exist, is linked to own elements, or does belong to the user, do not allow removal
  if (
    !collection ||
    collection._count.linkedElements > 0 ||
    collection.ownerId === ctx.user.sub
  ) {
    return null
  }

  // if no other users have access to this collection and the owner is already disconnected, delete it
  let updatedCollection: DB.AnswerCollection
  if (collection._count.accessGranted === 1 && collection.ownerId === null) {
    updatedCollection = await ctx.prisma.answerCollection.delete({
      where: {
        id: collectionId,
      },
    })
  } else {
    // otherwise, disconnect the collection from the user
    updatedCollection = await ctx.prisma.answerCollection.update({
      where: {
        id: collectionId,
      },
      data: {
        accessGranted: {
          disconnect: {
            id: ctx.user.sub,
          },
        },
      },
    })
  }

  ctx.emitter.emit('invalidate', {
    typename: 'AnswerCollection',
    id: collectionId,
  })

  return updatedCollection.id
}

export async function incrementCollectionVersion(
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

export async function getAnswerCollectionSelection(ctx: ContextWithUser) {
  const collections = await ctx.prisma.answerCollection.findMany({
    where: {
      access: {
        in: [DB.CollectionAccess.PUBLIC, DB.CollectionAccess.RESTRICTED],
      },
      ownerId: {
        not: ctx.user.sub,
      },
    },
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
      accessGranted: {
        where: {
          id: ctx.user.sub,
        },
      },
      accessRequested: {
        where: {
          id: ctx.user.sub,
        },
      },
    },
  })

  return collections
    .filter(
      (collection) =>
        // do not show collections that the user already has access to / requested
        collection.accessGranted.length === 0 &&
        collection.accessRequested.length === 0 &&
        collection.ownerId !== null // do not show collections where no user can give access anymore
    )
    .map((collection) => ({
      ...collection,
      entries:
        collection.access === DB.CollectionAccess.PUBLIC
          ? collection.entries
          : [],
      ownerShortname: collection.owner?.shortname,
    }))
}

export async function importAnswerCollection(
  { collectionId }: { collectionId: number },
  ctx: ContextWithUser
) {
  // get answer collection and verify public access
  const collection = await ctx.prisma.answerCollection.findUnique({
    where: {
      id: collectionId,
    },
  })

  if (!collection || collection.access !== DB.CollectionAccess.PUBLIC) {
    return null
  }

  // add user to the shared users of the collection
  const updatedCollection = await ctx.prisma.answerCollection.update({
    where: {
      id: collectionId,
    },
    data: {
      accessGranted: {
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
      entries: {
        orderBy: {
          value: 'asc',
        },
      },
    },
  })

  return {
    ...updatedCollection,
    ownerShortname: updatedCollection.owner?.shortname,
  }
}

export async function requestAnswerCollection(
  { collectionId }: { collectionId: number },
  ctx: ContextWithUser
) {
  // verify that the answer collection is restricted and that the user does not already have access / requested it
  const collection = await ctx.prisma.answerCollection.findUnique({
    where: {
      id: collectionId,
      ownerId: {
        not: null,
      },
    },
    include: {
      accessGranted: {
        where: {
          id: ctx.user.sub,
        },
      },
      accessRequested: {
        where: {
          id: ctx.user.sub,
        },
      },
    },
  })

  if (
    !collection ||
    collection.access !== DB.CollectionAccess.RESTRICTED ||
    collection.accessGranted.length > 0 ||
    collection.accessRequested.length > 0
  ) {
    return null
  }

  const updatedCollection = await ctx.prisma.answerCollection.update({
    where: {
      id: collectionId,
    },
    data: {
      accessRequested: {
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

  // TODO: notify owner of the collection by e-mail that there is a new access request

  return {
    ...updatedCollection,
    ownerShortname: updatedCollection.owner?.shortname,
  }
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
  const collection = await ctx.prisma.answerCollection.findUnique({
    where: {
      id: collectionId,
    },
    include: {
      accessRequested: {
        where: {
          id: ctx.user.sub,
        },
      },
    },
  })

  if (!collection || collection.accessRequested.length === 0) {
    return null
  }

  // remove the user from the access requested list
  const updatedCollection = await ctx.prisma.answerCollection.update({
    where: {
      id: collectionId,
    },
    data: {
      accessRequested: {
        disconnect: {
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

  ctx.emitter.emit('invalidate', {
    typename: 'AnswerCollection',
    id: collectionId,
  })

  return updatedCollection.id
}

export async function getCollectionSharingRequests(ctx: ContextWithUser) {
  const user = await ctx.prisma.user.findUnique({
    where: {
      id: ctx.user.sub,
    },
    include: {
      answerCollections: {
        include: {
          accessRequested: true,
        },
      },
    },
  })

  if (!user) {
    return null
  }

  const requestedCollections = user.answerCollections.reduce<
    AnswerCollectionSharingRequest[]
  >((acc, collection) => {
    const innerRequests = collection.accessRequested.map((request) => ({
      collectionId: collection.id,
      collectionName: collection.name,
      userId: request.id,
      userShortname: request.shortname,
      userEmail: request.email,
    }))

    acc.push(...innerRequests)
    return acc
  }, [])

  return requestedCollections
}

export async function resolveCollectionSharingRequest(
  {
    collectionId,
    userId,
    approved,
  }: {
    collectionId: number
    userId: string
    approved: boolean
  },
  ctx: ContextWithUser
) {
  const collection = await ctx.prisma.answerCollection.findUnique({
    where: {
      id: collectionId,
      ownerId: ctx.user.sub,
    },
    include: {
      accessRequested: {
        where: {
          id: userId,
        },
      },
    },
  })

  // check that the collection exists and that the user has requested access
  if (!collection || collection.accessRequested.length === 0) {
    return null
  }

  // update the collection with the new access rights
  const updatedCollection = await ctx.prisma.answerCollection.update({
    where: {
      id: collectionId,
    },
    data: {
      accessRequested: { disconnect: { id: userId } },
      accessGranted: approved ? { connect: { id: userId } } : undefined,
    },
  })

  // TODO: send email to user that requested access about the approval / (and denial?)

  return {
    collectionId: updatedCollection.id,
    userId,
  }
}
