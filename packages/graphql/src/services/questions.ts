import * as DB from '@klicker-uzh/prisma'
import { Context, ContextWithUser } from '../lib/context'

export async function getUserQuestions(ctx: ContextWithUser) {
  const userQuestions = await ctx.prisma.user.findUnique({
    where: {
      id: ctx.user.sub,
    },
    include: {
      questions: {
        orderBy: [
          {
            createdAt: 'desc',
          },
        ],
        include: {
          tags: true,
        },
      },
    },
  })

  return userQuestions?.questions
}

export async function getSingleQuestion(
  { id }: { id: number },
  ctx: ContextWithUser
) {
  const question = await ctx.prisma.question.findUnique({
    where: {
      id,
    },
    include: {
      tags: true,
      attachments: true,
    },
  })

  if (!question) return null

  return {
    ...question,
    questionData: question,
  }
}

export async function manipulateQuestion(
  {
    id,
    type,
    name,
    content,
    explanation,
    options,
    hasSampleSolution,
    hasAnswerFeedbacks,
    pointsMultiplier,
    attachments,
    tags,
    displayMode,
  }: {
    id?: number | null
    type: DB.QuestionType
    name?: string | null
    content?: string | null
    explanation?: string | null
    options?: {
      unit?: string
      accuracy?: number
      placeholder?: string
      restrictions?: {
        maxLength?: number
        minLength?: number
        pattern?: string
        min?: number
        max?: number
      }
      feedback?: string
      solutionRanges?: { min?: number; max?: number }[]
      solutions?: string[]
      choices?: {
        ix: number
        value: string
        correct?: boolean
        feedback?: string
      }[]
    } | null
    hasSampleSolution?: boolean | null
    hasAnswerFeedbacks?: boolean | null
    pointsMultiplier?: number | null
    attachments?: { id: string }[] | null
    tags?: string[] | null
    displayMode?: DB.QuestionDisplayMode | null
  },
  ctx: ContextWithUser
) {
  let tagsToDelete: string[] = []

  const questionPrev = id
    ? await ctx.prisma.question.findUnique({
        where: {
          id: id,
        },
        include: {
          tags: true,
          attachments: true,
        },
      })
    : undefined

  if (questionPrev?.tags) {
    tagsToDelete = questionPrev.tags
      .filter((tag) => !tags?.includes(tag.name))
      .map((tag) => tag.name)
  }

  const question = await ctx.prisma.question.upsert({
    where: {
      id: id || -1,
    },
    create: {
      type: type,
      name: name ?? 'Missing Question Title',
      content: content ?? 'Missing Question Content',
      explanation: explanation ?? undefined,
      hasSampleSolution: hasSampleSolution ?? false,
      hasAnswerFeedbacks: hasAnswerFeedbacks ?? false,
      pointsMultiplier: pointsMultiplier ?? 1,
      displayMode: displayMode ?? undefined,
      options: options || {},
      owner: {
        connect: {
          id: ctx.user.sub,
        },
      },
      // connect to the tags which already exist by name and otherwise create a new tag with the given name
      tags: {
        connectOrCreate: tags?.map((tag: string) => {
          return {
            where: {
              ownerId_name: {
                ownerId: ctx.user.sub,
                name: tag,
              },
            },
            create: { name: tag, owner: { connect: { id: ctx.user.sub } } },
          }
        }),
      },
      // TODO: create / connect attachments
    },
    update: {
      name: name ?? undefined,
      content: content ?? undefined,
      explanation: explanation ?? undefined,
      hasSampleSolution: hasSampleSolution ?? false,
      hasAnswerFeedbacks: hasAnswerFeedbacks ?? false,
      pointsMultiplier: pointsMultiplier ?? 1,
      options: options ?? undefined,
      displayMode: displayMode ?? undefined,
      tags: {
        connectOrCreate: tags
          ?.filter((tag: string) => tag !== '')
          .map((tag: string) => {
            return {
              where: {
                ownerId_name: {
                  ownerId: ctx.user.sub,
                  name: tag,
                },
              },
              create: { name: tag, owner: { connect: { id: ctx.user.sub } } },
            }
          }),
        disconnect: tagsToDelete.map((tag) => {
          return {
            ownerId_name: {
              ownerId: ctx.user.sub,
              name: tag,
            },
          }
        }),
      },
      // TODO: create / connect / disconnect attachments
    },
    include: {
      tags: true,
      attachments: true,
    },
  })

  // TODO: fix invalidation of cache
  ctx.emitter.emit('invalidate', {
    typename: 'Question',
    id: question.id,
  })

  return {
    ...question,
    questionData: question,
  }
}

export async function deleteQuestion({ id }: { id: number }, ctx: Context) {
  const question = await ctx.prisma.question.delete({
    where: {
      id: id,
    },
  })

  ctx.emitter.emit('invalidate', {
    typename: 'Question',
    id: question.id,
  })

  return question
}

export async function getUserTags(ctx: ContextWithUser) {
  const user = await ctx.prisma.user.findUnique({
    where: {
      id: ctx.user.sub,
    },
    include: {
      tags: true,
    },
  })

  if (!user) {
    return []
  }

  return user.tags
}

export async function editTag(
  { id, name }: { id: number; name: string },
  ctx: Context
) {
  const tag = await ctx.prisma.tag.update({
    where: {
      id: id,
    },
    data: {
      name: name,
    },
  })

  return tag
}

export async function deleteTag({ id }: { id: number }, ctx: Context) {
  const tag = await ctx.prisma.tag.delete({
    where: {
      id: id,
    },
  })

  ctx.emitter.emit('invalidate', {
    typename: 'Tag',
    id: tag.id,
  })

  return tag
}
