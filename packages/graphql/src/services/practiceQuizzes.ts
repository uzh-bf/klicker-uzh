import { ElementType, UserRole } from '@klicker-uzh/prisma'
import { Context } from '../lib/context'
import { orderStacks } from '../lib/util'
import {
  ContentInstanceResults,
  FlashcardCorrectness,
  FlashcardInstanceResults,
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

interface RespondToFlashcardInput {
  id: number
  courseId: string
  response: FlashcardCorrectness
}

async function respondToFlashcard(
  { id, courseId, response }: RespondToFlashcardInput,
  ctx: Context
) {
  const existingInstance = await ctx.prisma.elementInstance.findUnique({
    where: {
      id,
    },
  })

  // check if the instance exists and the response is valid
  if (
    !existingInstance ||
    ![
      FlashcardCorrectness.INCORRECT,
      FlashcardCorrectness.PARTIAL,
      FlashcardCorrectness.CORRECT,
    ].includes(response)
  ) {
    return null
  }

  // create result from flashcard response
  const flashcardResultMap: Record<FlashcardCorrectness, StackFeedbackStatus> =
    {
      [FlashcardCorrectness.INCORRECT]: StackFeedbackStatus.INCORRECT,
      [FlashcardCorrectness.PARTIAL]: StackFeedbackStatus.PARTIAL,
      [FlashcardCorrectness.CORRECT]: StackFeedbackStatus.CORRECT,
    }
  const result = {
    grading: flashcardResultMap[response],
    score: null,
  }

  // update the aggregated data on the element instance
  const existingResults = existingInstance.results as FlashcardInstanceResults
  await ctx.prisma.elementInstance.update({
    where: {
      id,
    },
    data: {
      results: {
        ...existingResults,
        [response]: (existingResults[response] ?? 0) + 1,
        total: existingResults.total + 1,
      },
    },
  })

  // fetch the participation of the participant
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

  // if no user exists, return the grading for client display
  if (!ctx.user?.sub || !participation) {
    return result
  }

  // create question detail response
  await ctx.prisma.questionResponseDetail.create({
    data: {
      response: {
        correctness: response,
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

  // find existing question response to this instance by this user and/or create/update it
  const existingResponse = await ctx.prisma.questionResponse.findUnique({
    where: {
      participantId_elementInstanceId: {
        participantId: ctx.user.sub,
        elementInstanceId: id,
      },
    },
  })
  const aggregatedResponses = existingResponse?.aggregatedResponses ?? {
    [FlashcardCorrectness.INCORRECT]: 0,
    [FlashcardCorrectness.PARTIAL]: 0,
    [FlashcardCorrectness.CORRECT]: 0,
    total: 0,
  }

  const questionResponse = await ctx.prisma.questionResponse.upsert({
    where: {
      participantId_elementInstanceId: {
        participantId: ctx.user.sub,
        elementInstanceId: id,
      },
    },
    create: {
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
      // RESPONSE and aggregated response creation
      response: {
        correctness: response,
      },
      aggregatedResponses: {
        ...aggregatedResponses,
        total: 1,
        [response]: 1,
      },
      trialsCount: 1,

      // CORRECT
      correctCount: response === FlashcardCorrectness.CORRECT ? 1 : 0,
      correctCountStreak: response === FlashcardCorrectness.CORRECT ? 1 : 0,
      lastCorrectAt:
        response === FlashcardCorrectness.CORRECT ? new Date() : undefined,

      // PARTIALLY CORRECT
      partialCorrectCount: response === FlashcardCorrectness.PARTIAL ? 1 : 0,
      lastPartialCorrectAt:
        response === FlashcardCorrectness.PARTIAL ? new Date() : undefined,

      // WRONG
      wrongCount: response === FlashcardCorrectness.INCORRECT ? 1 : 0,
      lastWrongAt:
        response === FlashcardCorrectness.INCORRECT ? new Date() : undefined,
    },
    update: {
      // RESPONSE
      response: {
        correctness: response,
      },
      aggregatedResponses: {
        ...aggregatedResponses,
        [response]: aggregatedResponses[response] + 1,
        total: aggregatedResponses.total + 1,
      },

      trialsCount: {
        increment: 1,
      },

      // CORRECT
      correctCount: {
        increment: response === FlashcardCorrectness.CORRECT ? 1 : 0,
      },
      correctCountStreak: {
        increment:
          response === FlashcardCorrectness.CORRECT
            ? 1
            : existingResponse
            ? -existingResponse.correctCountStreak
            : 0,
      },
      lastCorrectAt:
        response === FlashcardCorrectness.CORRECT ? new Date() : undefined,

      // PARTIALLY CORRECT
      partialCorrectCount: {
        increment: response === FlashcardCorrectness.PARTIAL ? 1 : 0,
      },
      lastPartialCorrectAt:
        response === FlashcardCorrectness.PARTIAL ? new Date() : undefined,

      // INCORRECT
      wrongCount: {
        increment: response === FlashcardCorrectness.INCORRECT ? 1 : 0,
      },
      lastWrongAt:
        response === FlashcardCorrectness.INCORRECT ? new Date() : undefined,
    },
  })

  return result
}

interface RespondToContentInput {
  id: number
  courseId: string
}

async function respondToContent(
  { id, courseId }: RespondToContentInput,
  ctx: Context
) {
  // TODO: potentially use aggregated results here as well to count how often the content was viewed
  const existingInstance = await ctx.prisma.elementInstance.findUnique({
    where: {
      id,
    },
  })

  const temp = (existingInstance?.results as ContentInstanceResults).viewed

  // check if the instance exists and the response is valid
  if (!existingInstance) {
    return null
  }

  // context elements can only be "read" when submitted
  const result = {
    grading: StackFeedbackStatus.CORRECT,
    score: null,
  }

  // update the aggregated data on the element instance
  const existingResults = existingInstance.results as ContentInstanceResults
  await ctx.prisma.elementInstance.update({
    where: {
      id,
    },
    data: {
      results: {
        viewed: existingResults.viewed + 1,
      },
    },
  })

  // fetch the participation of the participant
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

  // if no user exists, return the grading for client display
  if (!ctx.user?.sub || !participation) {
    return result
  }

  // create question detail response
  await ctx.prisma.questionResponseDetail.create({
    data: {
      response: {
        viewed: true,
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

  // create / update question response
  const questionResponse = await ctx.prisma.questionResponse.upsert({
    where: {
      participantId_elementInstanceId: {
        participantId: ctx.user.sub,
        elementInstanceId: id,
      },
    },
    create: {
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
      // RESPONSE and aggregated response creation
      response: {
        viewed: true,
      },
      trialsCount: 1,

      // CORRECT
      correctCount: 1,
      correctCountStreak: 1,
      lastCorrectAt: new Date(),
    },
    update: {
      // RESPONSE
      response: {
        viewed: true,
      },
      trialsCount: {
        increment: 1,
      },

      // CORRECT
      correctCount: {
        increment: 1,
      },
      correctCountStreak: {
        increment: 1,
      },
      lastCorrectAt: new Date(),
    },
  })

  return result
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

  // TODO: refactor this into a transaction and single combination of status and score for the stack
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
    } else if (
      response.type === ElementType.CONTENT &&
      response.contentReponse === true
    ) {
      const result = await respondToContent(
        {
          id: response.instanceId,
          courseId: courseId,
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
