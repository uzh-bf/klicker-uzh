import { UserRole } from '@klicker-uzh/prisma'
import * as R from 'ramda'
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
    // const orderedStacks = quiz.stacks.toSorted((a, b) => { // TODO: use once nodejs 20 is used
    const orderedStacks = R.sort((a, b) => {
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
    }, quiz.stacks)

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

  const participation = ctx.user?.sub
    ? await ctx.prisma.participation.findUnique({
        where: {
          courseId_participantId: {
            courseId,
            participantId: ctx.user.sub,
          },
        },
        include: {
          participant: true,
        },
      })
    : null

  // update the aggregated data on the element instance
  await ctx.prisma.elementInstance.update({
    where: {
      id,
    },
    data: {
      results: {
        ...existingInstance.results,
        [correctness]: (existingInstance.results[correctness] ?? 0) + 1,
        total: existingInstance.results.total + 1,
      },
    },
  })

  if (!ctx.user?.sub || !participation) {
    return null
  }

  // find existing question response to this instance by this user
  const existingResponse = await ctx.prisma.questionResponse.findUnique({
    where: {
      participantId_elementInstanceId: {
        participantId: ctx.user.sub,
        elementInstanceId: id,
      },
    },
  })

  await ctx.prisma.questionResponseDetail.create({
    data: {
      response: {
        correctness: correctness,
      },
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

  // TODO: think about possibility to fuse these two cases with a single upsert (however, keep in mind that we need to update JSON stuff here)
  if (existingResponse && existingResponse.aggregatedResponses) {
    let aggregatedResponse =
      existingResponse.aggregatedResponses as AggregatedResponseFlashcard

    // update existing response
    const questionResponse = await ctx.prisma.questionResponse.update({
      where: {
        participantId_elementInstanceId: {
          participantId: ctx.user.sub,
          elementInstanceId: id,
        },
      },
      data: {
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

        // RESPONSE
        response: {
          correctness,
        },
        aggregatedResponses: {
          ...existingResponse.aggregatedResponses,
          [correctness]: aggregatedResponse[correctness] + 1,
          total: aggregatedResponse.total + 1,
        },

        trialsCount: {
          increment: 1,
        },

        // CORRECT
        correctCount: {
          increment: correctness === Correctness.CORRECT ? 1 : 0,
        },
        correctCountStreak: {
          increment:
            correctness === Correctness.CORRECT
              ? 1
              : -existingResponse?.correctCountStreak,
        },
        lastCorrectAt:
          correctness === Correctness.CORRECT ? new Date() : undefined,

        // PARTIALLY CORRECT
        partialCorrectCount: {
          increment: correctness === Correctness.PARTIAL ? 1 : 0,
        },
        lastPartialCorrectAt:
          correctness === Correctness.PARTIAL ? new Date() : undefined,

        // WRONG
        wrongCount: {
          increment: correctness === Correctness.WRONG ? 1 : 0,
        },
        lastWrongAt: correctness === Correctness.WRONG ? new Date() : undefined,
      },
    })

    return questionResponse
  } else {
    // create new response
    const questionResponse = await ctx.prisma.questionResponse.create({
      data: {
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

        // RESPONSE
        response: {
          correctness,
        },
        aggregatedResponses: {
          [Correctness.WRONG]: 0,
          [Correctness.PARTIAL]: 0,
          [Correctness.CORRECT]: 0,
          total: 1,
          [correctness]: 1,
        },

        trialsCount: 1,

        // CORRECT
        correctCount: correctness === Correctness.CORRECT ? 1 : 0,
        correctCountStreak: correctness === Correctness.CORRECT ? 1 : 0,
        lastCorrectAt:
          correctness === Correctness.CORRECT ? new Date() : undefined,

        // PARTIALLY CORRECT
        partialCorrectCount: correctness === Correctness.PARTIAL ? 1 : 0,
        lastPartialCorrectAt:
          correctness === Correctness.PARTIAL ? new Date() : undefined,

        // WRONG
        wrongCount: correctness === Correctness.WRONG ? 1 : 0,
        lastWrongAt: correctness === Correctness.WRONG ? new Date() : undefined,
      },
    })

    return questionResponse
  }
}
