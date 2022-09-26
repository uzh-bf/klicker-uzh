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
