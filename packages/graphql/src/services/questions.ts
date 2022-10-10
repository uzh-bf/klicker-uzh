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
    attachments?: { id: string }[]
    tags?: { id: string }[]
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

  console.log('SC QUESTION')
  console.log(
    'inputs',
    id,
    name,
    content,
    contentPlain,
    options,
    attachments,
    tags
  )

  return {
    ...question,
  }
}

// TODO: implement
export async function manipulateMCQuestion(
  {
    id,
    name,
    content,
    contentPlain,
    options,
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
    attachments?: { id: string }[]
    tags?: { id: string }[]
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

  console.log('MC QUESTION')
  console.log(
    'inputs',
    id,
    name,
    content,
    contentPlain,
    options,
    attachments,
    tags
  )

  return {
    ...question,
  }
}

// TODO: implement
export async function manipulateKPRIMQuestion(
  {
    id,
    name,
    content,
    contentPlain,
    options,
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
    attachments: { id: string }[]
    tags: { id: string }[]
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

  console.log('KPRIM QUESTION')
  console.log(
    'inputs',
    id,
    name,
    content,
    contentPlain,
    options,
    attachments,
    tags
  )

  return {
    ...question,
  }
}

// TODO: implement
export async function manipulateNUMERICALQuestion(
  {
    id,
    name,
    content,
    contentPlain,
    options,
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
    attachments?: { id: string }[]
    tags?: { id: string }[]
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
    attachments?: { id: string }[]
    tags?: { id: string }[]
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
    attachments,
    tags
  )

  return {
    ...question,
  }
}
