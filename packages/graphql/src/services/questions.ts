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

export async function editQuestion(
  {
    id,
    name,
    content,
    contentPlain,
    options,
    attachments,
    tags,
  }: {
    id: number
    name: string
    content: string
    contentPlain: string
    options: {
      choices?: {
        ix: number
        value: string
        correct?: boolean
        feedback?: string
      }[]
      restrictions?: { min?: number; max?: number; maxLength?: number }
      solutionRanges?: { min?: number; max?: number }[]
      solutions?: string[]
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

  console.log('question', question)
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
