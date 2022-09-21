import { QuestionType } from '@klicker-uzh/prisma'
import { pick } from 'ramda'
import { ContextWithUser } from '../lib/context'

interface GetMicroSessionDataArgs {
  id: string
}

export async function getMicroSessionData(
  { id }: GetMicroSessionDataArgs,
  ctx: ContextWithUser
) {
  const microSession = await ctx.prisma.microSession.findUnique({
    where: { id },
    include: {
      course: true,
      instances: {
        orderBy: {
          questionId: 'asc',
        },
      },
    },
  })

  if (!microSession) return null

  const instancesWithoutSolution = microSession.instances.map((instance) => {
    const questionData = instance.questionData?.valueOf() as AllQuestionTypeData
    if (
      !questionData ||
      typeof questionData !== 'object' ||
      Array.isArray(questionData)
    )
      return instance

    switch (questionData.type) {
      case QuestionType.SC:
      case QuestionType.MC:
      case QuestionType.KPRIM:
        return {
          ...instance,
          questionData: {
            ...questionData,
            options: {
              ...questionData.options,
              choices: questionData.options.choices.map(pick(['ix', 'value'])),
            },
          },
        }

      case QuestionType.FREE_TEXT:
        return instance

      case QuestionType.NUMERICAL:
        return instance

      default:
        return instance
    }
  })

  return {
    ...microSession,
    instances: instancesWithoutSolution,
  }
}

interface MarkMicroSessionCompletedArgs {
  courseId: string
  id: string
}

export async function markMicroSessionCompleted(
  { courseId, id }: MarkMicroSessionCompletedArgs,
  ctx: ContextWithUser
) {
  return ctx.prisma.participation.update({
    where: {
      courseId_participantId: {
        courseId,
        participantId: ctx.user.sub,
      },
    },
    data: {
      completedMicroSessions: {
        push: id,
      },
    },
  })
}
