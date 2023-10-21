import { UserRole } from '@klicker-uzh/prisma'
import { Context } from '../lib/context'
import { AggregatedResponseFlashcard, Correctness } from '../types/app'

export async function getPracticeQuizData(
  { id }: { id: string },
  ctx: Context
) {
  const quiz = await ctx.prisma.practiceQuiz.findUnique({
    where: {
      id,
    },
    include: {
      course: true,
      stacks: {
        include: {
          elements: {
            include:
              ctx.user?.sub && ctx.user.role === UserRole.PARTICIPANT
                ? {
                    responses: {
                      where: {
                        participantId: ctx.user.sub,
                      },
                    },
                  }
                : undefined,
            orderBy: {
              order: 'asc',
            },
          },
        },
        orderBy: {
          order: 'asc',
        },
      },
    },
  })

  if (!quiz) return null

  if (ctx.user?.sub && ctx.user.role === UserRole.PARTICIPANT) {
    // TODO: add time decay as well
    // TODO: adapt the implementation to multiple instances per stack - resorting inside the stack does probably not make sense
    const orderedStacks = quiz.stacks.sort((a, b) => {
      const aResponses = a.elements[0].responses
      const bResponses = b.elements[0].responses

      // place instances, which have never been answered at the front
      if (aResponses.length === 0 && bResponses.length === 0) return 0
      if (aResponses.length === 0) return -1
      if (bResponses.length === 0) return 1
      const aResponse = aResponses[0]
      const bResponse = bResponses[0]

      // sort first according by correctCountStreak ascending, then by correctCount ascending, then by the lastResponseAt from old to new
      if (aResponse.correctCountStreak < bResponse.correctCountStreak) return -1
      if (aResponse.correctCountStreak > bResponse.correctCountStreak) return 1
      if (aResponse.correctCount < bResponse.correctCount) return -1
      if (aResponse.correctCount > bResponse.correctCount) return 1
      if (aResponse.lastCorrectAt < bResponse.lastCorrectAt) return -1
      if (aResponse.lastCorrectAt > bResponse.lastCorrectAt) return 1
      return 0
    })

    return {
      ...quiz,
      stacks: orderedStacks,
    }
  }
  return quiz
}

interface RespondToFlashcardInstanceInput {
  id: number
  courseId: string
  correctness: Correctness
}

export async function respondToFlashcardInstance(
  { id, courseId, correctness }: RespondToFlashcardInstanceInput,
  ctx: Context
) {
  const existingInstance = await ctx.prisma.elementInstance.findUnique({
    where: {
      id,
    },
  })

  if (!existingInstance) return null

  // check if passed correctness value is valid
  if (
    ![Correctness.WRONG, Correctness.PARTIAL, Correctness.CORRECT].includes(
      correctness
    )
  ) {
    return null
  }

  // TODO: also handle the case where the participant is logged in, but has no valid participation in the considered course
  if (!ctx.user?.sub) {
    // TODO: if user is not logged in, do not check the questionResponse, only save it on the instance / update the instance results
    return null
  }

  // update the aggregated data on the element instance
  await ctx.prisma.elementInstance.update({
    where: {
      id,
    },
    data: {
      results: {
        ...existingInstance.results,
        [correctness]: existingInstance.results[correctness] + 1,
        total: existingInstance.results.total + 1,
      },
    },
  })

  // find existing question response to this instance by this user
  const existingResponse = await ctx.prisma.questionResponse.findUnique({
    where: {
      participantId_elementInstanceId: {
        participantId: ctx.user.sub,
        elementInstanceId: id,
      },
    },
  })

  ctx.prisma.questionResponseDetail.create({
    data: {
      response: {
        correctness: correctness,
      },
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
    },
  })

  // TODO: think about possibility to fuse these two cases with a single upsert (however, keep in mind that we need to update JSON stuff here)
  if (existingResponse && existingResponse.aggregatedResponses) {
    let aggregatedResponse =
      existingResponse.aggregatedResponses as AggregatedResponseFlashcard

    aggregatedResponse = {
      ...existingResponse.aggregatedResponses,
      [correctness]: aggregatedResponse[correctness] + 1,
      total: aggregatedResponse.total + 1,
    }

    // update existing response
    const questionResponse = await ctx.prisma.questionResponse.update({
      where: {
        participantId_elementInstanceId: {
          participantId: ctx.user.sub,
          elementInstanceId: id,
        },
      },
      data: {
        trialsCount: {
          increment: 1,
        },
        response: {
          correctness,
        },
        aggregatedResponses: aggregatedResponse,
        correctCount: {
          increment: correctness === 2 ? 1 : 0,
        },
        correctCountStreak: {
          increment:
            correctness === 2 ? 1 : -existingResponse?.correctCountStreak,
        },
        lastCorrectAt: correctness === 2 ? new Date() : undefined,
        participant: {
          connect: { id: ctx.user.sub },
        },
        elementInstance: {
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
      },
    })

    return questionResponse
  } else {
    let aggregatedResponse = {
      [Correctness.WRONG]: 0,
      [Correctness.PARTIAL]: 0,
      [Correctness.CORRECT]: 0,
      total: 0,
    }

    aggregatedResponse = {
      ...aggregatedResponse,
      [correctness]: 1,
    }

    // create new response
    const questionResponse = await ctx.prisma.questionResponse.create({
      data: {
        trialsCount: 1,
        response: {
          correctness,
        },
        aggregatedResponses: aggregatedResponse,
        correctCount: correctness === 2 ? 1 : 0,
        correctCountStreak: correctness === 2 ? 1 : 0,
        lastCorrectAt: correctness === 2 ? new Date() : undefined,
        participant: {
          connect: { id: ctx.user.sub },
        },
        elementInstance: {
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
      },
    })

    return questionResponse
  }
}
