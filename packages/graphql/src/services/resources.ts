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
