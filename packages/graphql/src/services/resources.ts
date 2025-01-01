import * as DB from '@klicker-uzh/prisma'
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

export async function getAnswerCollections(ctx: ContextWithUser) {
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
          _count: {
            select: {
              accessGranted: true,
            },
          },
        },
        orderBy: {
          name: 'asc',
        },
      },
      sharedCollections: {
        include: {
          entries: {
            orderBy: {
              value: 'asc',
            },
          },
          owner: {
            select: {
              shortname: true,
            },
          },
        },
        orderBy: {
          name: 'asc',
        },
      },
      requestedCollections: {
        include: {
          owner: {
            select: {
              shortname: true,
            },
          },
        },
        orderBy: {
          name: 'asc',
        },
      },
    },
  })

  if (!user) {
    return null
  }

  return {
    answerCollections: user.answerCollections.map((collection) => ({
      ...collection,
      numSharedUsers: collection._count?.accessGranted,
    })),
    sharedCollections: user.sharedCollections.map((collection) => ({
      ...collection,
      ownerShortname: collection.owner?.shortname,
    })),
    requestedCollections: user.requestedCollections.map((collection) => ({
      ...collection,
      ownerShortname: collection.owner?.shortname,
    })),
  }
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
          accessGranted: true,
        },
      },
    },
  })

  if (!collection) {
    return null
  }

  // if other users are already using the collection, their access rights must not be restricted
  const numSharedUsers = collection._count?.accessGranted ?? 0
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

  // update changes in the database
  const updatedCollection = await ctx.prisma.answerCollection.update({
    where: {
      id,
      ownerId: ctx.user.sub,
    },
    data: {
      name: name ?? undefined,
      access: access ?? undefined,
      description: description ?? undefined,
    },
    include: {
      entries: true,
    },
  })

  return {
    ...updatedCollection,
    numSharedUsers,
  }
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
  const updatedEntry = await ctx.prisma.answerCollectionEntry.update({
    where: {
      id,
    },
    data: {
      value,
    },
  })

  return updatedEntry
}

export async function deleteAnswerCollectionEntry(
  { id }: { id: number },
  ctx: ContextWithUser
) {
  const updatedEntry = await ctx.prisma.answerCollectionEntry.delete({
    where: {
      id,
    },
  })

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

  return newEntry
}
