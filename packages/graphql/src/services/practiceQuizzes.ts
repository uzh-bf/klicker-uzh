import { ElementType, UserRole } from '@klicker-uzh/prisma'
import { Context } from '../lib/context'
import { orderStacks } from '../lib/util'
import {
  AggregatedResponseFlashcard,
  FlashcardCorrectness,
  StackFeedbackStatus,
} from '../types/app'

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
    const orderedStacks = orderStacks(quiz.stacks)

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
  correctness: FlashcardCorrectness
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
    ![
      FlashcardCorrectness.INCORRECT,
      FlashcardCorrectness.PARTIAL,
      FlashcardCorrectness.CORRECT,
    ].includes(correctness)
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
          increment: correctness === FlashcardCorrectness.CORRECT ? 1 : 0,
        },
        correctCountStreak: {
          increment:
            correctness === FlashcardCorrectness.CORRECT
              ? 1
              : -existingResponse?.correctCountStreak,
        },
        lastCorrectAt:
          correctness === FlashcardCorrectness.CORRECT ? new Date() : undefined,

        // PARTIALLY CORRECT
        partialCorrectCount: {
          increment: correctness === FlashcardCorrectness.PARTIAL ? 1 : 0,
        },
        lastPartialCorrectAt:
          correctness === FlashcardCorrectness.PARTIAL ? new Date() : undefined,

        // INCORRECT
        wrongCount: {
          increment: correctness === FlashcardCorrectness.INCORRECT ? 1 : 0,
        },
        lastWrongAt:
          correctness === FlashcardCorrectness.INCORRECT
            ? new Date()
            : undefined,
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
          [FlashcardCorrectness.INCORRECT]: 0,
          [FlashcardCorrectness.PARTIAL]: 0,
          [FlashcardCorrectness.CORRECT]: 0,
          total: 1,
          [correctness]: 1,
        },

        trialsCount: 1,

        // CORRECT
        correctCount: correctness === FlashcardCorrectness.CORRECT ? 1 : 0,
        correctCountStreak:
          correctness === FlashcardCorrectness.CORRECT ? 1 : 0,
        lastCorrectAt:
          correctness === FlashcardCorrectness.CORRECT ? new Date() : undefined,

        // PARTIALLY CORRECT
        partialCorrectCount:
          correctness === FlashcardCorrectness.PARTIAL ? 1 : 0,
        lastPartialCorrectAt:
          correctness === FlashcardCorrectness.PARTIAL ? new Date() : undefined,

        // WRONG
        wrongCount: correctness === FlashcardCorrectness.INCORRECT ? 1 : 0,
        lastWrongAt:
          correctness === FlashcardCorrectness.INCORRECT
            ? new Date()
            : undefined,
      },
    })

    return questionResponse
  }
}

interface RespondToFlashcardInput {
  id: number
  courseId: string
  response: FlashcardCorrectness
}

async function respondToFlashcard(
  { id, courseId, response }: RespondToFlashcardInput,
  ctx: Context
) {
  // TODO - implement
  const grading = StackFeedbackStatus.CORRECT

  return {
    grading,
    score: null,
  }
}

interface RespondToContentInput {
  id: number
  courseId: string
  response: boolean
}

async function respondToContent(
  { id, courseId, response }: RespondToContentInput,
  ctx: Context
) {
  // TODO - implement
  const grading = StackFeedbackStatus.CORRECT

  return {
    grading,
    score: null,
  }
}

function combineStackStatus({
  prevStatus,
  newStatus,
}: {
  prevStatus: StackFeedbackStatus
  newStatus:
    | StackFeedbackStatus.CORRECT
    | StackFeedbackStatus.PARTIAL
    | StackFeedbackStatus.INCORRECT
}) {
  if (prevStatus === StackFeedbackStatus.UNANSWERED) {
    // if this is the first response to the stack, set the feedback to the result
    return newStatus
  } else if (prevStatus === StackFeedbackStatus.CORRECT) {
    // only keep the value at correct, if the answer was correct (partial otherwise)
    return newStatus === StackFeedbackStatus.CORRECT
      ? StackFeedbackStatus.CORRECT
      : StackFeedbackStatus.PARTIAL
  } else if (prevStatus === StackFeedbackStatus.INCORRECT) {
    // if the result is correct or partially correct, switch to partial
    return newStatus === StackFeedbackStatus.INCORRECT
      ? StackFeedbackStatus.INCORRECT
      : StackFeedbackStatus.PARTIAL
  }

  // if the state before was partial, keep it as partial (independent of the grading result)
  return prevStatus
}

interface RespondToPracticeQuizStackInput {
  stackId: number
  courseId: string
  responses: {
    instanceId: number
    type: ElementType
    flashcardResponse?: FlashcardCorrectness | null
    contentReponse?: boolean | null
  }[]
}

export async function respondToPracticeQuizStack(
  { stackId, courseId, responses }: RespondToPracticeQuizStackInput,
  ctx: Context
) {
  let stackScore = undefined
  let stackFeedback = StackFeedbackStatus.UNANSWERED

  for (const response of responses) {
    if (response.type === ElementType.FLASHCARD) {
      const result = await respondToFlashcard(
        {
          id: response.instanceId,
          courseId: courseId,
          response: response.flashcardResponse!,
        },
        ctx
      )

      // only update status as no points are awarded for flashcards
      if (
        result !== null &&
        (result.grading === StackFeedbackStatus.CORRECT ||
          result.grading === StackFeedbackStatus.PARTIAL ||
          result.grading === StackFeedbackStatus.INCORRECT)
      ) {
        stackFeedback = combineStackStatus({
          prevStatus: stackFeedback,
          newStatus: result.grading,
        })
      }
    } else if (response.type === ElementType.CONTENT) {
      const result = await respondToContent(
        {
          id: response.instanceId,
          courseId: courseId,
          response: response.contentReponse!,
        },
        ctx
      )

      // only update status as no points are awarded for content elements
      if (
        result !== null &&
        (result.grading === StackFeedbackStatus.CORRECT ||
          result.grading === StackFeedbackStatus.PARTIAL ||
          result.grading === StackFeedbackStatus.INCORRECT)
      ) {
        stackFeedback = combineStackStatus({
          prevStatus: stackFeedback,
          newStatus: result.grading,
        })
      }
    }

    // TODO: add remaining cases to answer questions
  }

  return {
    id: stackId,
    status: stackFeedback,
    score: stackScore,
  }
}
