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
            updatedAt: 'desc',
          },
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
          'contentPlain',
          'isArchived',
          'isDeleted',
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

// TODO: implement
export async function manipulateSCQuestion(
  {
    id,
    name,
    content,
    contentPlain,
    options,
    hasSampleSolution,
    hasAnswerFeedbacks,
    attachments,
    tags,
  }: {
    id?: number
    name?: string
    content?: string
    contentPlain?: string
    options?: {
      choices: {
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
  const question = await ctx.prisma.question.upsert({
    where: {
      id: id,
    },
    create: {
      type: 'SC',
      name: name || 'Missing Question Title',
      content: content || 'Missing Question Content',
      contentPlain: contentPlain || 'Missing Question Content',
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
      contentPlain: contentPlain,
      hasSampleSolution: hasSampleSolution || false,
      hasAnswerFeedbacks: hasAnswerFeedbacks || false,
      options: options,
      tags: {
        // TODO: disconnect unused and potentially previously used tags
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
  })

  // TODO: fix invalidation of cache
  ctx.emitter.emit('invalidate', {
    typename: 'Question',
    id: question.id,
  })

  return question
}

// TODO: implement
export async function manipulateMCQuestion(
  {
    id,
    name,
    content,
    contentPlain,
    options,
    hasSampleSolution,
    hasAnswerFeedbacks,
    attachments,
    tags,
  }: {
    id?: number
    name?: string
    content?: string
    contentPlain?: string
    options?: {
      choices: {
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
  const question = await ctx.prisma.question.upsert({
    where: {
      id: id,
    },
    create: {
      type: 'MC',
      name: name || 'Missing Question Title',
      content: content || 'Missing Question Content',
      contentPlain: contentPlain || 'Missing Question Content',
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
      contentPlain: contentPlain,
      hasSampleSolution: hasSampleSolution || false,
      hasAnswerFeedbacks: hasAnswerFeedbacks || false,
      options: options,
      tags: {
        // TODO: disconnect unused and potentially previously used tags
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
  })

  // TODO: fix invalidation of cache
  ctx.emitter.emit('invalidate', {
    typename: 'Question',
    id: question.id,
  })

  return question
}

export async function manipulateKPRIMQuestion(
  {
    id,
    name,
    content,
    contentPlain,
    options,
    hasSampleSolution,
    hasAnswerFeedbacks,
    attachments,
    tags,
  }: {
    id?: number
    name?: string
    content?: string
    contentPlain?: string
    options?: {
      choices: {
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
  const question = await ctx.prisma.question.upsert({
    where: {
      id: id,
    },
    create: {
      type: 'KPRIM',
      name: name || 'Missing Question Title',
      content: content || 'Missing Question Content',
      contentPlain: contentPlain || 'Missing Question Content',
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
      contentPlain: contentPlain,
      hasSampleSolution: hasSampleSolution || false,
      hasAnswerFeedbacks: hasAnswerFeedbacks || false,
      options: options,
      tags: {
        // TODO: disconnect unused and potentially previously used tags
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
  })

  // TODO: fix invalidation of cache
  ctx.emitter.emit('invalidate', {
    typename: 'Question',
    id: question.id,
  })

  return question
}

// TODO: implement
export async function manipulateNUMERICALQuestion(
  {
    id,
    name,
    content,
    contentPlain,
    options,
    hasSampleSolution,
    hasAnswerFeedbacks,
    attachments,
    tags,
  }: {
    id?: number
    name?: string
    content?: string
    contentPlain?: string
    options?: {
      restrictions?: { min?: number; max?: number }
      solutionRanges?: { min?: number; max?: number }[]
    }
    hasSampleSolution?: boolean
    hasAnswerFeedbacks?: boolean
    attachments?: { id: string }[]
    tags?: string[]
  },
  ctx: ContextWithUser
) {
  // TODO: implement update of question with provided parameters
  const question = await ctx.prisma.question.findUnique({
    where: {
      id: id,
    },
    include: {
      tags: true,
      attachments: true,
    },
  })

  console.log('NUMERICAL QUESTION')
  console.log(
    'inputs',
    id,
    name,
    content,
    contentPlain,
    options,
    hasSampleSolution,
    hasAnswerFeedbacks,
    attachments,
    tags
  )

  return {
    ...question,
  }
}

// TODO: implement
export async function manipulateFREETEXTQuestion(
  {
    id,
    name,
    content,
    contentPlain,
    options,
    hasSampleSolution,
    hasAnswerFeedbacks,
    attachments,
    tags,
  }: {
    id?: number
    name?: string
    content?: string
    contentPlain?: string
    options?: {
      restrictions?: { maxLength?: number }
      solutions?: string[]
    }
    hasSampleSolution?: boolean
    hasAnswerFeedbacks?: boolean
    attachments?: { id: string }[]
    tags?: string[]
  },
  ctx: ContextWithUser
) {
  // TODO: implement update of question with provided parameters
  const question = await ctx.prisma.question.findUnique({
    where: {
      id: id,
    },
    include: {
      tags: true,
      attachments: true,
    },
  })

  console.log('FREE_TEXT QUESTION')
  console.log(
    'inputs',
    id,
    name,
    content,
    contentPlain,
    options,
    hasSampleSolution,
    hasAnswerFeedbacks,
    attachments,
    tags
  )

  return {
    ...question,
  }
}
