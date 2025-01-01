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
    answerCollections: user.answerCollections,
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
