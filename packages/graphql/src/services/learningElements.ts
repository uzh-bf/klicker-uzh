import {
  gradeQuestionKPRIM,
  gradeQuestionMC,
  gradeQuestionSC,
} from '@klicker-uzh/grading'
import { QuestionType } from '@klicker-uzh/prisma'
import { pick } from 'ramda'
import { ContextWithOptionalUser, ContextWithUser } from '../lib/context'

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
    case QuestionType.MC:
    case QuestionType.KPRIM: {
      const data = questionData as ChoicesQuestionData

      // TODO: feedbacks only for selected options?
      // const feedbacks = questionData.options.choices.filter((choice) =>
      //   response.choices!.includes(choice.ix)
      // )

      const feedbacks = data.options.choices
      const solution = data.options.choices.reduce<number[]>((acc, choice) => {
        if (choice.correct) return [...acc, choice.ix]
        return acc
      }, [])

      if (data.type === QuestionType.SC) {
        const pointsPercentage = gradeQuestionSC({
          responseCount: data.options.choices.length,
          response: response.choices!,
          solution,
        })
        return {
          feedbacks,
          choices: results.choices,
          points: pointsPercentage !== null ? pointsPercentage * 200 : null,
        }
      } else if (data.type === QuestionType.MC) {
        const pointsPercentage = gradeQuestionMC({
          responseCount: data.options.choices.length,
          response: response.choices!,
          solution,
        })
        return {
          feedbacks,
          choices: results.choices,
          points: pointsPercentage !== null ? pointsPercentage * 200 : null,
        }
      } else {
        const pointsPercentage = gradeQuestionKPRIM({
          responseCount: data.options.choices.length,
          response: response.choices!,
          solution,
        })
        return {
          feedbacks,
          choices: results.choices,
          points: pointsPercentage !== null ? pointsPercentage * 200 : null,
        }
      }
    }

    default:
      return null
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
  let evaluation = null

  // TODO: only count the first response in the results? for all remaining, only give feedback? better estimate of the difficulty...
  const updatedInstance = await ctx.prisma.$transaction(async (prisma) => {
    // TODO: award points to the user when correctly responded
    const instance = await prisma.questionInstance.findUnique({
      where: { id },
      include: {
        responses: {
          where: {
            participant: {
              id: ctx.user.sub,
            },
          },
          orderBy: {
            updatedAt: 'desc',
          },
          take: 1,
        },
      },
    })

    const questionData =
      instance?.questionData?.valueOf() as AllQuestionTypeData
    const results = instance?.results?.valueOf() as AllQuestionResults

    if (!questionData) return null

    evaluation = evaluateQuestionResponse(questionData, results, response)

    const updatedResults: {
      choices?: Record<string, number>
    } = {}

    switch (questionData.type) {
      case QuestionType.SC:
      case QuestionType.MC:
      case QuestionType.KPRIM: {
        updatedResults.choices = response.choices!.reduce(
          (acc, ix) => ({
            ...acc,
            [ix]: acc[ix] + 1,
          }),
          results.choices as Record<string, number>
        )

        break
      }

      case QuestionType.NUMERICAL: {
        break
      }

      case QuestionType.FREE_TEXT: {
        break
      }
    }

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
        results: updatedResults,
        participants: {
          increment: 1,
        },
      },
    })
  })

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
      case QuestionType.KPRIM:
        return {
          ...instance,
          questionData: {
            ...questionData,
            options: {
              ...questionData.options,
              // TODO: shuffle the options and the instances?
              // choices: shuffle(
              //   questionData.options.choices.map(pick(['ix', 'value']))
              // ),
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

  // TODO: shuffle the instances?
  // const shuffledInstances = shuffle(instancesWithoutSolution)

  return {
    ...element,
    instances: instancesWithoutSolution,
  }
}
