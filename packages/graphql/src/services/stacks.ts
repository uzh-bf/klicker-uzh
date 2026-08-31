import * as DB from '@klicker-uzh/prisma/client'
import type {
  CaseStudyElementData,
  ChoicesElementData,
  ChoicesResponse,
  ContentElementData,
  ElementOptionsCaseStudy,
  ElementOptionsChoices,
  ElementOptionsFreeText,
  ElementOptionsNumerical,
  ElementOptionsSelection,
  ElementResultsCaseStudy,
  ElementResultsChoices,
  ElementResultsContent,
  ElementResultsFlashcard,
  ElementResultsOpen,
  ElementResultsSelection,
  FlashcardElementData,
  FreeTextElementData,
  InstanceEvaluation,
  NumericalElementData,
  SelectionElementData,
  SingleQuestionResponseCaseStudy,
  SingleQuestionResponseChoices,
  SingleQuestionResponseContent,
  SingleQuestionResponseFlashcard,
  SingleQuestionResponseSelection,
  SingleQuestionResponseValue,
} from '@klicker-uzh/types'
import { FlashcardCorrectness, StackFeedbackStatus } from '@klicker-uzh/types'
import type { PrismaTransactionClient } from '@klicker-uzh/util'
import dayjs from 'dayjs'
import { round } from 'mathjs'
import type { Context, ContextWithUser } from '../lib/context.js'
import type { ResponseInput } from '../ops.js'
import {
  prepareSemanticStackResponses,
  type SemanticStackResponse,
  submitSemanticFreeTextPracticeResponse,
} from './freeTextPracticeSubmission.js'
import { freeTextEvaluationError } from './freeTextEvaluationPolicy.js'
import {
  combineCaseStudyResults,
  combineChoicesResults,
  combineFreeTextResults,
  combineNumericalResults,
  combineSelectionResults,
  computeNumericalStatistics,
  evaluateCaseStudyElementResponse,
  evaluateChoicesElementResponse,
  evaluateFreeTextElementResponse,
  evaluateNumericalElementResponse,
  evaluateSelectionElementResponse,
} from './questionResponseEvaluation.js'
import { applyQuestionResponseInTransaction } from './questionResponsePersistence.js'
import {
  evaluateCaseStudyAnswerCorrectness,
  evaluateChoicesAnswerCorrectness,
  evaluateFreeTextAnswerCorrectness,
  evaluateNumericalAnswerCorrectness,
  evaluateSelectionAnswerCorrectness,
} from './questionResponseResults.js'
import {
  combineCorrectnessParams,
  combineNewCorrectnessParams,
  computeNewAverageTimes,
  computeUpdatedInstanceStatistics,
  type SpacedRepetitionResult,
  updateSpacedRepetition,
} from './responseTracking.js'

export { POINTS_PER_INSTANCE } from './questionResponseEvaluation.js'
export {
  evaluateCaseStudyAnswerCorrectness,
  evaluateChoicesAnswerCorrectness,
  evaluateFreeTextAnswerCorrectness,
  evaluateNumericalAnswerCorrectness,
  evaluateSelectionAnswerCorrectness,
  updateCaseStudyResults,
  updateChoicesResults,
  updateFreeTextResults,
  updateNumericalResults,
  updateSelectionResults,
} from './questionResponseResults.js'
export { updateSpacedRepetition } from './responseTracking.js'

type ExistingInstanceType = DB.ElementInstance & {
  elementStack?: {
    practiceQuizId?: string | null
    microLearningId?: string | null
  } | null
}

const flashcardResultMap: Record<FlashcardCorrectness, StackFeedbackStatus> = {
  [FlashcardCorrectness.INCORRECT]: StackFeedbackStatus.INCORRECT,
  [FlashcardCorrectness.PARTIAL]: StackFeedbackStatus.PARTIAL,
  [FlashcardCorrectness.CORRECT]: StackFeedbackStatus.CORRECT,
}

