import { QuestionType } from '@klicker-uzh/prisma'
import { pick } from 'ramda'
import { ContextWithOptionalUser, ContextWithUser } from '../lib/context'
import { shuffle } from '../lib/util'

type QuestionResponse = {
  choices?: number[]
  value?: string
}

function evaluateQuestionResponse(
  questionData: AllQuestionTypeData,
  results: any,
  response: QuestionResponse
) {
  switch (questionData.type) {
    case QuestionType.SC:
    case QuestionType.MC: {
      const feedbacks = questionData.options.choices.filter((choice) =>
        response.choices!.includes(choice.ix)
      )

      return {
        evaluation: {
          feedbacks,
          choices: results.choices,
        },
      }
    }

    default:
      return {
        evaluation: null,
      }
  }
}

interface RespondToQuestionInstanceArgs {
  courseId: string
  id: number
  response: QuestionResponse
}

export async function respondToQuestionInstance(
  { courseId, id, response }: RespondToQuestionInstanceArgs,
  ctx: ContextWithUser
) {
  // TODO: if logged in and participating again, decrement the previous choice and increment the new one?
  // TODO: only count the first response in the results? for all remaining, only give feedback? better estimate of the difficulty...
  const updatedInstance = await ctx.prisma.$transaction(async (prisma) => {
    // TODO: award points to the user when correctly responded
    const instance = await prisma.questionInstance.findUnique({
      where: { id },
    })

    if (!instance) return null

    const results = instance.results?.valueOf() as AllQuestionResults

    // TODO: handle the different question types

    const choices = response.choices?.reduce(
      (acc, ix) => ({
        ...acc,
        [ix]: acc[ix] + 1,
      }),
      results.choices as Record<string, number>
    )

    prisma.questionResponse.upsert({
      where: {
        participantId_questionInstanceId: {
          participantId: ctx.user.sub,
          questionInstanceId: id,
        },
      },
      create: {
        response,
        participant: {
          connect: { id: ctx.user.sub },
        },
        questionInstance: {
          connect: { id },
        },
        participation: {
          connect: {
            courseId_participantId: {
              courseId,
              participantId: ctx.user.sub,
            },
          },
        },
        trialsCount: 1,
      },
      update: {
        response,
        trialsCount: {
          increment: 1,
        },
      },
    })

    return prisma.questionInstance.update({
      where: { id },
      data: {
        results: {
          choices,
        },
        participants: {
          increment: 1,
        },
      },
    })
  })

  const { evaluation } = evaluateQuestionResponse(
    updatedInstance?.questionData?.valueOf() as AllQuestionTypeData,
    updatedInstance?.results?.valueOf() as AllQuestionResults,
    response
  )

  return {
    ...updatedInstance,
    evaluation,
  }
}

interface GetLearningElementDataArgs {
  id: string
}

export async function getLearningElementData(
  { id }: GetLearningElementDataArgs,
  ctx: ContextWithOptionalUser
) {
  // TODO: get previous responses of the participant (last three days)
  // TODO: ensure that previously answered are marked and shuffled to the end

  const element = await ctx.prisma.learningElement.findUnique({
    where: { id },
    include: {
      course: true,
      instances: true,
    },
  })

  if (!element) return null

  const instancesWithoutSolution = element.instances.map((instance) => {
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

  const shuffledInstances = shuffle(instancesWithoutSolution)

  return {
    ...element,
    instances: shuffledInstances,
  }
}
