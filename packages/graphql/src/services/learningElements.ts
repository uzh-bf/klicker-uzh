import { QuestionType } from '@klicker-uzh/prisma'
import { pick } from 'ramda'
import { ContextWithUser } from '../lib/context'

interface RespondToQuestionInstanceArgs {
  id: string
  response: {
    choices?: number[]
    value?: string
  }
}

export async function respondToQuestionInstance(
  { id, response }: RespondToQuestionInstanceArgs,
  ctx: ContextWithUser
) {
  // TODO: compare the solution with the answer
  // TODO: award points to the user when correctly responded
  // TODO: return the result, evaluation, and feedback and correctness
  const instance = await ctx.prisma.questionInstance.findUnique({
    where: { id },
  })

  console.warn(id, instance, response)

  return {
    ...instance,
    evaluation: {
      choices: {
        0: 50,
        1: 5,
        2: 2,
        3: 15,
        4: 28,
      },
    },
  }
}

interface GetLearningElementDataArgs {
  id: string
}

export async function getLearningElementData(
  { id }: GetLearningElementDataArgs,
  ctx: ContextWithUser
) {
  // TODO: get previous responses of the participant

  const element = await ctx.prisma.learningElement.findUnique({
    where: { id },
    include: {
      course: true,
      instances: true,
    },
  })

  const instancesWithoutSolution = element?.instances.map((instance) => {
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
              choices: questionData.options.choices.map(pick(['value'])),
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
    ...element,
    instances: instancesWithoutSolution,
  }
}