// ! Shared Helper Functions
// #region
export function combineStackStatus({
  prevStatus,
  newStatus,
}: {
  prevStatus: StackFeedbackStatus
  newStatus: StackFeedbackStatus
}) {
  // if the new status is not valid, return the previous one
  if (
    newStatus !== StackFeedbackStatus.INCORRECT &&
    newStatus !== StackFeedbackStatus.PARTIAL &&
    newStatus !== StackFeedbackStatus.CORRECT
  ) {
    return prevStatus
  }

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
// #endregion

// ! Flashcard Response Logic
// #region
async function getValidateFlashcardInstance({
  prisma,
  id,
  participantId,
  response,
}: {
  prisma: PrismaTransactionClient
  id: number
  participantId?: string
  response: FlashcardCorrectness
}) {
  const existingInstance = await prisma.elementInstance.findUnique({
    where: {
      id,
      elementType: DB.ElementType.FLASHCARD,
    },
    include: {
      elementStack: true,
      instanceStatistics: true,
      responses: participantId
        ? {
            where: {
              participantId,
            },
          }
        : false,
    },
  })

  // check if the instance exists and the response is valid
  if (
    !existingInstance ||
    existingInstance.elementType !== DB.ElementType.FLASHCARD ||
    ![
      FlashcardCorrectness.INCORRECT,
      FlashcardCorrectness.PARTIAL,
      FlashcardCorrectness.CORRECT,
    ].includes(response)
  ) {
    return null
  }

  return existingInstance
}

function updateFlashcardResults({
  previousResults,
  response,
}: {
  previousResults: ElementResultsFlashcard
  response: FlashcardCorrectness
}): ElementResultsFlashcard {
  return {
    ...previousResults,
    [response]: (previousResults[response] ?? 0) + 1,
    total: previousResults.total + 1,
  }
}

function computeFlashcardResponseContent({
  response,
  existingResponse,
}: {
  response: FlashcardCorrectness
  existingResponse: DB.QuestionResponse | null
}): {
  responseCorrectness: DB.ResponseCorrectness
  aggregatedResponses: ElementResultsFlashcard
  resultSpacedRepetition: SpacedRepetitionResult
} {
  const prevResponses = existingResponse?.aggregatedResponses
  const aggregatedResponses =
    prevResponses && FlashcardCorrectness.CORRECT in prevResponses
      ? prevResponses
      : {
          [FlashcardCorrectness.INCORRECT]: 0,
          [FlashcardCorrectness.PARTIAL]: 0,
          [FlashcardCorrectness.CORRECT]: 0,
          total: 0,
        }

  const streakIncrement = response === FlashcardCorrectness.CORRECT ? 1 : 0
  const correctness =
    response === FlashcardCorrectness.CORRECT
      ? 1
      : response === FlashcardCorrectness.PARTIAL
        ? 0.5
        : 0
  const responseCorrectness =
    correctness === 1
      ? DB.ResponseCorrectness.CORRECT
      : correctness === 0
        ? DB.ResponseCorrectness.WRONG
        : DB.ResponseCorrectness.PARTIAL

  const resultSpacedRepetition = updateSpacedRepetition({
    eFactor: existingResponse?.eFactor ?? 2.5,
    interval: existingResponse?.interval ?? 1,
    streak: (existingResponse?.correctCountStreak ?? 0) + streakIncrement,
    grade: correctness,
  })

  return {
    responseCorrectness,
    aggregatedResponses,
    resultSpacedRepetition,
  }
}

async function createFlashcardResponseDetail({
  prisma,
  id,
  response,
  courseId,
  answerTime,
  existingInstance,
  participantId,
}: {
  prisma: PrismaTransactionClient
  id: number
  response: FlashcardCorrectness
  courseId: string
  answerTime: number
  existingInstance: ExistingInstanceType
  participantId: string
}) {
  await prisma.questionResponseDetail.create({
    data: {
      response: {
        correctness: response,
      },
      timeSpent: answerTime,
      participant: {
        connect: { id: participantId },
      },
      elementInstance: {
        connect: { id },
      },
      practiceQuiz: existingInstance.elementStack?.practiceQuizId
        ? {
            connect: {
              id: existingInstance.elementStack?.practiceQuizId,
            },
          }
        : undefined,
      microLearning: existingInstance.elementStack?.microLearningId
        ? {
            connect: {
              id: existingInstance.elementStack?.microLearningId,
            },
          }
        : undefined,
      participation: {
        connect: {
          courseId_participantId: {
            courseId,
            participantId: participantId,
          },
        },
      },
    },
  })
}

async function upsertFlashcardResponse({
  prisma,
  id,
  participantId,
  courseId,
  response,
  newAverageResponseTime,
  existingInstance,
  existingResponse,
  responseCorrectness,
  aggregatedResponses,
  resultSpacedRepetition,
}: {
  prisma: PrismaTransactionClient
  id: number
  participantId: string
  courseId: string
  response: FlashcardCorrectness
  newAverageResponseTime: number
  existingInstance: ExistingInstanceType
  existingResponse: DB.QuestionResponse | null
  responseCorrectness: DB.ResponseCorrectness
  aggregatedResponses: ElementResultsFlashcard
  resultSpacedRepetition: SpacedRepetitionResult
}) {
  await prisma.questionResponse.upsert({
    where: {
      participantId_elementInstanceId: {
        participantId: participantId,
        elementInstanceId: id,
      },
    },
    create: {
      participant: {
        connect: { id: participantId },
      },
      averageTimeSpent: newAverageResponseTime ?? 0,
      elementInstance: {
        connect: { id },
      },
      practiceQuiz: existingInstance.elementStack?.practiceQuizId
        ? {
            connect: {
              id: existingInstance.elementStack?.practiceQuizId,
            },
          }
        : undefined,
      microLearning: existingInstance.elementStack?.microLearningId
        ? {
            connect: {
              id: existingInstance.elementStack?.microLearningId,
            },
          }
        : undefined,
      course: {
        connect: {
          id: courseId,
        },
      },
      participation: {
        connect: {
          courseId_participantId: {
            courseId,
            participantId: participantId,
          },
        },
      },
      // RESPONSE and aggregated response creation
      firstResponse: {
        correctness: response,
      },
      firstResponseCorrectness: responseCorrectness,
      lastResponse: {
        correctness: response,
      },
      lastResponseCorrectness: responseCorrectness,
      aggregatedResponses: {
        ...aggregatedResponses,
        total: 1,
        [response]: 1,
      },
      trialsCount: 1,

      ...combineNewCorrectnessParams({
        correct: response === FlashcardCorrectness.CORRECT,
        partial: response === FlashcardCorrectness.PARTIAL,
        incorrect: response === FlashcardCorrectness.INCORRECT,
      }),

      eFactor: resultSpacedRepetition.efactor,
      interval: resultSpacedRepetition.interval,
      nextDueAt: resultSpacedRepetition.nextDueAt,
    },
    update: {
      // RESPONSE
      lastResponse: {
        correctness: response,
      },
      lastResponseCorrectness: responseCorrectness,
      averageTimeSpent: newAverageResponseTime ?? 0,
      aggregatedResponses: {
        ...aggregatedResponses,
        [response]: aggregatedResponses[response] + 1,
        total: aggregatedResponses.total + 1,
      },

      trialsCount: {
        increment: 1,
      },

      ...combineCorrectnessParams({
        correct: response === FlashcardCorrectness.CORRECT,
        partial: response === FlashcardCorrectness.PARTIAL,
        incorrect: response === FlashcardCorrectness.INCORRECT,
        existingResponse,
      }),

      eFactor: resultSpacedRepetition.efactor,
      interval: resultSpacedRepetition.interval,
      nextDueAt: resultSpacedRepetition.nextDueAt,
    },
  })
}

async function respondToFlashcard(
  {
    id,
    courseId,
    response,
    answerTime,
    participation,
    skipTracking = false,
  }: {
    id: number
    courseId: string
    response: FlashcardCorrectness
    answerTime: number
    participation: (DB.Participation & { participant: DB.Participant }) | null
    skipTracking?: boolean
  },
  ctx: Context
) {
  // create result from flashcard response
  const result = {
    grading: flashcardResultMap[response],
    score: null,
  }

  if (skipTracking) {
    return result
  }

  // variable summaries for code readability
  const answerCorrect = response === FlashcardCorrectness.CORRECT
  const answerPartial = response === FlashcardCorrectness.PARTIAL
  const answerIncorrect = response === FlashcardCorrectness.INCORRECT

  const transactionResult = await ctx.prisma.$transaction(async (prisma) => {
    const existingInstance = await getValidateFlashcardInstance({
      prisma,
      id,
      participantId:
        ctx.user?.role === DB.UserRole.PARTICIPANT ? ctx.user.sub : undefined,
      response,
    })

    if (
      !existingInstance ||
      !(FlashcardCorrectness.CORRECT in existingInstance.results) ||
      !(FlashcardCorrectness.PARTIAL in existingInstance.anonymousResults)
    ) {
      return null
    }

    const existingResponse =
      existingInstance.responses &&
      existingInstance.responses.length > 0 &&
      existingInstance.responses[0]
        ? existingInstance.responses[0]
        : null

    // compute new aggregated results on element instance
    const newResults = updateFlashcardResults({
      previousResults: participation
        ? existingInstance.results
        : existingInstance.anonymousResults,
      response,
    })

    // average answer time computations if participant is logged in
    const { newAverageResponseTime, newAverageInstanceTime } = participation
      ? computeNewAverageTimes({
          existingInstance,
          existingResponse,
          answerTime,
        })
      : {
          newAverageInstanceTime: undefined,
          newAverageResponseTime: answerTime,
        }

    // compute updated instance statistics
    const instanceInPracticeQuiz =
      !!existingInstance.elementStack?.practiceQuizId
    const statisticsUpdate = computeUpdatedInstanceStatistics({
      participation,
      existingResponse,
      newAverageInstanceTime,
      answerCorrect,
      answerPartial,
      answerIncorrect,
      instanceInPracticeQuiz,
    })

    await prisma.elementInstance.update({
      where: {
        id,
      },
      data: {
        results: participation ? newResults : undefined,
        anonymousResults: participation ? undefined : newResults,
        instanceStatistics: statisticsUpdate,
      },
    })

    // early return: anonymous submissions (no login or login without participation in this course)
    if (
      !ctx.user?.sub ||
      ctx.user?.role !== DB.UserRole.PARTICIPANT ||
      !participation
    ) {
      return result
    }

    // create question detail response
    createFlashcardResponseDetail({
      prisma,
      id,
      response,
      courseId,
      answerTime,
      existingInstance,
      participantId: ctx.user.sub,
    })

    // compute metrics for the aggregated user-specific response entry
    const { responseCorrectness, aggregatedResponses, resultSpacedRepetition } =
      computeFlashcardResponseContent({
        response,
        existingResponse,
      })

    // upsert the user-specific response entry
    await upsertFlashcardResponse({
      prisma,
      id,
      participantId: ctx.user.sub,
      courseId,
      response,
      newAverageResponseTime,
      existingInstance,
      existingResponse,
      responseCorrectness,
      aggregatedResponses,
      resultSpacedRepetition,
    })

    // return the results for evaluation illustration
    return result
  })

  return transactionResult
}
// #endregion

// ! Content Element Response Logic
// #region
async function getValidateContentInstance({
  prisma,
  id,
  participantId,
}: {
  prisma: PrismaTransactionClient
  id: number
  participantId?: string
}) {
  const existingInstance = await prisma.elementInstance.findUnique({
    where: {
      id,
      elementType: DB.ElementType.CONTENT,
    },
    include: {
      elementStack: true,
      instanceStatistics: true,
      responses: participantId
        ? {
            where: {
              participantId,
            },
          }
        : false,
    },
  })

  return existingInstance
}

async function createContentResponseDetail({
  prisma,
  id,
  courseId,
  answerTime,
  existingInstance,
  participantId,
}: {
  prisma: PrismaTransactionClient
  id: number
  courseId: string
  answerTime: number
  existingInstance: ExistingInstanceType
  participantId: string
}) {
  await prisma.questionResponseDetail.create({
    data: {
      response: {
        viewed: true,
      },
      timeSpent: answerTime,
      participant: {
        connect: { id: participantId },
      },
      elementInstance: {
        connect: { id },
      },
      practiceQuiz: existingInstance.elementStack?.practiceQuizId
        ? {
            connect: {
              id: existingInstance.elementStack?.practiceQuizId,
            },
          }
        : undefined,
      microLearning: existingInstance.elementStack?.microLearningId
        ? {
            connect: {
              id: existingInstance.elementStack?.microLearningId,
            },
          }
        : undefined,
      participation: {
        connect: {
          courseId_participantId: {
            courseId,
            participantId: participantId,
          },
        },
      },
    },
  })
}

async function upsertContentResponse({
  prisma,
  id,
  participantId,
  courseId,
  newAverageResponseTime,
  existingInstance,
  aggregatedResponses,
  resultSpacedRepetition,
}: {
  prisma: PrismaTransactionClient
  id: number
  participantId: string
  courseId: string
  newAverageResponseTime: number
  existingInstance: ExistingInstanceType
  aggregatedResponses: ElementResultsContent
  resultSpacedRepetition: SpacedRepetitionResult
}) {
  await prisma.questionResponse.upsert({
    where: {
      participantId_elementInstanceId: {
        participantId,
        elementInstanceId: id,
      },
    },
    create: {
      participant: {
        connect: { id: participantId },
      },
      averageTimeSpent: newAverageResponseTime ?? 0,
      elementInstance: {
        connect: { id },
      },
      practiceQuiz: existingInstance.elementStack?.practiceQuizId
        ? {
            connect: {
              id: existingInstance.elementStack?.practiceQuizId,
            },
          }
        : undefined,
      microLearning: existingInstance.elementStack?.microLearningId
        ? {
            connect: {
              id: existingInstance.elementStack?.microLearningId,
            },
          }
        : undefined,
      course: {
        connect: {
          id: courseId,
        },
      },
      participation: {
        connect: {
          courseId_participantId: {
            courseId,
            participantId,
          },
        },
      },
      // RESPONSE and aggregated response creation
      firstResponse: {
        viewed: true,
      },
      firstResponseCorrectness: DB.ResponseCorrectness.CORRECT,
      lastResponse: {
        viewed: true,
      },
      lastResponseCorrectness: DB.ResponseCorrectness.CORRECT,
      trialsCount: 1,

      // AGGREGATED RESPONSES
      aggregatedResponses: {
        total: 1,
      },

      // CORRECT
      correctCount: 1,
      correctCountStreak: 1,
      lastAnsweredAt: new Date(),
      lastCorrectAt: new Date(),

      // update spaced repetition parameters
      eFactor: resultSpacedRepetition.efactor,
      interval: resultSpacedRepetition.interval,
      nextDueAt: resultSpacedRepetition.nextDueAt,
    },
    update: {
      // RESPONSE
      averageTimeSpent: newAverageResponseTime ?? 0,
      lastResponse: {
        viewed: true,
      },
      lastResponseCorrectness: DB.ResponseCorrectness.CORRECT,
      trialsCount: {
        increment: 1,
      },

      // AGGREGATED RESPONSES
      aggregatedResponses: {
        total: aggregatedResponses.total + 1,
      },

      // CORRECT
      correctCount: {
        increment: 1,
      },
      correctCountStreak: {
        increment: 1,
      },
      lastAnsweredAt: new Date(),
      lastCorrectAt: new Date(),

      // update spaced repetition parameters
      eFactor: resultSpacedRepetition.efactor,
      interval: resultSpacedRepetition.interval,
      nextDueAt: resultSpacedRepetition.nextDueAt,
    },
  })
}

async function respondToContent(
  {
    id,
    courseId,
    answerTime,
    participation,
    skipTracking = false,
  }: {
    id: number
    courseId: string
    answerTime: number
    participation: (DB.Participation & { participant: DB.Participant }) | null
    skipTracking?: boolean
  },
  ctx: Context
) {
  // context elements can only be "read" when submitted
  const result = {
    grading: StackFeedbackStatus.CORRECT,
    score: null,
  }

  if (skipTracking) {
    return result
  }

  const transactionResult = await ctx.prisma.$transaction(async (prisma) => {
    const existingInstance = await getValidateContentInstance({
      prisma,
      id,
      participantId:
        ctx.user?.role === DB.UserRole.PARTICIPANT ? ctx.user?.sub : undefined,
    })

    // check if the instance exists and the response is valid
    if (!existingInstance) {
      return null
    }

    const existingResponse =
      existingInstance.responses &&
      existingInstance.responses.length > 0 &&
      existingInstance.responses[0]
        ? existingInstance.responses[0]
        : null

    // average answer time computations if participant is logged in
    const { newAverageResponseTime, newAverageInstanceTime } = participation
      ? computeNewAverageTimes({
          existingInstance,
          existingResponse,
          answerTime,
        })
      : {
          newAverageInstanceTime: undefined,
          newAverageResponseTime: answerTime,
        }

    // compute updated instance statistics
    const instanceInPracticeQuiz =
      !!existingInstance.elementStack?.practiceQuizId
    const statisticsUpdate = computeUpdatedInstanceStatistics({
      participation,
      existingResponse,
      newAverageInstanceTime,
      answerCorrect: true,
      answerPartial: false,
      answerIncorrect: false,
      instanceInPracticeQuiz,
    })

    // update results on element instance
    const newResults = participation
      ? { total: existingInstance.results.total + 1 }
      : { total: existingInstance.anonymousResults.total + 1 }
    await prisma.elementInstance.update({
      where: {
        id,
      },
      data: {
        results: participation ? newResults : undefined,
        anonymousResults: participation ? undefined : newResults,
        instanceStatistics: statisticsUpdate,
      },
    })

    // early return: anonymous submissions (no login or login without participation in this course)
    if (
      !ctx.user?.sub ||
      ctx.user?.role !== DB.UserRole.PARTICIPANT ||
      !participation
    ) {
      return result
    }

    // create question detail response
    await createContentResponseDetail({
      prisma,
      id,
      courseId,
      answerTime,
      existingInstance,
      participantId: ctx.user.sub,
    })

    const aggregatedResponses = existingResponse?.aggregatedResponses ?? {
      total: 0,
    }

    const resultSpacedRepetition = updateSpacedRepetition({
      eFactor: existingResponse?.eFactor ?? 2.5,
      interval: existingResponse?.interval ?? 1,
      streak: (existingResponse?.correctCountStreak ?? 0) + 1,
      grade: 1,
    })

    // create / update question response
    await upsertContentResponse({
      prisma,
      id,
      participantId: ctx.user.sub,
      courseId,
      newAverageResponseTime,
      existingInstance,
      aggregatedResponses,
      resultSpacedRepetition,
    })

    return result
  })

  return transactionResult
}
// #endregion

// ! Question Response Logic
// #region
type RespondToQuestionArgs = {
  id: number
  courseId: string
  response: ResponseInput
  answerTime: number
  participation: (DB.Participation & { participant: DB.Participant }) | null
  skipTracking?: boolean
}

export async function respondToQuestion(
  {
    id,
    courseId,
    response,
    answerTime,
    participation,
    skipTracking,
  }: RespondToQuestionArgs,
  ctx: Context
) {
  const actor =
    ctx.user?.role === DB.UserRole.PARTICIPANT && participation
      ? { participation }
      : null

  return await ctx.prisma.$transaction((prisma) =>
    applyQuestionResponseInTransaction(
      {
        id,
        courseId,
        response,
        answerTime,
        actor,
        skipTracking,
      },
      prisma
    )
  )
}

// #endregion

// ! Element & Stack Response & Combination Logic
// #region
interface ElementResponseInput extends SemanticStackResponse {
  flashcardResponse?: FlashcardCorrectness | null
  contentReponse?: boolean | null
  choicesResponse?: ChoicesResponse[] | null
  numericalResponse?: number | null
  freeTextResponse?: string | null
  selectionResponse?: number[] | null
  caseStudyResponse?:
    | {
        caseId: string
        itemResponses: {
          itemId: number
          criterionResponses: { criterionId: string; response: number }[]
        }[]
      }[]
    | null
}

async function respondToElement({
  ctx,
  response,
  courseId,
  answerTime,
  skipTracking = false,
}: {
  ctx: Context
  response: ElementResponseInput
  courseId: string
  answerTime: number
  skipTracking?: boolean
}): Promise<{
  grading: StackFeedbackStatus | null
  score: number | null
  evaluation: InstanceEvaluation | null
}> {
  const participation =
    ctx.user?.sub && ctx.user.role === DB.UserRole.PARTICIPANT
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

  if (response.type === DB.ElementType.FLASHCARD) {
    const result = await respondToFlashcard(
      {
        id: response.instanceId,
        courseId,
        response: response.flashcardResponse!,
        answerTime,
        participation,
        skipTracking,
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
      return {
        grading: result.grading,
        score: null,
        evaluation: null,
      }
    } else {
      return {
        grading: null,
        score: null,
        evaluation: null,
      }
    }
  } else if (
    response.type === DB.ElementType.CONTENT &&
    response.contentReponse === true
  ) {
    const result = await respondToContent(
      {
        id: response.instanceId,
        courseId,
        answerTime,
        participation,
        skipTracking,
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
      return {
        grading: result.grading,
        score: null,
        evaluation: null,
      }
    } else {
      return {
        grading: null,
        score: null,
        evaluation: null,
      }
    }
  } else if (
    response.type === DB.ElementType.SC ||
    response.type === DB.ElementType.MC ||
    response.type === DB.ElementType.KPRIM
  ) {
    const result = await respondToQuestion(
      {
        id: response.instanceId,
        courseId,
        response: { choices: response.choicesResponse },
        answerTime,
        participation,
        skipTracking,
      },
      ctx
    )

    if (result) {
      return {
        grading: result.status,
        score: result.evaluation?.score ?? 0,
        evaluation: {
          instanceId: response.instanceId,
          ...result.evaluation,
        } as InstanceEvaluation,
      }
    } else {
      return {
        grading: null,
        score: null,
        evaluation: null,
      }
    }
  } else if (response.type === DB.ElementType.NUMERICAL) {
    const result = await respondToQuestion(
      {
        id: response.instanceId,
        courseId,
        response: { value: String(response.numericalResponse) },
        answerTime,
        participation,
        skipTracking,
      },
      ctx
    )

    if (result) {
      return {
        grading: result.status,
        score: result.evaluation?.score ?? 0,
        evaluation: {
          instanceId: response.instanceId,
          ...result.evaluation,
        } as InstanceEvaluation,
      }
    } else {
      return {
        grading: null,
        score: null,
        evaluation: null,
      }
    }
  } else if (response.type === DB.ElementType.FREE_TEXT) {
    if (
      participation &&
      ctx.user?.role === DB.UserRole.PARTICIPANT &&
      !skipTracking
    ) {
      const instance = await ctx.prisma.elementInstance.findUnique({
        where: { id: response.instanceId },
      })
      const semanticConfig =
        instance?.type === DB.ElementInstanceType.PRACTICE_QUIZ &&
        instance.elementData.type === DB.ElementType.FREE_TEXT
          ? instance.elementData.options.semanticEvaluation
          : null
      if (semanticConfig) {
        if (!instance) return { grading: null, score: null, evaluation: null }
        return await submitSemanticFreeTextPracticeResponse({
          ctx: ctx as ContextWithUser,
          response,
          answerTime,
          instance,
          localExactOnly:
            response.semanticEvaluationMode === 'LOCAL_EXACT_ONLY',
        })
      }
    }

    const result = await respondToQuestion(
      {
        id: response.instanceId,
        courseId,
        response: { value: response.freeTextResponse },
        answerTime,
        participation,
        skipTracking,
      },
      ctx
    )

    if (result) {
      return {
        grading: result.status,
        score: result.evaluation?.score ?? 0,
        evaluation: {
          instanceId: response.instanceId,
          ...result.evaluation,
        } as InstanceEvaluation,
      }
    } else {
      return {
        grading: null,
        score: null,
        evaluation: null,
      }
    }
  } else if (response.type === DB.ElementType.SELECTION) {
    const result = await respondToQuestion(
      {
        id: response.instanceId,
        courseId,
        response: {
          selection: response.selectionResponse?.filter(
            (r) => r !== -1 && typeof r !== 'undefined' && r !== null
          ), // only forward valid responses
        },
        answerTime,
        participation,
        skipTracking,
      },
      ctx
    )

    if (result) {
      return {
        grading: result.status,
        score: result.evaluation?.score ?? 0,
        evaluation: {
          instanceId: response.instanceId,
          ...result.evaluation,
        } as InstanceEvaluation,
      }
    } else {
      return {
        grading: null,
        score: null,
        evaluation: null,
      }
    }
  } else if (response.type === DB.ElementType.CASE_STUDY) {
    const result = await respondToQuestion(
      {
        id: response.instanceId,
        courseId,
        response: {
          assessment: response.caseStudyResponse,
        },
        answerTime,
        participation,
        skipTracking,
      },
      ctx
    )

    if (result) {
      return {
        grading: result.status,
        score: result.evaluation?.score ?? 0,
        evaluation: {
          instanceId: response.instanceId,
          ...result.evaluation,
        } as InstanceEvaluation,
      }
    } else {
      return {
        grading: null,
        score: null,
        evaluation: null,
      }
    }
  } else {
    throw new Error(
      'Submission of practice quiz stack answers not implemented for type ' +
        response.type
    )
  }
}

export interface RespondToElementStackInput {
  stackId: number
  courseId: string
  responses: ElementResponseInput[]
  stackAnswerTime: number
  /** Retained for old clients; preview authority is derived server-side. */
  isOwner?: boolean
}

export async function respondToElementStack(
  { stackId, courseId, responses, stackAnswerTime }: RespondToElementStackInput,
  ctx: Context
) {
  const stack = await ctx.prisma.elementStack.findUnique({
    where: { id: stackId },
    include: {
      practiceQuiz: { select: { ownerId: true, courseId: true } },
      microLearning: {
        select: { ownerId: true, scheduledEndAt: true, courseId: true },
      },
      groupActivity: { select: { ownerId: true, courseId: true } },
      elements: {
        include: {
          responses: {
            where:
              ctx.user?.sub && ctx.user.role === DB.UserRole.PARTICIPANT
                ? { participantId: ctx.user.sub }
                : { id: { lt: 0 } },
            select: { id: true },
          },
        },
      },
    },
  })
  const persistedCourseId =
    stack?.practiceQuiz?.courseId ??
    stack?.microLearning?.courseId ??
    stack?.groupActivity?.courseId ??
    stack?.courseId
  if (!stack || persistedCourseId !== courseId) {
    throw freeTextEvaluationError(
      'Stack response does not match the requested course',
      'BAD_USER_INPUT'
    )
  }
  const skipTracking =
    !!ctx.user?.sub &&
    (ctx.user.role === DB.UserRole.USER ||
      ctx.user.role === DB.UserRole.ADMIN) &&
    [
      stack?.practiceQuiz?.ownerId,
      stack?.microLearning?.ownerId,
      stack?.groupActivity?.ownerId,
    ].includes(ctx.user.sub)

  // if the element stack is part of a microlearning and the student has already responses to it, ignore this submission
  if (ctx.user?.sub && ctx.user.role === DB.UserRole.PARTICIPANT) {
    if (
      stack?.microLearning &&
      (stack.elements.some((element) => element.responses.length > 0) ||
        dayjs().isAfter(dayjs(stack.microLearning.scheduledEndAt)))
    ) {
      return null
    }
  }

  let stackScore: number | undefined
  let stackFeedback = StackFeedbackStatus.UNANSWERED
  const evaluationsArr: InstanceEvaluation[] = []

  // compute average answer time per element / question by dividing the
  // answer time for the entire stack through the number of responses
  const elementAnswerTime = round(stackAnswerTime / responses.length)

  const prepared = await prepareSemanticStackResponses({
    ctx,
    stackId,
    responses,
    answerTime: elementAnswerTime,
    skipTracking,
  })
  const responseResults = new Map<
    number,
    Awaited<ReturnType<typeof respondToElement>>
  >()

  for (const index of prepared.order) {
    responseResults.set(
      index,
      await respondToElement({
        ctx,
        response: prepared.responses[index]!,
        courseId,
        answerTime: elementAnswerTime,
        skipTracking,
      })
    )
  }

  for (const [index] of responses.entries()) {
    const { grading, score, evaluation } = responseResults.get(index)!

    // update stack status
    if (grading) {
      stackFeedback = combineStackStatus({
        prevStatus: stackFeedback,
        newStatus: grading,
      })
    }

    // update stack score
    if (score !== null) {
      stackScore =
        typeof stackScore === 'undefined' ? score : stackScore + score
    }

    // add evaluation to the array
    if (evaluation) {
      evaluationsArr.push(evaluation)
    }
  }

  return {
    id: stackId,
    status: stackFeedback,
    score: stackScore,
    evaluations: evaluationsArr,
  }
}
// #endregion

// ! Functions for Evaluation Fetching & Computation
// #region
type CommonEvaluationProps = {
  id: number
  type: DB.ElementType
  name: string
  content: string
  explanation: string | null
  hasSampleSolution: boolean
  hasAnswerFeedbacks: boolean
}

function computeChoicesEvaluation({
  options,
  results,
  anonymousResults,
  common,
}: {
  options: ElementOptionsChoices
  results: ElementResultsChoices
  anonymousResults: ElementResultsChoices
  common: CommonEvaluationProps
}) {
  // combine anonymous and participant results into new format
  const choices = combineChoicesResults({
    choices: options.choices,
    results: results.choices,
    anonymousResults: anonymousResults.choices,
  })

  return {
    ...common,
    results: {
      totalAnswers: results.total + anonymousResults.total,
      anonymousAnswers: anonymousResults.total,
      choices,
    },
  }
}

function computeNumericalEvaluation({
  options,
  results,
  anonymousResults,
  common,
}: {
  options: ElementOptionsNumerical
  results: ElementResultsOpen
  anonymousResults: ElementResultsOpen
  common: CommonEvaluationProps
}) {
  const combinedResults = combineNumericalResults({
    results,
    anonymousResults,
  })

  return {
    ...common,
    results: {
      totalAnswers: results.total + anonymousResults.total,
      anonymousAnswers: anonymousResults.total,
      maxValue: options.restrictions?.max,
      minValue: options.restrictions?.min,
      solutionRanges: options.solutionRanges,
      exactSolutions: options.exactSolutions,
      responseValues: combinedResults,
    },
    statistics: computeNumericalStatistics(combinedResults),
  }
}

function computeFreeTextEvaluation({
  options,
  results,
  anonymousResults,
  common,
}: {
  options: ElementOptionsFreeText
  results: ElementResultsOpen
  anonymousResults: ElementResultsOpen
  common: CommonEvaluationProps
}) {
  return {
    ...common,
    results: {
      totalAnswers: results.total + anonymousResults.total,
      anonymousAnswers: anonymousResults.total,
      maxLength: options.restrictions?.maxLength,
      solutions: options.solutions,
      responses: combineFreeTextResults({
        results,
        anonymousResults,
      }),
    },
  }
}

function computeSelectionEvaluation({
  options,
  results,
  anonymousResults,
  common,
}: {
  options: ElementOptionsSelection
  results: ElementResultsSelection
  anonymousResults: ElementResultsSelection
  common: CommonEvaluationProps
}) {
  return {
    ...common,
    results: {
      totalAnswers: results.total + anonymousResults.total,
      anonymousAnswers: anonymousResults.total,
      numberOfInputs: options.numberOfInputs,
      answerSolutionIds: options.answerCollectionSolutionIds,
      selectionResponses: combineSelectionResults({
        results,
        anonymousResults,
        answerOptions: options.answerCollection!,
      }),
    },
  }
}

function computeCaseStudyEvaluation({
  options,
  results,
  anonymousResults,
  common,
}: {
  options: ElementOptionsCaseStudy
  results: ElementResultsCaseStudy
  anonymousResults: ElementResultsCaseStudy
  common: CommonEvaluationProps
}) {
  return {
    ...common,
    cases: options.cases.map((caseObj) => ({
      id: caseObj.id,
      name: caseObj.title,
      description: caseObj.description,
    })),
    items:
      options.items?.map((item) => ({
        id: item.id,
        name: item.value,
      })) ?? [],
    criteria: options.criteria.map((criterion) => ({
      id: criterion.id,
      name: criterion.name,
      labels: criterion.labels,
    })),
    results: {
      totalAnswers: results.total + anonymousResults.total,
      anonymousAnswers: anonymousResults.total,
      caseResults: combineCaseStudyResults({
        results,
        anonymousResults,
        options,
      }),
    },
  }
}

function computeFlashcardEvaluation({
  results,
  anonymousResults,
  common,
}: {
  results: ElementResultsFlashcard
  anonymousResults: ElementResultsFlashcard
  common: CommonEvaluationProps
}) {
  return {
    ...common,
    results: {
      totalAnswers: results.total + anonymousResults.total,
      anonymousAnswers: anonymousResults.total,
      correctCount:
        results[FlashcardCorrectness.CORRECT] +
        anonymousResults[FlashcardCorrectness.CORRECT],
      partialCount:
        results[FlashcardCorrectness.PARTIAL] +
        anonymousResults[FlashcardCorrectness.PARTIAL],
      incorrectCount:
        results[FlashcardCorrectness.INCORRECT] +
        anonymousResults[FlashcardCorrectness.INCORRECT],
    },
  }
}

function computeContentEvaluation({
  results,
  anonymousResults,
  common,
}: {
  results: ElementResultsContent
  anonymousResults: ElementResultsContent
  common: CommonEvaluationProps
}) {
  return {
    ...common,
    results: {
      totalAnswers: results.total + anonymousResults.total,
      anonymousAnswers: anonymousResults.total,
    },
  }
}

function computeInstanceEvaluation({
  instance,
}: {
  instance: DB.ElementInstance
}) {
  const hasSampleSolution =
    'options' in instance.elementData &&
    'hasSampleSolution' in instance.elementData.options
      ? (instance.elementData.options.hasSampleSolution ?? false)
      : false
  const hasAnswerFeedbacks =
    'options' in instance.elementData &&
    'hasAnswerFeedbacks' in instance.elementData.options
      ? (instance.elementData.options.hasAnswerFeedbacks ?? false)
      : false

  const instanceType = instance.elementData.type
  const commonInstanceData = {
    id: instance.id,
    type: instanceType,
    name: instance.elementData.name,
    content: instance.elementData.content,
    explanation: instance.elementData.explanation,
    hasSampleSolution,
    hasAnswerFeedbacks,
  }

  if (
    (instanceType === DB.ElementType.SC ||
      instanceType === DB.ElementType.MC ||
      instanceType === DB.ElementType.KPRIM) &&
    'choices' in instance.results &&
    'choices' in instance.anonymousResults
  ) {
    return computeChoicesEvaluation({
      options: instance.elementData.options,
      results: instance.results,
      anonymousResults: instance.anonymousResults,
      common: commonInstanceData,
    })
  } else if (
    instanceType === DB.ElementType.NUMERICAL &&
    'responses' in instance.results &&
    'responses' in instance.anonymousResults
  ) {
    return computeNumericalEvaluation({
      options: instance.elementData.options,
      results: instance.results,
      anonymousResults: instance.anonymousResults,
      common: commonInstanceData,
    })
  } else if (
    instanceType === DB.ElementType.FREE_TEXT &&
    'responses' in instance.results &&
    'responses' in instance.anonymousResults
  ) {
    return computeFreeTextEvaluation({
      options: instance.elementData.options,
      results: instance.results,
      anonymousResults: instance.anonymousResults,
      common: commonInstanceData,
    })
  } else if (
    instanceType === DB.ElementType.SELECTION &&
    'selections' in instance.results &&
    'selections' in instance.anonymousResults
  ) {
    return computeSelectionEvaluation({
      options: instance.elementData.options,
      results: instance.results,
      anonymousResults: instance.anonymousResults,
      common: commonInstanceData,
    })
  } else if (
    instanceType === DB.ElementType.CASE_STUDY &&
    'assessments' in instance.results &&
    'assessments' in instance.anonymousResults
  ) {
    return computeCaseStudyEvaluation({
      options: instance.elementData.options,
      results: instance.results,
      anonymousResults: instance.anonymousResults,
      common: commonInstanceData,
    })
  } else if (
    instanceType === DB.ElementType.FLASHCARD &&
    FlashcardCorrectness.CORRECT in instance.results &&
    FlashcardCorrectness.CORRECT in instance.anonymousResults
  ) {
    return computeFlashcardEvaluation({
      results: instance.results,
      anonymousResults: instance.anonymousResults,
      common: commonInstanceData,
    })
  } else if (instanceType === DB.ElementType.CONTENT) {
    return computeContentEvaluation({
      results: instance.results,
      anonymousResults: instance.anonymousResults,
      common: commonInstanceData,
    })
  }

  return undefined
}

export function computeStackEvaluation(
  stacks: (
    | (DB.ElementStack & { elements: DB.ElementInstance[]; active?: boolean })
    | (DB.ElementBlock & { elements: DB.ElementInstance[]; active?: boolean })
  )[]
) {
  return stacks.map((stack) => ({
    stackId: stack.id!,
    stackName: 'displayName' in stack ? stack.displayName : null,
    stackDescription: 'description' in stack ? stack.description : null,
    stackOrder: stack.order,
    stackActive: stack.active ?? false,
    status: 'status' in stack ? stack.status : null,
    expiresAt: 'expiresAt' in stack ? stack.expiresAt : null,
    timeLimit: 'timeLimit' in stack ? stack.timeLimit : null,
    instances: stack.elements
      .map((instance) => computeInstanceEvaluation({ instance }))
      .filter((instance) => typeof instance !== 'undefined'),
  }))
}

type EvaluationAggregationReturn = {
  evaluation: InstanceEvaluation | undefined
  newStatus: StackFeedbackStatus
  stackScore: number | undefined
}

function getPreviousEvaluationFlashcard({
  instanceId,
  elementData,
  lastResponse,
}: {
  instanceId: number
  elementData: FlashcardElementData
  lastResponse: SingleQuestionResponseFlashcard
}): EvaluationAggregationReturn {
  return {
    evaluation: {
      ...elementData,
      instanceId,
      elementType: DB.ElementType.FLASHCARD,
      score: 0,
      correctness: null,
      lastResponse,
    },
    newStatus: flashcardResultMap[lastResponse.correctness],
    stackScore: undefined,
  }
}

function getPreviousEvaluationContent({
  instanceId,
  elementData,
  lastResponse,
}: {
  instanceId: number
  elementData: ContentElementData
  lastResponse: SingleQuestionResponseContent
}): EvaluationAggregationReturn {
  return {
    evaluation: {
      ...elementData,
      instanceId,
      elementType: DB.ElementType.CONTENT,
      score: 0,
      correctness: 1,
      lastResponse,
    },
    newStatus: StackFeedbackStatus.CORRECT,
    stackScore: undefined,
  }
}

function getPreviousEvaluationChoices({
  instanceId,
  elementData,
  multiplier,
  results,
  anonymousResults,
  lastResponse,
}: {
  instanceId: number
  elementData: ChoicesElementData
  multiplier: number | undefined
  results: ElementResultsChoices
  anonymousResults: ElementResultsChoices
  lastResponse: SingleQuestionResponseChoices
}): EvaluationAggregationReturn {
  const correctness = evaluateChoicesAnswerCorrectness({
    elementData,
    response: lastResponse,
  })

  const instanceEvaluation = evaluateChoicesElementResponse({
    elementData,
    results,
    anonymousResults,
    correctness,
    multiplier,
  })

  // if evaluation cannot be computed, return early
  if (!instanceEvaluation) {
    return {
      evaluation: undefined,
      newStatus: StackFeedbackStatus.UNANSWERED,
      stackScore: undefined,
    }
  }

  return {
    evaluation: {
      ...instanceEvaluation,
      ...elementData,
      instanceId,
      pointsAwarded: instanceEvaluation.score,
      xpAwarded: instanceEvaluation.xp ?? undefined,
      correctness,
      lastResponse,
    },
    newStatus:
      correctness === 1
        ? StackFeedbackStatus.CORRECT
        : correctness === 0
          ? StackFeedbackStatus.INCORRECT
          : StackFeedbackStatus.PARTIAL,
    stackScore: instanceEvaluation.score,
  }
}

function getPreviousEvaluationNumerical({
  instanceId,
  elementData,
  multiplier,
  results,
  anonymousResults,
  lastResponse,
}: {
  instanceId: number
  elementData: NumericalElementData
  multiplier: number | undefined
  results: ElementResultsOpen
  anonymousResults: ElementResultsOpen
  lastResponse: SingleQuestionResponseValue
}) {
  const correctness = evaluateNumericalAnswerCorrectness({
    elementData,
    response: lastResponse,
  })

  const instanceEvaluation = evaluateNumericalElementResponse({
    elementData,
    results,
    anonymousResults,
    correctness,
    multiplier,
  })

  // if evaluation cannot be computed, return early
  if (!instanceEvaluation) {
    return {
      evaluation: undefined,
      newStatus: StackFeedbackStatus.UNANSWERED,
      stackScore: undefined,
    }
  }

  return {
    evaluation: {
      ...instanceEvaluation,
      ...elementData,
      instanceId,
      pointsAwarded: instanceEvaluation.score,
      xpAwarded: instanceEvaluation.xp ?? undefined,
      solutionRanges:
        elementData.options.hasSampleSolution &&
        elementData.options.solutionRanges
          ? elementData.options.solutionRanges
          : [],
      exactSolutions:
        elementData.options.hasSampleSolution &&
        elementData.options.exactSolutions
          ? elementData.options.exactSolutions
          : [],
      correctness,
      lastResponse,
    },
    newStatus:
      correctness === 1
        ? StackFeedbackStatus.CORRECT
        : correctness === 0
          ? StackFeedbackStatus.INCORRECT
          : StackFeedbackStatus.PARTIAL,
    stackScore: instanceEvaluation.score,
  }
}

function getPreviousEvaluationFreeText({
  instanceId,
  elementData,
  multiplier,
  results,
  anonymousResults,
  lastResponse,
}: {
  instanceId: number
  elementData: FreeTextElementData
  multiplier: number | undefined
  results: ElementResultsOpen
  anonymousResults: ElementResultsOpen
  lastResponse: SingleQuestionResponseValue
}) {
  const correctness = evaluateFreeTextAnswerCorrectness({
    elementData,
    response: lastResponse,
  })

  const instanceEvaluation = evaluateFreeTextElementResponse({
    elementData,
    results,
    anonymousResults,
    correctness,
    multiplier,
  })

  // if evaluation cannot be computed, return early
  if (!instanceEvaluation) {
    return {
      evaluation: undefined,
      newStatus: StackFeedbackStatus.UNANSWERED,
      stackScore: undefined,
    }
  }

  return {
    evaluation: {
      ...instanceEvaluation,
      ...elementData,
      instanceId,
      pointsAwarded: instanceEvaluation.score,
      xpAwarded: instanceEvaluation.xp ?? undefined,
      solutions:
        elementData.options.hasSampleSolution && elementData.options.solutions
          ? elementData.options.solutions
          : [],
      correctness,
      lastResponse,
    },
    newStatus:
      correctness === 1
        ? StackFeedbackStatus.CORRECT
        : correctness === 0
          ? StackFeedbackStatus.INCORRECT
          : StackFeedbackStatus.PARTIAL,
    stackScore: instanceEvaluation.score,
  }
}

function getPreviousEvaluationSelection({
  instanceId,
  elementData,
  multiplier,
  results,
  anonymousResults,
  lastResponse,
}: {
  instanceId: number
  elementData: SelectionElementData
  multiplier: number | undefined
  results: ElementResultsSelection
  anonymousResults: ElementResultsSelection
  lastResponse: SingleQuestionResponseSelection
}) {
  const correctness = evaluateSelectionAnswerCorrectness({
    elementData,
    response: lastResponse,
  })

  const instanceEvaluation = evaluateSelectionElementResponse({
    elementData,
    results,
    anonymousResults,
    correctness,
    multiplier,
  })

  // if evaluation cannot be computed, return early
  if (!instanceEvaluation) {
    return {
      evaluation: undefined,
      newStatus: StackFeedbackStatus.UNANSWERED,
      stackScore: undefined,
    }
  }

  return {
    evaluation: {
      ...instanceEvaluation,
      ...elementData,
      instanceId,
      pointsAwarded: instanceEvaluation.score,
      xpAwarded: instanceEvaluation.xp ?? undefined,
      correctness,
      lastResponse,
    },
    newStatus:
      correctness === 1
        ? StackFeedbackStatus.CORRECT
        : correctness === 0
          ? StackFeedbackStatus.INCORRECT
          : StackFeedbackStatus.PARTIAL,
    stackScore: instanceEvaluation.score,
  }
}

function getPreviousEvaluationCaseStudy({
  instanceId,
  elementData,
  multiplier,
  results,
  anonymousResults,
  lastResponse,
}: {
  instanceId: number
  elementData: CaseStudyElementData
  multiplier: number | undefined
  results: ElementResultsCaseStudy
  anonymousResults: ElementResultsCaseStudy
  lastResponse: SingleQuestionResponseCaseStudy
}) {
  const correctness = evaluateCaseStudyAnswerCorrectness({
    elementData,
    response: lastResponse,
  })

  const instanceEvaluation = evaluateCaseStudyElementResponse({
    elementData,
    results,
    anonymousResults,
    correctness,
    multiplier,
  })

  // if evaluation cannot be computed, return early
  if (!instanceEvaluation) {
    return {
      evaluation: undefined,
      newStatus: StackFeedbackStatus.UNANSWERED,
      stackScore: undefined,
    }
  }

  return {
    evaluation: {
      ...instanceEvaluation,
      ...elementData,
      instanceId,
      pointsAwarded: instanceEvaluation.score,
      xpAwarded: instanceEvaluation.xp ?? undefined,
      correctness,
      lastResponse,
    },
    newStatus:
      correctness === 1
        ? StackFeedbackStatus.CORRECT
        : correctness === 0
          ? StackFeedbackStatus.INCORRECT
          : StackFeedbackStatus.PARTIAL,
    stackScore: instanceEvaluation.score,
  }
}

export async function getPreviousStackEvaluation(
  { stackId }: { stackId: number },
  ctx: Context
) {
  // previous results only exist for logged in users
  if (!ctx.user?.sub || ctx.user?.role !== DB.UserRole.PARTICIPANT) {
    return null
  }

  const stack = await ctx.prisma.elementStack.findUnique({
    where: { id: stackId, type: DB.ElementStackType.MICROLEARNING },
    include: {
      elements: {
        include: {
          responses: {
            where: {
              participantId: ctx.user.sub,
            },
          },
        },
      },
    },
  })

  // if no previous response exists, return null
  if (
    !stack ||
    !stack.elements ||
    !stack.elements[0] ||
    !stack.elements[0].responses
  ) {
    return null
  }

  // aggregate the evaluation content from the responses
  const { evaluations, stackScore, stackFeedback } = stack.elements.reduce<{
    evaluations: InstanceEvaluation[]
    stackScore: number | undefined
    stackFeedback: StackFeedbackStatus
  }>(
    (acc, element) => {
      if (
        !element.responses ||
        element.responses.length === 0 ||
        element.responses[0] === null ||
        typeof element.responses[0] === 'undefined'
      ) {
        return acc
      }

      if (element.elementData.type === DB.ElementType.FLASHCARD) {
        const { evaluation, newStatus } = getPreviousEvaluationFlashcard({
          instanceId: element.id,
          elementData: element.elementData as FlashcardElementData,
          lastResponse: element.responses[0]
            .lastResponse as SingleQuestionResponseFlashcard,
        })

        if (typeof evaluation !== 'undefined') {
          acc.evaluations.push(evaluation)
          acc.stackFeedback = combineStackStatus({
            prevStatus: acc.stackFeedback,
            newStatus,
          })
        }
      } else if (element.elementData.type === DB.ElementType.CONTENT) {
        const { evaluation, newStatus } = getPreviousEvaluationContent({
          instanceId: element.id,
          elementData: element.elementData,
          lastResponse: element.responses[0]
            .lastResponse as SingleQuestionResponseContent,
        })

        if (typeof evaluation !== 'undefined') {
          acc.evaluations.push(evaluation)
          acc.stackFeedback = combineStackStatus({
            prevStatus: acc.stackFeedback,
            newStatus,
          })
        }
      } else if (
        (element.elementData.type === DB.ElementType.SC ||
          element.elementData.type === DB.ElementType.MC ||
          element.elementData.type === DB.ElementType.KPRIM) &&
        'choices' in element.results &&
        'choices' in element.anonymousResults
      ) {
        const { evaluation, newStatus, stackScore } =
          getPreviousEvaluationChoices({
            instanceId: element.id,
            elementData: element.elementData,
            multiplier: element.options.pointsMultiplier,
            results: element.results,
            anonymousResults: element.anonymousResults,
            lastResponse: element.responses[0]
              .lastResponse as SingleQuestionResponseChoices,
          })

        if (evaluation) {
          acc.evaluations.push(evaluation)
          acc.stackFeedback = combineStackStatus({
            prevStatus: acc.stackFeedback,
            newStatus,
          })
          acc.stackScore = (acc.stackScore ?? 0) + (stackScore ?? 0)
        }
      } else if (
        element.elementData.type === DB.ElementType.NUMERICAL &&
        'responses' in element.results &&
        'responses' in element.anonymousResults
      ) {
        const { evaluation, newStatus, stackScore } =
          getPreviousEvaluationNumerical({
            instanceId: element.id,
            elementData: element.elementData,
            multiplier: element.options.pointsMultiplier,
            results: element.results,
            anonymousResults: element.anonymousResults,
            lastResponse: element.responses[0]
              .lastResponse as SingleQuestionResponseValue,
          })

        if (evaluation) {
          acc.evaluations.push(evaluation)
          acc.stackFeedback = combineStackStatus({
            prevStatus: acc.stackFeedback,
            newStatus,
          })
          acc.stackScore = (acc.stackScore ?? 0) + (stackScore ?? 0)
        }
      } else if (
        element.elementData.type === DB.ElementType.FREE_TEXT &&
        'responses' in element.results &&
        'responses' in element.anonymousResults
      ) {
        const { evaluation, newStatus, stackScore } =
          getPreviousEvaluationFreeText({
            instanceId: element.id,
            elementData: element.elementData,
            multiplier: element.options.pointsMultiplier,
            results: element.results,
            anonymousResults: element.anonymousResults,
            lastResponse: element.responses[0]
              .lastResponse as SingleQuestionResponseValue,
          })

        if (evaluation) {
          acc.evaluations.push(evaluation)
          acc.stackFeedback = combineStackStatus({
            prevStatus: acc.stackFeedback,
            newStatus,
          })
          acc.stackScore = (acc.stackScore ?? 0) + (stackScore ?? 0)
        }
      } else if (
        element.elementData.type === DB.ElementType.SELECTION &&
        'selections' in element.results &&
        'selections' in element.anonymousResults
      ) {
        const { evaluation, newStatus, stackScore } =
          getPreviousEvaluationSelection({
            instanceId: element.id,
            elementData: element.elementData,
            multiplier: element.options.pointsMultiplier,
            results: element.results,
            anonymousResults: element.anonymousResults,
            lastResponse: element.responses[0]
              .lastResponse as SingleQuestionResponseSelection,
          })

        if (evaluation) {
          acc.evaluations.push(evaluation)
          acc.stackFeedback = combineStackStatus({
            prevStatus: acc.stackFeedback,
            newStatus,
          })
          acc.stackScore = (acc.stackScore ?? 0) + (stackScore ?? 0)
        }
      } else if (
        element.elementData.type === DB.ElementType.CASE_STUDY &&
        'assessments' in element.results &&
        'assessments' in element.anonymousResults
      ) {
        const { evaluation, newStatus, stackScore } =
          getPreviousEvaluationCaseStudy({
            instanceId: element.id,
            elementData: element.elementData,
            multiplier: element.options.pointsMultiplier,
            results: element.results,
            anonymousResults: element.anonymousResults,
            lastResponse: element.responses[0]
              .lastResponse as SingleQuestionResponseCaseStudy,
          })

        if (evaluation) {
          acc.evaluations.push(evaluation)
          acc.stackFeedback = combineStackStatus({
            prevStatus: acc.stackFeedback,
            newStatus,
          })
          acc.stackScore = (acc.stackScore ?? 0) + (stackScore ?? 0)
        }
      } else {
        throw new Error(
          `Evaluation aggregation for element type ${element.elementData.type} not implemented`
        )
      }

      return acc
    },
    {
      evaluations: [],
      stackScore: undefined,
      stackFeedback: StackFeedbackStatus.UNANSWERED,
    }
  )

  return {
    id: stack.id,
    status: stackFeedback,
    score: stackScore,
    evaluations,
  }
}
// #endregion
