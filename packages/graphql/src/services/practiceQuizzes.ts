import { UserRole } from '@klicker-uzh/prisma'
import { AggregatedResponseFlashcard } from 'src/types/app'
import { Context } from '../lib/context'

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
              ctx.user?.sub && ctx.user?.role === UserRole.PARTICIPANT
                ? {
                    responses: {
                      where: {
                        participantId: ctx.user?.sub,
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

  if (ctx.user?.sub && ctx.user?.role === UserRole.PARTICIPANT) {
    // TODO: add time decay as well
    const orderedStacks = quiz.stacks.sort((a, b) => {
      const aResponses = a.elements[0].responses
      const bResponses = b.elements[0].responses

      if (aResponses.length === 0 && bResponses.length === 0) return 0
      if (aResponses.length === 0) return -1
      if (bResponses.length === 0) return 1
      const aResponse = aResponses[0]
      const bResponse = bResponses[0]

      if (aResponse.correctCount === bResponse.correctCount) {
        return aResponse.correctCountStreak - bResponse.correctCountStreak
      }

      return aResponse.correctCount - bResponse.correctCount
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
  correctness: number
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

  // 0 = wrong, 1 = partial, 2 = correct
  if (![0, 1, 2].includes(correctness)) {
    return null
  }

  // TODO: also handle the case where the participant is logged in, but has no valid participation in the considered course
  if (!ctx.user?.sub) {
    // TODO: if user is not logged in, do not check the questionResponse, only save it on the instance / update the instance results
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

  let questionResponse = null

  // TODO: think about possibility to fuse these two cases with a single upsert (however, keep in mind that we need to update JSON stuff here)
  if (existingResponse) {
    let aggregatedResponse =
      existingResponse.response as AggregatedResponseFlashcard
    switch (correctness) {
      case 0:
        aggregatedResponse = {
          ...aggregatedResponse,
          wrong: aggregatedResponse.wrong + 1,
          total: aggregatedResponse.total + 1,
        }
        break
      case 1:
        aggregatedResponse = {
          ...aggregatedResponse,
          partial: aggregatedResponse.partial + 1,
          total: aggregatedResponse.total + 1,
        }
        break
      case 2:
        aggregatedResponse = {
          ...aggregatedResponse,
          correct: aggregatedResponse.correct + 1,
          total: aggregatedResponse.total + 1,
        }
        break
    }

    // update existing response
    questionResponse = await ctx.prisma.questionResponse.update({
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
            correctness === 2 ? 1 : -existingResponse.correctCountStreak,
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
  } else {
    let aggregatedResponse = {
      wrong: 0,
      partial: 0,
      correct: 0,
      total: 0,
    }

    switch (correctness) {
      case 0:
        aggregatedResponse = {
          wrong: 1,
          partial: 0,
          correct: 0,
          total: 1,
        }
        break
      case 1:
        aggregatedResponse = {
          wrong: 0,
          partial: 1,
          correct: 0,
          total: 1,
        }
        break
      case 2:
        aggregatedResponse = {
          wrong: 0,
          partial: 0,
          correct: 1,
          total: 1,
        }
        break
    }

    // create new response
    questionResponse = await ctx.prisma.questionResponse.create({
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
  }

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

  console.log('practiceQuizzes - questionResponse: ', questionResponse)
  // update the aggregated data on the element instance
  await ctx.prisma.elementInstance.update({
    where: {
      id,
    },
    data: {
      results: {
        wrong: existingInstance.results.wrong + (correctness === 0 ? 1 : 0),
        partial: existingInstance.results.partial + (correctness === 1 ? 1 : 0),
        correct: existingInstance.results.correct + (correctness === 2 ? 1 : 0),
        total: existingInstance.results.total + 1,
      },
    },
  })

  // TODO: fix return type
  return questionResponse
  // return null
}
