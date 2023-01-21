import { QuestionType } from '@klicker-uzh/prisma'
import { pick } from 'ramda'
import { ContextWithUser } from '../lib/context'

export async function getUserQuestions(
  { userId }: { userId: string },
  ctx: ContextWithUser
) {
  const userQuestions = await ctx.prisma.user.findUnique({
    where: {
      id: userId,
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

  return userQuestions?.questions.map((question) => {
    return {
      ...pick(
        [
          'id',
          'name',
          'type',
          'content',
          'isArchived',
          'isDeleted',
          'hasSampleSolution',
          'hasAnswerFeedbacks',
          'createdAt',
          'updatedAt',
        ],
        question
      ),
      tags: question.tags.map(pick(['id', 'name'])),
    }
  })
}

export async function getSingleQuestion(
  { id }: { id: number },
  ctx: ContextWithUser
) {
  const question = await ctx.prisma.question.findUnique({
    where: {
      id: id,
    },
    include: {
      tags: true,
      attachments: true,
    },
  })

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
    options,
    hasSampleSolution,
    hasAnswerFeedbacks,
    attachments,
    tags,
  }: {
    id?: number
    type: QuestionType
    name?: string
    content?: string
    options?: {
      restrictions?: { maxLength?: number; min?: number; max?: number }
      solutionRanges?: { min?: number; max?: number }[]
      solutions?: string[]
      choices?: {
        ix: number
        value: string
        correct?: boolean
        feedback?: string
      }[]
    }
    hasSampleSolution?: boolean
    hasAnswerFeedbacks?: boolean
    attachments?: { id: string }[]
    tags?: string[]
  },
  ctx: ContextWithUser
) {
  let tagsToDelete: string[] = []

  const questionOLD = id
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

  if (questionOLD && questionOLD?.tags) {
    tagsToDelete = questionOLD.tags
      .filter((tag) => !tags?.includes(tag.name))
      .map((tag) => tag.name)
  }

  // TODO: replace the conditional implementation above with the single upsert below - up to now it failed because "where did not receive an argument when id was undefined"
  const question = await ctx.prisma.question.upsert({
    where: {
      id: id || -1,
    },
    create: {
      type: type,
      name: name || 'Missing Question Title',
      content: content || 'Missing Question Content',
      hasSampleSolution: hasSampleSolution || false,
      hasAnswerFeedbacks: hasAnswerFeedbacks || false,
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
      name: name,
      content: content,
      hasSampleSolution: hasSampleSolution || false,
      hasAnswerFeedbacks: hasAnswerFeedbacks || false,
      options: options,
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

export async function deleteQuestion(
  { id }: { id: number },
  ctx: ContextWithUser
) {
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
  ctx: ContextWithUser
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
