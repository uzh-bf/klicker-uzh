import { ICaseStudyElementEvaluationResults } from '@/schema/evaluation.js'
import {
  computeAwardedXp,
  computeSimpleAwardedPoints,
  gradeQuestionCaseStudy,
  gradeQuestionFreeText,
  gradeQuestionKPRIM,
  gradeQuestionMC,
  gradeQuestionNumerical,
  gradeQuestionSC,
  gradeQuestionSelection,
} from '@klicker-uzh/grading'
import * as DB from '@klicker-uzh/prisma/client'
import type {
  CaseStudyElementData,
  CaseStudySolutionsObject,
  Choice,
  ChoicesElementData,
  ContentElementData,
  ElementData,
  ElementInstanceResults,
  ElementOptionsAnswerCollection,
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
  InstanceEvaluationCaseStudy,
  InstanceEvaluationChoices,
  InstanceEvaluationFreeText,
  InstanceEvaluationNumerical,
  InstanceEvaluationSelection,
  NumericalElementData,
  SelectionElementData,
  SingleCaseStudyResponse,
  SingleQuestionResponse,
  SingleQuestionResponseCaseStudy,
  SingleQuestionResponseChoices,
  SingleQuestionResponseContent,
  SingleQuestionResponseFlashcard,
  SingleQuestionResponseSelection,
  SingleQuestionResponseValue,
  StackResponseInput,
} from '@klicker-uzh/types'
import {
  FlashcardCorrectness,
  gradeQrScanResponse,
  isValidQrScanCode,
  normalizeQrScanCode,
  StackFeedbackStatus,
} from '@klicker-uzh/types'
import {
  getInitialInstanceResults,
  PrismaTransactionClient,
} from '@klicker-uzh/util'
import dayjs from 'dayjs'
import { GraphQLError } from 'graphql'
import { max, mean, median, min, quantileSeq, round, std } from 'mathjs'
import { createHash } from 'node:crypto'
import { toLowerCase } from 'remeda'
import type { Context } from '../lib/context.js'
import type {
  CaseStudyCaseResponse,
  CaseStudyElementOptions,
  ResponseInput,
} from '../ops.js'
import {
  finalizeEscapeRoomStackSubmission,
  prepareEscapeRoomStackSubmission,
  releaseEscapeRoomStackSubmission,
} from './escapeRoomStackSubmissions.js'
import { upsertDailyTimelineEntry } from './participants.js'

type ExistingInstanceType = DB.ElementInstance & {
  elementStack?: {
    practiceQuizId?: string | null
    microLearningId?: string | null
  } | null
}

export const POINTS_PER_INSTANCE = 10
const POINTS_AWARD_TIMEFRAME_DAYS = 6
const XP_AWARD_TIMEFRAME_DAYS = 1

const flashcardResultMap: Record<FlashcardCorrectness, StackFeedbackStatus> = {
  [FlashcardCorrectness.INCORRECT]: StackFeedbackStatus.INCORRECT,
  [FlashcardCorrectness.PARTIAL]: StackFeedbackStatus.PARTIAL,
  [FlashcardCorrectness.CORRECT]: StackFeedbackStatus.CORRECT,
}

// ! Shared Helper Functions
// #region
interface CombineCorrectnessParamsInput {
  correct: boolean
  partial: boolean
  incorrect: boolean
  existingResponse?: DB.QuestionResponse | null
}

function combineNewCorrectnessParams({
  correct,
  partial,
  incorrect,
}: CombineCorrectnessParamsInput) {
  return {
    // track last answer date
    lastAnsweredAt: new Date(),

    // CORRECT
    correctCount: correct ? 1 : 0,
    correctCountStreak: correct ? 1 : 0,
    lastCorrectAt: correct ? new Date() : undefined,

    // PARTIALLY CORRECT
    partialCorrectCount: partial ? 1 : 0,
    lastPartialCorrectAt: partial ? new Date() : undefined,

    // WRONG
    wrongCount: incorrect ? 1 : 0,
    lastWrongAt: incorrect ? new Date() : undefined,
  }
}

function combineCorrectnessParams({
  correct,
  partial,
  incorrect,
  existingResponse,
}: CombineCorrectnessParamsInput) {
  return {
    // track last answer date
    lastAnsweredAt: new Date(),

    // CORRECT
    correctCount: {
      increment: correct ? 1 : 0,
    },
    correctCountStreak: {
      increment: correct
        ? 1
        : existingResponse
          ? -existingResponse.correctCountStreak
          : 0,
    },
    lastCorrectAt: correct ? new Date() : undefined,

    // PARTIALLY CORRECT
    partialCorrectCount: {
      increment: partial ? 1 : 0,
    },
    lastPartialCorrectAt: partial ? new Date() : undefined,

    // INCORRECT
    wrongCount: {
      increment: incorrect ? 1 : 0,
    },
    lastWrongAt: incorrect ? new Date() : undefined,
  }
}

type SpacedRepetitionResult = {
  efactor: number
  interval: number
  nextDueAt: Date
}

export function updateSpacedRepetition({
  eFactor,
  interval,
  streak,
  grade,
}: {
  eFactor: number
  interval: number
  streak: number
  grade: number
}): SpacedRepetitionResult {
  if (grade < 0 || grade > 1) {
    throw new Error('Grade must be between 0 and 1.')
  }

  // scale grade to 0-5 range (definition of algorithm)
  const scaledGrade = grade * 5

  // update efactor and interval
  let newEfactor = Math.max(
    1.3,
    eFactor + (0.1 - (5 - scaledGrade) * (0.08 + (5 - scaledGrade) * 0.02))
  )
  newEfactor = parseFloat(newEfactor.toFixed(2))

  let newInterval: number
  if (scaledGrade < 3) {
    newInterval = 1
  } else {
    if (streak === 1) {
      newInterval = 2
    } else if (streak === 2) {
      newInterval = 6
    } else {
      newInterval = Math.ceil(interval * newEfactor)
    }
  }

  // ensure that maximum interval is bounded
  newInterval = Math.min(newInterval, 36500)

  // compute next due date to sort by (=> spaced repetition)
  const nextDueAt = dayjs().add(newInterval, 'day').toDate()

  return {
    efactor: newEfactor,
    interval: newInterval,
    nextDueAt: nextDueAt,
  }
}

function computeNewAverageTimes({
  existingInstance,
  existingResponse,
  answerTime,
}: {
  existingInstance: DB.ElementInstance & {
    instanceStatistics: DB.InstanceStatistics | null
  }
  existingResponse: DB.QuestionResponse | null
  answerTime: number
}): { newAverageResponseTime: number; newAverageInstanceTime: number } {
  const existingParticipantCount =
    existingInstance.instanceStatistics!.uniqueParticipantCount
  const existingInstanceTime =
    existingInstance.instanceStatistics!.averageTimeSpent
  const newAverageResponseTime = existingResponse
    ? (existingResponse.averageTimeSpent * existingResponse.trialsCount +
        answerTime) /
      (existingResponse.trialsCount + 1)
    : answerTime
  const newAverageInstanceTime = existingResponse
    ? (existingInstanceTime! * existingParticipantCount -
        existingResponse.averageTimeSpent +
        answerTime) /
      existingParticipantCount
    : ((existingInstanceTime ?? 0) * existingParticipantCount + answerTime) /
      (existingParticipantCount + 1)

  return { newAverageResponseTime, newAverageInstanceTime }
}

function computeUpdatedInstanceStatistics({
  participation,
  existingResponse,
  newAverageInstanceTime,
  answerCorrect,
  answerPartial,
  answerIncorrect,
  instanceInPracticeQuiz,
}: {
  participation: DB.Participation | null
  existingResponse: DB.QuestionResponse | null
  newAverageInstanceTime?: number
  answerCorrect: boolean
  answerPartial: boolean
  answerIncorrect: boolean
  instanceInPracticeQuiz: boolean
}) {
  return participation
    ? {
        update: {
          uniqueParticipantCount: {
            increment: Number(!existingResponse),
          },
          averageTimeSpent: newAverageInstanceTime ?? 0,
          correctCount: {
            increment: Number(answerCorrect),
          },
          partialCorrectCount: {
            increment: Number(answerPartial),
          },
          wrongCount: {
            increment: Number(answerIncorrect),
          },
          firstCorrectCount: {
            increment: Number(
              answerCorrect && !existingResponse && instanceInPracticeQuiz
            ),
          },
          firstPartialCorrectCount: {
            increment: Number(
              answerPartial && !existingResponse && instanceInPracticeQuiz
            ),
          },
          firstWrongCount: {
            increment: Number(
              answerIncorrect && !existingResponse && instanceInPracticeQuiz
            ),
          },
          lastCorrectCount: {
            increment:
              Number(answerCorrect && instanceInPracticeQuiz) -
              Number(
                existingResponse?.lastResponseCorrectness ===
                  DB.ResponseCorrectness.CORRECT
              ),
          },
          lastPartialCorrectCount: {
            increment:
              Number(answerPartial && instanceInPracticeQuiz) -
              Number(
                existingResponse?.lastResponseCorrectness ===
                  DB.ResponseCorrectness.PARTIAL
              ),
          },
          lastWrongCount: {
            increment:
              Number(answerIncorrect && instanceInPracticeQuiz) -
              Number(
                existingResponse?.lastResponseCorrectness ===
                  DB.ResponseCorrectness.WRONG
              ),
          },
        },
      }
    : {
        update: {
          anonymousCorrectCount: {
            increment: Number(answerCorrect),
          },
          anonymousPartialCorrectCount: {
            increment: Number(answerPartial),
          },
          anonymousWrongCount: {
            increment: Number(answerIncorrect),
          },
        },
      }
}

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
type SharedEvaluationProps =
  | 'elementType'
  | 'feedbacks'
  | 'numAnswers'
  | 'score'
  | 'xp'
  | 'percentile'
  | 'pointsMultiplier'
  | 'explanation'

type ChoicesEvaluationReturnType = Pick<
  InstanceEvaluationChoices,
  SharedEvaluationProps | 'choices'
>
type NumericalEvaluationReturnType = Pick<
  InstanceEvaluationNumerical,
  SharedEvaluationProps | 'solutionRanges' | 'exactSolutions' | 'responses'
>
type FreeTextEvaluationReturnType = Pick<
  InstanceEvaluationFreeText,
  SharedEvaluationProps | 'solutions' | 'answers'
>
type SelectionEvaluationReturnType = Pick<
  InstanceEvaluationSelection,
  SharedEvaluationProps | 'answerSolutionIds' | 'selectionResponses'
>
type CaseStudyEvaluationReturnType = Pick<
  InstanceEvaluationCaseStudy,
  SharedEvaluationProps | 'assessments' | 'studySolutions'
>

async function getValidateElementInstance({
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
    },
    include: {
      element: { select: { qrScanCode: true } },
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

function evaluateChoicesElementResponse({
  elementData,
  results,
  anonymousResults,
  correctness,
  multiplier,
}: {
  elementData: ChoicesElementData
  results: ElementResultsChoices
  anonymousResults: ElementResultsChoices
  correctness: number | null
  multiplier?: number
}): ChoicesEvaluationReturnType | null {
  return {
    elementType: elementData.type,
    feedbacks: elementData.options.choices,
    numAnswers: results.total + anonymousResults.total,
    choices: combineChoicesResults({
      choices: elementData.options.choices,
      results: results.choices,
      anonymousResults: anonymousResults.choices,
    }),
    score: computeSimpleAwardedPoints({
      points: POINTS_PER_INSTANCE,
      pointsPercentage: correctness,
      pointsMultiplier: multiplier,
    }),
    xp: computeAwardedXp({
      pointsPercentage: correctness,
    }),
    percentile: correctness ?? 0,
    pointsMultiplier: multiplier ?? 1,
    explanation: elementData.explanation,
  }
}

function evaluateNumericalElementResponse({
  elementData,
  results,
  anonymousResults,
  correctness,
  multiplier,
}: {
  elementData: NumericalElementData
  results: ElementResultsOpen
  anonymousResults: ElementResultsOpen
  correctness: number | null
  multiplier?: number
}): NumericalEvaluationReturnType | null {
  return {
    elementType: DB.ElementType.NUMERICAL,
    feedbacks: [],
    numAnswers: results.total + anonymousResults.total,
    responses: combineNumericalResults({
      results,
      anonymousResults,
    }),
    score: correctness
      ? correctness * POINTS_PER_INSTANCE * (multiplier ?? 1)
      : 0,
    xp: computeAwardedXp({
      pointsPercentage: correctness,
    }),
    percentile: correctness ?? 0,
    pointsMultiplier: multiplier ?? 1,
    explanation: elementData.explanation,
    solutionRanges: elementData.options.solutionRanges ?? [],
    exactSolutions: elementData.options.exactSolutions ?? [],
  }
}

function evaluateFreeTextElementResponse({
  elementData,
  results,
  anonymousResults,
  correctness,
  multiplier,
}: {
  elementData: FreeTextElementData
  results: ElementResultsOpen
  anonymousResults: ElementResultsOpen
  correctness: number | null
  multiplier?: number
}): FreeTextEvaluationReturnType | null {
  return {
    elementType: DB.ElementType.FREE_TEXT,
    feedbacks: [],
    numAnswers: results.total + anonymousResults.total,
    answers: combineFreeTextResults({
      results,
      anonymousResults,
    }),
    score: correctness
      ? correctness * POINTS_PER_INSTANCE * (multiplier ?? 1)
      : 0,
    xp: computeAwardedXp({
      pointsPercentage: correctness,
    }),
    percentile: correctness ?? 0,
    pointsMultiplier: multiplier ?? 1,
    explanation: elementData.explanation,
    solutions: elementData.options.solutions ?? [],
  }
}

function evaluateSelectionElementResponse({
  elementData,
  results,
  anonymousResults,
  correctness,
  multiplier,
}: {
  elementData: SelectionElementData
  results: ElementResultsSelection
  anonymousResults: ElementResultsSelection
  correctness: number | null
  multiplier?: number
}): SelectionEvaluationReturnType | null {
  return {
    elementType: DB.ElementType.SELECTION,
    feedbacks: [],
    numAnswers: results.total + anonymousResults.total,
    selectionResponses: combineSelectionResults({
      results,
      anonymousResults,
      answerOptions: elementData.options.answerCollection!,
    }),
    score: correctness
      ? Math.round(correctness * POINTS_PER_INSTANCE * (multiplier ?? 1))
      : 0,
    xp: computeAwardedXp({
      pointsPercentage: correctness,
    }),
    percentile: correctness ?? 0,
    pointsMultiplier: multiplier ?? 1,
    explanation: elementData.explanation,
    answerSolutionIds: elementData.options.answerCollectionSolutionIds ?? [],
  }
}

function evaluateCaseStudyElementResponse({
  elementData,
  results,
  anonymousResults,
  correctness,
  multiplier,
}: {
  elementData: CaseStudyElementData
  results: ElementResultsCaseStudy
  anonymousResults: ElementResultsCaseStudy
  correctness: number | null
  multiplier?: number
}): CaseStudyEvaluationReturnType | null {
  return {
    elementType: DB.ElementType.CASE_STUDY,
    feedbacks: [],
    numAnswers: results.total + anonymousResults.total,
    assessments: reduceCaseStudyResults({
      results,
      anonymousResults,
      options: elementData.options,
    }),
    studySolutions: elementData.options.cases.map((c) => ({
      caseId: c.id,
      solutions: elementData.options.hasSampleSolution ? c.solutions! : [],
    })),
    score: correctness
      ? Math.round(correctness * POINTS_PER_INSTANCE * (multiplier ?? 1))
      : 0,
    xp: computeAwardedXp({
      pointsPercentage: correctness,
    }),
    percentile: correctness ?? 0,
    pointsMultiplier: multiplier ?? 1,
    explanation: elementData.explanation,
  }
}

function computeQuestionEvaluation({
  elementData,
  results,
  anonymousResults,
  correctness,
  multiplier,
}: {
  elementData: ElementData
  results: ElementInstanceResults
  anonymousResults: ElementInstanceResults
  correctness: number | null
  multiplier?: number
}) {
  if (
    (elementData.type === DB.ElementType.SC ||
      elementData.type === DB.ElementType.MC ||
      elementData.type === DB.ElementType.KPRIM) &&
    'choices' in results &&
    'choices' in anonymousResults
  ) {
    return evaluateChoicesElementResponse({
      elementData,
      results,
      anonymousResults,
      correctness,
      multiplier,
    })
  } else if (
    elementData.type === DB.ElementType.NUMERICAL &&
    'responses' in results &&
    'responses' in anonymousResults
  ) {
    return evaluateNumericalElementResponse({
      elementData,
      results,
      anonymousResults,
      correctness,
      multiplier,
    })
  } else if (
    elementData.type === DB.ElementType.FREE_TEXT &&
    'responses' in results &&
    'responses' in anonymousResults
  ) {
    return evaluateFreeTextElementResponse({
      elementData,
      results,
      anonymousResults,
      correctness,
      multiplier,
    })
  } else if (
    elementData.type === DB.ElementType.SELECTION &&
    'selections' in results &&
    'selections' in anonymousResults
  ) {
    return evaluateSelectionElementResponse({
      elementData,
      results,
      anonymousResults,
      correctness,
      multiplier,
    })
  } else if (
    elementData.type === DB.ElementType.CASE_STUDY &&
    'assessments' in results &&
    'assessments' in anonymousResults
  ) {
    return evaluateCaseStudyElementResponse({
      elementData,
      results,
      anonymousResults,
      correctness,
      multiplier,
    })
  } else {
    return null
  }
}

export function evaluateChoicesAnswerCorrectness({
  elementData,
  response,
}: {
  elementData: ChoicesElementData
  response: ResponseInput
}) {
  if (
    !('choices' in response) ||
    response.choices === null ||
    typeof response.choices === 'undefined' ||
    ((elementData.type === DB.ElementType.SC ||
      elementData.type === DB.ElementType.MC) &&
      response.choices.length === 0)
  ) {
    return null
  }

  const elementOptions = elementData.options
  const solution = elementOptions.choices.reduce<number[]>((acc, choice) => {
    if (choice.correct) return [...acc, choice.ix]
    return acc
  }, [])

  if (elementData.type === DB.ElementType.SC) {
    const correctness = gradeQuestionSC({
      responseCount: elementOptions.choices.length,
      response: response.choices,
      solution,
    })
    return correctness
  } else if (elementData.type === DB.ElementType.MC) {
    const correctness = gradeQuestionMC({
      responseCount: elementOptions.choices.length,
      response: response.choices,
      solution,
    })
    return correctness
  } else {
    const correctness = gradeQuestionKPRIM({
      responseCount: elementOptions.choices.length,
      response: response.choices,
      solution,
    })
    return correctness
  }
}

export function evaluateNumericalAnswerCorrectness({
  elementData,
  response,
}: {
  elementData: NumericalElementData
  response: ResponseInput
}) {
  if (
    !('value' in response) ||
    response.value === null ||
    typeof response.value === 'undefined'
  ) {
    return null
  }

  const correctness = gradeQuestionNumerical({
    response: parseFloat(String(response.value)),
    solutionRanges: elementData.options.solutionRanges ?? [],
    exactSolutions: elementData.options.exactSolutions ?? [],
  })
  return correctness
}

export function evaluateFreeTextAnswerCorrectness({
  elementData,
  response,
  treatFTDefaultCorrect = false,
}: {
  elementData: FreeTextElementData
  response: ResponseInput
  treatFTDefaultCorrect?: boolean
}) {
  // if the corresponding option is activated, treat FT questions without a sample solution always as correct
  if (treatFTDefaultCorrect && !elementData.options.hasSampleSolution) {
    return 1
  }

  if (
    !('value' in response) ||
    response.value === null ||
    typeof response.value === 'undefined'
  ) {
    return null
  }

  const correctness = gradeQuestionFreeText({
    response: response.value,
    solutions: elementData.options.solutions ?? [],
  })
  return correctness
}

export function evaluateSelectionAnswerCorrectness({
  elementData,
  response,
}: {
  elementData: SelectionElementData
  response: ResponseInput
}) {
  if (!elementData.options.hasSampleSolution) {
    return 1
  }

  if (
    !('selection' in response) ||
    !response.selection ||
    response.selection.length === 0
  ) {
    return null
  }

  const correctness = gradeQuestionSelection({
    numberOfInputs: elementData.options.numberOfInputs!,
    response: response.selection,
    correctAnswers: elementData.options.answerCollectionSolutionIds,
  })
  return correctness
}

export function evaluateCaseStudyAnswerCorrectness({
  elementData,
  response,
}: {
  elementData: CaseStudyElementData
  response: ResponseInput
}) {
  if (!elementData.options.hasSampleSolution) {
    return 1
  }

  if (
    !('assessment' in response) ||
    !response.assessment ||
    response.assessment.length === 0
  ) {
    return null
  }

  const hasSolutions = elementData.options.cases.every(
    (caseItem) => caseItem.solutions && caseItem.solutions.length > 0
  )
  const correctness = hasSolutions
    ? gradeQuestionCaseStudy({
        response: response.assessment,
        solutions: elementData.options.cases.map((caseItem) => ({
          caseId: caseItem.id,
          itemSolutions: caseItem.solutions!,
        })),
      })
    : null
  return correctness
}

export function updateChoicesResults({
  previousResults,
  response,
}: {
  previousResults: ElementResultsChoices
  response: ResponseInput
}): { results: ElementResultsChoices; modified: boolean } {
  const results = previousResults
  let updatedResults = results

  if (
    !('choices' in response) ||
    response.choices === null ||
    typeof response.choices === 'undefined'
  ) {
    return { results, modified: false }
  }

  updatedResults.choices = (
    response as SingleQuestionResponseChoices
  ).choices.reduce((acc, choiceResponse) => {
    acc[choiceResponse.ix] = (acc[choiceResponse.ix] ?? 0) + 1
    return acc
  }, results.choices)
  updatedResults.total = results.total + 1
  return { results: updatedResults, modified: true }
}

export function updateNumericalResults({
  previousResults,
  elementData,
  response,
  correct,
}: {
  previousResults: ElementResultsOpen
  elementData: ElementData
  response: ResponseInput
  correct?: boolean
}): { results: ElementResultsOpen; modified: boolean } {
  // verify the input types
  if (elementData.type !== DB.ElementType.NUMERICAL) {
    return { results: previousResults, modified: false }
  }

  const MD5 = createHash('md5')
  const results = previousResults
  let updatedResults = results

  // validate format of response
  if (
    !('value' in response) ||
    typeof response.value === 'undefined' ||
    response.value === null ||
    response.value === ''
  ) {
    return { results, modified: false }
  }

  // make sure that restrictions are fulfilled
  const parsedValue = parseFloat(response.value)
  if (
    isNaN(parsedValue) ||
    (typeof elementData.options.restrictions?.min === 'number' &&
      parsedValue < elementData.options.restrictions.min) ||
    (typeof elementData.options.restrictions?.max === 'number' &&
      parsedValue > elementData.options.restrictions.max) ||
    parsedValue > 1e30 || // prevent overflow
    parsedValue < -1e30 // prevent underflow
  ) {
    return { results, modified: false }
  }

  const value = String(parsedValue)
  MD5.update(value)
  const hashedValue = MD5.digest('hex')

  if (Object.keys(results.responses).includes(hashedValue)) {
    updatedResults.responses = {
      ...results.responses,
      [hashedValue]: {
        ...results.responses[hashedValue]!,
        count: results.responses[hashedValue]!.count + 1,
      },
    }
  } else {
    updatedResults.responses = {
      ...results.responses,
      [hashedValue]: { value: value, count: 1, correct: correct },
    }
  }
  updatedResults.total = results.total + 1
  return { results: updatedResults, modified: true }
}

export function updateFreeTextResults({
  previousResults,
  elementData,
  response,
  correct,
}: {
  previousResults: ElementResultsOpen
  elementData: ElementData
  response: ResponseInput
  correct?: boolean
}): { results: ElementResultsOpen; modified: boolean } {
  // verify the input types
  if (elementData.type !== DB.ElementType.FREE_TEXT) {
    return { results: previousResults, modified: false }
  }

  const MD5 = createHash('md5')
  const results = previousResults
  let updatedResults = results

  // validate format of response and check that restrictions are fulfilled
  if (
    !('value' in response) ||
    typeof response.value === 'undefined' ||
    response.value === null ||
    response.value === '' ||
    (typeof elementData.options.restrictions?.maxLength === 'number' &&
      response.value.length > elementData.options.restrictions?.maxLength)
  ) {
    return { results, modified: false }
  }

  const value = toLowerCase(response.value.trim())
  MD5.update(value)
  const hashedValue = MD5.digest('hex')

  if (Object.keys(results.responses).includes(hashedValue)) {
    updatedResults.responses = {
      ...results.responses,
      [hashedValue]: {
        ...results.responses[hashedValue]!,
        count: results.responses[hashedValue]!.count + 1,
      },
    }
  } else {
    updatedResults.responses = {
      ...results.responses,
      [hashedValue]: {
        value: value,
        count: 1,
        correct: correct,
      },
    }
  }
  updatedResults.total = results.total + 1
  return { results: updatedResults, modified: true }
}

export function updateSelectionResults({
  previousResults,
  response,
}: {
  previousResults: ElementResultsSelection
  response: ResponseInput
}) {
  if (
    !('selection' in response) ||
    !response.selection ||
    response.selection.length === 0
  ) {
    return { results: previousResults, modified: false }
  }

  // increment all values in updatedSelections that are contained in response.selection
  let updatedSelections = { ...previousResults.selections }
  response.selection.forEach((ix) => {
    if (ix in updatedSelections && typeof updatedSelections[ix] === 'number') {
      updatedSelections[ix] = updatedSelections[ix] + 1
    }
  })

  return {
    results: {
      selections: updatedSelections,
      total: previousResults.total + 1,
    },
    modified: true,
  }
}

function convertCaseStudySolutionsObject({
  instance,
}: {
  instance: DB.ElementInstance
}): CaseStudySolutionsObject | undefined {
  // convert case study solutions to object for faster access (if sample solution is defined)
  const options = instance.elementData.options as CaseStudyElementOptions
  const caseStudySolutions = options.hasSampleSolution
    ? options.cases.reduce<CaseStudySolutionsObject>((acc, caseObj) => {
        acc[caseObj.id] = caseObj.solutions!.reduce(
          (itemAcc, { itemId, criteriaSolutions }) => {
            itemAcc[String(itemId)] = criteriaSolutions.reduce(
              (criterionAcc, { criterionId, min, max }) => {
                criterionAcc[criterionId] = { min, max }
                return criterionAcc
              },
              {}
            )
            return itemAcc
          },
          {}
        )
        return acc
      }, {})
    : undefined

  return caseStudySolutions
}

export function updateCaseStudyResults({
  previousResults,
  response,
  solutions,
}: {
  previousResults: ElementResultsCaseStudy
  response: ResponseInput
  solutions?: CaseStudySolutionsObject
}) {
  if (
    !('assessment' in response) ||
    !response.assessment ||
    response.assessment.length === 0
  ) {
    return { results: previousResults, modified: false }
  }

  // update aggregated assessments wherever new values are provided
  const newAssessments = { ...previousResults.assessments }
  response.assessment.forEach((caseResponse) => {
    const caseId = caseResponse.caseId

    caseResponse.itemResponses.forEach((itemResponse) => {
      const itemId = itemResponse.itemId

      itemResponse.criterionResponses.forEach((criterionResponse) => {
        const criterionId = criterionResponse.criterionId
        const responseValue = criterionResponse.response

        // hash response value for efficient access (as done for open results)
        const MD5 = createHash('md5')
        MD5.update(String(responseValue))
        const responseHash = MD5.digest('hex')

        // get existing responses for this case, item, and criterion
        const existingCombinedResponses =
          newAssessments[caseId]?.[String(itemId)]?.[criterionId]

        // compute correctness of new response value
        const sampleSolution =
          solutions?.[caseId]?.[String(itemId)]?.[criterionId]
        const responseCorrectness = sampleSolution
          ? responseValue >= sampleSolution.min - Number.EPSILON &&
            responseValue <= sampleSolution.max + Number.EPSILON
          : undefined

        // update existing response or create new response
        if (!existingCombinedResponses) {
          // even on initialization, all keys should already be set correctly
          throw new Error('Existing combined responses are missing')
        } else {
          // increment counter of existing identical response or create new entry otherwise
          if (Object.keys(existingCombinedResponses).includes(responseHash)) {
            newAssessments[caseId]![String(itemId)]![criterionId]![
              responseHash
            ] = {
              ...existingCombinedResponses[responseHash]!,
              count: existingCombinedResponses[responseHash]!.count + 1,
            }
          } else {
            newAssessments[caseId]![String(itemId)]![criterionId]![
              responseHash
            ] = {
              value: responseValue,
              count: 1,
              correct: responseCorrectness,
            }
          }
        }
      })
    })
  })

  return {
    results: {
      assessments: newAssessments,
      total: previousResults.total + 1,
    },
    modified: true,
  }
}

function updateQuestionResults({
  existingInstance,
  participation,
  response,
  caseStudySolutions,
  qrScanCode,
}: {
  existingInstance: DB.ElementInstance
  participation: (DB.Participation & { participant: DB.Participant }) | null
  response: ResponseInput
  caseStudySolutions?: CaseStudySolutionsObject
  qrScanCode?: string | null
}): {
  correctness: number | null
  results: ElementInstanceResults
  modified: boolean
} {
  let correctness: number | null
  const elementData = existingInstance.elementData
  const previousResults = participation
    ? existingInstance.results
    : existingInstance.anonymousResults

  if (
    (elementData.type === DB.ElementType.SC ||
      elementData.type === DB.ElementType.MC ||
      elementData.type === DB.ElementType.KPRIM) &&
    'choices' in previousResults
  ) {
    correctness = elementData.options.hasSampleSolution
      ? evaluateChoicesAnswerCorrectness({ elementData, response })
      : 1

    const res = updateChoicesResults({
      previousResults,
      response,
    })

    return {
      ...res,
      correctness,
    }
  } else if (
    elementData.type === DB.ElementType.NUMERICAL &&
    'responses' in previousResults
  ) {
    correctness = elementData.options.hasSampleSolution
      ? evaluateNumericalAnswerCorrectness({ elementData, response })
      : 1

    const res = updateNumericalResults({
      previousResults,
      elementData,
      response,
      correct: correctness === 1,
    })

    return {
      ...res,
      correctness,
    }
  } else if (elementData.type === DB.ElementType.QR_SCAN) {
    const value = normalizeQrScanCode(response.value)
    return {
      correctness: gradeQrScanResponse(qrScanCode, value) ? 1 : 0,
      results: { total: previousResults.total + 1 },
      modified: value !== '',
    }
  } else if (
    elementData.type === DB.ElementType.FREE_TEXT &&
    'responses' in previousResults
  ) {
    correctness = elementData.options.hasSampleSolution
      ? evaluateFreeTextAnswerCorrectness({ elementData, response })
      : 1

    const res = updateFreeTextResults({
      previousResults,
      elementData,
      response,
      correct: correctness === 1,
    })

    return {
      ...res,
      correctness,
    }
  } else if (
    elementData.type === DB.ElementType.SELECTION &&
    'selections' in previousResults
  ) {
    correctness = elementData.options.hasSampleSolution
      ? evaluateSelectionAnswerCorrectness({ elementData, response })
      : 1

    const res = updateSelectionResults({
      previousResults,
      response,
    })

    return {
      ...res,
      correctness,
    }
  } else if (
    elementData.type === DB.ElementType.CASE_STUDY &&
    'assessments' in previousResults
  ) {
    correctness = elementData.options.hasSampleSolution
      ? evaluateCaseStudyAnswerCorrectness({ elementData, response })
      : 1

    const res = updateCaseStudyResults({
      previousResults,
      response,
      solutions: caseStudySolutions,
    })

    return {
      ...res,
      correctness,
    }
  }

  return {
    correctness: null,
    results: previousResults,
    modified: true,
  }
}

function computeAwardedPointsAndXP({
  score,
  xp,
  existingResponse,
  participation,
  instance,
}: {
  score: number
  xp: number
  existingResponse: DB.QuestionResponse | null
  participation: DB.Participation | null
  instance: DB.ElementInstance
}): {
  pointsAwarded: number | null
  newPointsFrom: Date | undefined
  lastAwardedAt: Date | undefined
  lastXpAwardedAt: Date
  xpAwarded: number
  newXpFrom: Date
} {
  const participationActive = participation?.isActive ?? false

  // award points and xp based on the previous response being outside the timeframe
  if (existingResponse) {
    // update points (only if participation is active)
    const pointsOutsideTimeframe =
      !existingResponse.lastAwardedAt ||
      dayjs(existingResponse.lastAwardedAt).isBefore(
        dayjs().subtract(
          instance?.options.resetTimeDays ?? POINTS_AWARD_TIMEFRAME_DAYS,
          'days'
        )
      )

    let pointsAwarded: number | null
    let lastAwardedAt: Date | undefined
    let newPointsFrom: Date | undefined

    if (participationActive) {
      pointsAwarded = pointsOutsideTimeframe ? score : 0
      lastAwardedAt =
        pointsOutsideTimeframe || !existingResponse.lastAwardedAt
          ? new Date()
          : existingResponse.lastAwardedAt
      newPointsFrom = dayjs(lastAwardedAt)
        .add(
          instance?.options.resetTimeDays ?? POINTS_AWARD_TIMEFRAME_DAYS,
          'days'
        )
        .toDate()
    } else {
      pointsAwarded = null
      lastAwardedAt = undefined
      newPointsFrom = undefined
    }

    // update experience points (independent of active participation -> stored directly on participant)
    const xpOutsideTimeframe =
      !existingResponse.lastXpAwardedAt ||
      dayjs(existingResponse.lastXpAwardedAt).isBefore(
        dayjs().subtract(XP_AWARD_TIMEFRAME_DAYS, 'days')
      )

    const xpAwarded = xpOutsideTimeframe ? xp : 0
    const lastXpAwardedAt =
      xpOutsideTimeframe || !existingResponse.lastXpAwardedAt
        ? new Date()
        : existingResponse.lastXpAwardedAt
    const newXpFrom = dayjs(lastXpAwardedAt)
      .add(XP_AWARD_TIMEFRAME_DAYS, 'days')
      .toDate()

    return {
      pointsAwarded,
      newPointsFrom,
      lastAwardedAt,
      xpAwarded,
      newXpFrom,
      lastXpAwardedAt,
    }
  }

  // no previous response exists -> award points and xp based on the current response and if participation is active
  const lastAwardedAt = participationActive ? new Date() : undefined
  const newPointsFrom = participationActive
    ? dayjs(lastAwardedAt)
        .add(
          instance?.options.resetTimeDays ?? POINTS_AWARD_TIMEFRAME_DAYS,
          'days'
        )
        .toDate()
    : undefined
  const newXpFrom = dayjs(lastAwardedAt)
    .add(XP_AWARD_TIMEFRAME_DAYS, 'days')
    .toDate()

  return {
    pointsAwarded: participationActive ? score : null,
    newPointsFrom,
    lastAwardedAt,
    xpAwarded: xp,
    newXpFrom,
    lastXpAwardedAt: new Date(),
  }
}

function computeAggregatedResponsesChoices({
  instance,
  existingResponse,
  response,
}: {
  instance: DB.ElementInstance
  existingResponse: DB.QuestionResponse | null
  response: ResponseInput
}): ElementResultsChoices {
  let newAggResponses = (existingResponse?.aggregatedResponses ??
    getInitialInstanceResults(instance.elementData)) as ElementResultsChoices

  // update aggregated responses for choices
  newAggResponses.choices = (
    response as SingleQuestionResponseChoices
  ).choices.reduce((acc, choiceResponse) => {
    acc[choiceResponse.ix] = (acc[choiceResponse.ix] ?? 0) + 1
    return acc
  }, newAggResponses.choices)
  newAggResponses.total = newAggResponses.total + 1

  return newAggResponses
}

function computeAggregatedResponsesOpen({
  instance,
  existingResponse,
  responseValue,
  correctness,
}: {
  instance: DB.ElementInstance
  existingResponse: DB.QuestionResponse | null
  responseValue: string
  correctness: number
}) {
  let newAggResponses = (existingResponse?.aggregatedResponses ??
    getInitialInstanceResults(instance.elementData)) as ElementResultsOpen

  // update aggregated responses for open questions
  const MD5 = createHash('md5')
  MD5.update(responseValue)
  const hashedValue = MD5.digest('hex')

  if (Object.keys(newAggResponses.responses).includes(hashedValue)) {
    newAggResponses.responses = {
      ...newAggResponses.responses,
      [hashedValue]: {
        ...newAggResponses.responses[hashedValue]!,
        count: newAggResponses.responses[hashedValue]!.count + 1,
      },
    }
  } else {
    newAggResponses.responses = {
      ...newAggResponses.responses,
      [hashedValue]: {
        value: responseValue,
        count: 1,
        correct: correctness === 1,
      },
    }
  }
  newAggResponses.total = newAggResponses.total + 1

  return newAggResponses
}

function computeAggregatedResponsesSelection({
  instance,
  existingResponse,
  responseSelection,
}: {
  instance: DB.ElementInstance
  existingResponse: DB.QuestionResponse | null
  responseSelection: number[]
}) {
  if (!('answerCollection' in instance.elementData.options)) {
    throw new Error('Answer collection is missing in selection element')
  }

  const newAggResponses = (existingResponse?.aggregatedResponses ??
    getInitialInstanceResults(instance.elementData)) as ElementResultsSelection

  // increment all entries that are in response selection
  const updatedSelections = { ...newAggResponses.selections }
  responseSelection.forEach((ix) => {
    if (ix in updatedSelections && typeof updatedSelections[ix] === 'number') {
      updatedSelections[ix] = updatedSelections[ix] + 1
    }
  })

  newAggResponses.selections = updatedSelections
  newAggResponses.total = newAggResponses.total + 1
  return newAggResponses
}

function computeAggregatedResponsesCaseStudy({
  instance,
  existingResponse,
  responseAssessment,
  solutions,
}: {
  instance: DB.ElementInstance
  existingResponse: DB.QuestionResponse | null
  responseAssessment: CaseStudyCaseResponse[]
  solutions?: CaseStudySolutionsObject
}) {
  // check that all data required for results initialization is provided in instance
  if (
    !('items' in instance.elementData.options) ||
    !('cases' in instance.elementData.options) ||
    !('criteria' in instance.elementData.options)
  ) {
    throw new Error(
      'Items, cases, or criteria are missing in case study element'
    )
  }

  // initialize aggregated responses either empty or with previous values
  const newAggResponses = (existingResponse?.aggregatedResponses ??
    getInitialInstanceResults(instance.elementData)) as ElementResultsCaseStudy

  const updatedResults = updateCaseStudyResults({
    previousResults: newAggResponses,
    response: { assessment: responseAssessment },
    solutions,
  })

  return updatedResults.results
}

function computeAggregatedResponsesQuestion({
  instance,
  existingResponse,
  response,
  correctness,
  caseStudySolutions,
}: {
  instance: DB.ElementInstance
  existingResponse: DB.QuestionResponse | null
  response: ResponseInput
  correctness?: number | null
  caseStudySolutions?: CaseStudySolutionsObject
}): ElementInstanceResults | null {
  if (
    instance.elementType === DB.ElementType.SC ||
    instance.elementType === DB.ElementType.MC ||
    instance.elementType === DB.ElementType.KPRIM
  ) {
    return computeAggregatedResponsesChoices({
      instance,
      existingResponse,
      response,
    })
  } else if (
    instance.elementType === DB.ElementType.NUMERICAL ||
    instance.elementType === DB.ElementType.FREE_TEXT
  ) {
    return computeAggregatedResponsesOpen({
      instance,
      existingResponse,
      responseValue:
        instance.elementType === DB.ElementType.NUMERICAL
          ? String(parseFloat(response.value!))
          : toLowerCase(response.value!.trim()),
      correctness: correctness ?? 0,
    })
  } else if (instance.elementType === DB.ElementType.SELECTION) {
    return computeAggregatedResponsesSelection({
      instance,
      existingResponse,
      responseSelection: response.selection!,
    })
  } else if (instance.elementType === DB.ElementType.CASE_STUDY) {
    return computeAggregatedResponsesCaseStudy({
      instance,
      existingResponse,
      responseAssessment: response.assessment!,
      solutions: caseStudySolutions,
    })
  } else if (instance.elementType === DB.ElementType.QR_SCAN) {
    const previous = (existingResponse?.aggregatedResponses ?? {
      total: 0,
    }) as { total: number }
    return { total: previous.total + 1 }
  }

  return null
}

async function upsertQuestionResponse({
  prisma,
  id,
  participantId,
  courseId,
  response,
  correctness,
  score,
  pointsAwarded,
  lastAwardedAt,
  xpAwarded,
  lastXpAwardedAt,
  newAverageResponseTime,
  existingResponse,
  newAggResponses,
  practiceQuizId,
  microLearningId,
  resultSpacedRepetition,
}: {
  prisma: PrismaTransactionClient
  id: number
  participantId: string
  courseId: string
  response: ResponseInput
  correctness: number
  score: number
  pointsAwarded: number | null
  lastAwardedAt: Date
  xpAwarded: number
  lastXpAwardedAt: Date
  newAverageResponseTime: number
  existingResponse: DB.QuestionResponse | null
  newAggResponses: ElementInstanceResults
  practiceQuizId?: string
  microLearningId?: string
  resultSpacedRepetition: SpacedRepetitionResult
}) {
  const responseCorrectness =
    correctness === 1
      ? DB.ResponseCorrectness.CORRECT
      : correctness === 0
        ? DB.ResponseCorrectness.WRONG
        : DB.ResponseCorrectness.PARTIAL

  await prisma.questionResponse.upsert({
    where: {
      participantId_elementInstanceId: {
        participantId,
        elementInstanceId: id,
      },
    },
    create: {
      totalScore: score,
      totalPointsAwarded: pointsAwarded,
      totalXpAwarded: xpAwarded,
      trialsCount: 1,
      averageTimeSpent: newAverageResponseTime ?? 0,
      lastAwardedAt,
      lastXpAwardedAt,
      firstResponse: response as SingleQuestionResponse,
      firstResponseCorrectness: responseCorrectness,
      lastResponse: response as SingleQuestionResponse,
      lastResponseCorrectness: responseCorrectness,
      aggregatedResponses: newAggResponses,
      participant: {
        connect: { id: participantId },
      },
      elementInstance: {
        connect: { id },
      },
      practiceQuiz: practiceQuizId
        ? { connect: { id: practiceQuizId } }
        : undefined,
      microLearning: microLearningId
        ? { connect: { id: microLearningId } }
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

      // compute and store new correctness parameters
      ...combineNewCorrectnessParams({
        correct: correctness === 1,
        partial: correctness > 0 && correctness < 1,
        incorrect: correctness === 0,
      }),

      eFactor: resultSpacedRepetition.efactor,
      nextDueAt: resultSpacedRepetition.nextDueAt,
      interval: resultSpacedRepetition.interval,
    },
    update: {
      lastResponse: response as SingleQuestionResponse,
      lastResponseCorrectness: responseCorrectness,
      aggregatedResponses: newAggResponses,
      lastAwardedAt,
      lastXpAwardedAt,
      trialsCount: {
        increment: 1,
      },
      averageTimeSpent: newAverageResponseTime ?? 0,
      totalScore: {
        increment: score,
      },
      totalPointsAwarded:
        typeof pointsAwarded === 'number' ? { increment: pointsAwarded } : null,
      totalXpAwarded: {
        increment: xpAwarded,
      },

      ...combineCorrectnessParams({
        correct: correctness === 1,
        partial: correctness > 0 && correctness < 1,
        incorrect: correctness === 0,
        existingResponse,
      }),

      eFactor: resultSpacedRepetition.efactor,
      nextDueAt: resultSpacedRepetition.nextDueAt,
      interval: resultSpacedRepetition.interval,
    },
  })
}

async function createQuestionResponseDetail({
  prisma,
  id,
  participantId,
  courseId,
  response,
  score,
  pointsAwarded,
  xpAwarded,
  answerTime,
  practiceQuizId,
  microLearningId,
}: {
  prisma: PrismaTransactionClient
  id: number
  participantId: string
  courseId: string
  response: ResponseInput
  score: number
  pointsAwarded: number | null
  xpAwarded: number
  answerTime: number
  practiceQuizId?: string
  microLearningId?: string
}) {
  await prisma.questionResponseDetail.create({
    data: {
      score,
      pointsAwarded,
      xpAwarded,
      timeSpent: answerTime,
      response: response as SingleQuestionResponse,
      participant: {
        connect: { id: participantId },
      },
      elementInstance: {
        connect: { id },
      },
      practiceQuiz: practiceQuizId
        ? { connect: { id: practiceQuizId } }
        : undefined,
      microLearning: microLearningId
        ? { connect: { id: microLearningId } }
        : undefined,
      participation: {
        connect: {
          courseId_participantId: {
            courseId,
            participantId,
          },
        },
      },
    },
  })
}

async function incrementParticipantXp({
  prisma,
  participantId,
  xpAwarded,
}: {
  prisma: PrismaTransactionClient
  participantId: string
  xpAwarded: number
}) {
  await prisma.participant.update({
    where: {
      id: participantId,
    },
    data: {
      xp: {
        increment: xpAwarded,
      },
    },
  })
}

async function updateLeaderboardOnQuestionResponse({
  prisma,
  participantId,
  courseId,
  pointsAwarded,
}: {
  prisma: PrismaTransactionClient
  participantId: string
  courseId: string
  pointsAwarded: number
}) {
  await prisma.leaderboardEntry.upsert({
    where: {
      type_participantId_courseId: {
        type: 'COURSE',
        courseId,
        participantId,
      },
    },
    create: {
      type: 'COURSE',
      score: pointsAwarded,
      participant: {
        connect: {
          id: participantId,
        },
      },
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
    },
    update: {
      score: {
        increment: pointsAwarded,
      },
    },
  })
}

export async function respondToQuestion(
  {
    id,
    courseId,
    response,
    answerTime,
    participation,
    skipTracking,
  }: {
    id: number
    courseId: string
    response: ResponseInput
    answerTime: number
    participation: (DB.Participation & { participant: DB.Participant }) | null
    skipTracking?: boolean
  },
  ctx: Context
) {
  const result = await ctx.prisma.$transaction(async (prisma) => {
    const existingInstance = await getValidateElementInstance({
      prisma,
      id,
      participantId:
        ctx.user?.role === DB.UserRole.PARTICIPANT ? ctx.user?.sub : undefined,
    })

    // if the instance does not exist or the elementData is not defined, return early
    if (!existingInstance || !existingInstance?.elementData) {
      return null
    }

    const existingResponse =
      existingInstance.responses &&
      existingInstance.responses.length > 0 &&
      existingInstance.responses[0]
        ? existingInstance.responses[0]
        : null

    // conver the case study solutions to object form for more efficient access
    const caseStudySolutions =
      existingInstance.elementType === DB.ElementType.CASE_STUDY
        ? convertCaseStudySolutionsObject({
            instance: existingInstance,
          })
        : undefined

    // evaluate response correctness and compute updated instance results
    const { correctness, results, modified } = updateQuestionResults({
      existingInstance,
      participation,
      response,
      caseStudySolutions,
      qrScanCode: existingInstance.element.qrScanCode,
    })

    if (!modified || results === null) {
      return null
    }

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
      existingResponse: existingResponse, // this is safe because we only use it inside the function if the participation is defined
      newAverageInstanceTime,
      answerCorrect: correctness === 1,
      answerPartial: (correctness ?? 0) < 1 && (correctness ?? 0) > 0,
      answerIncorrect: correctness === 0,
      instanceInPracticeQuiz,
    })

    // update the element instance
    const updatedInstance = !skipTracking
      ? await prisma.elementInstance.update({
          where: { id },
          data: {
            results: participation ? results : undefined,
            anonymousResults: participation ? undefined : results,
            instanceStatistics: statisticsUpdate,
          },
          include: {
            elementStack: true,
          },
        })
      : existingInstance

    // compute question evaluation
    const questionEval = computeQuestionEvaluation({
      elementData: existingInstance.elementData,
      results: updatedInstance.results,
      anonymousResults: updatedInstance.anonymousResults,
      correctness,
      multiplier: updatedInstance.options.pointsMultiplier,
    })

    const effectiveEvaluation =
      existingInstance.elementType === DB.ElementType.QR_SCAN
        ? {
            score: correctness === 1 ? POINTS_PER_INSTANCE : 0,
            xp: 0,
            percentile: correctness ?? 0,
            pointsMultiplier: updatedInstance.options.pointsMultiplier ?? 1,
            explanation: existingInstance.elementData.explanation,
          }
        : questionEval

    // processing of percentile into status of instance
    const percentile = effectiveEvaluation?.percentile ?? 0
    const status =
      percentile === 0
        ? StackFeedbackStatus.INCORRECT
        : percentile === 1
          ? StackFeedbackStatus.CORRECT
          : StackFeedbackStatus.PARTIAL

    // if participant is not logged in, return early and return the evaluation
    if (
      !effectiveEvaluation ||
      !participation ||
      !ctx.user?.sub ||
      ctx.user.role !== DB.UserRole.PARTICIPANT
    ) {
      return {
        ...updatedInstance,
        evaluation: effectiveEvaluation
          ? {
              ...effectiveEvaluation,
              pointsAwarded: undefined,
              newPointsFrom: undefined,
              xpAwarded: undefined,
              newXpFrom: undefined,
            }
          : undefined,
        status,
      }
    }

    // compute the awarded points & XP and all associated dates
    const {
      pointsAwarded,
      newPointsFrom,
      lastAwardedAt,
      lastXpAwardedAt,
      xpAwarded,
      newXpFrom,
    } = computeAwardedPointsAndXP({
      score: effectiveEvaluation.score ?? 0,
      xp: effectiveEvaluation.xp ?? 0,
      existingResponse,
      participation,
      instance: updatedInstance,
    })

    // create a question response detail
    if (!skipTracking) {
      // compute updated aggregated responses
      const newAggResponses = computeAggregatedResponsesQuestion({
        instance: updatedInstance,
        existingResponse,
        response,
        correctness,
        caseStudySolutions,
      })

      if (!newAggResponses) {
        throw new Error(
          `Failed to compute aggregated responses for question type ${updatedInstance.elementType}`
        )
      }

      // update aggregated results for choices and open questions
      const streakIncrement = percentile === 1 ? 1 : 0
      const resultSpacedRepetition = updateSpacedRepetition({
        eFactor: existingResponse?.eFactor ?? 2.5,
        interval: existingResponse?.interval ?? 1,
        streak: (existingResponse?.correctCountStreak ?? 0) + streakIncrement,
        grade: percentile,
      })

      await createQuestionResponseDetail({
        prisma,
        id,
        participantId: ctx.user.sub,
        courseId,
        response,
        score: effectiveEvaluation.score ?? 0,
        pointsAwarded,
        xpAwarded,
        answerTime,
        practiceQuizId:
          updatedInstance.elementStack?.practiceQuizId ?? undefined,
        microLearningId:
          updatedInstance.elementStack?.microLearningId ?? undefined,
      })

      // upsert the question response
      await upsertQuestionResponse({
        prisma,
        id,
        participantId: ctx.user.sub,
        courseId,
        response,
        correctness: percentile,
        score: effectiveEvaluation.score ?? 0,
        pointsAwarded,
        lastAwardedAt: lastAwardedAt ?? new Date(),
        xpAwarded,
        lastXpAwardedAt: lastXpAwardedAt ?? new Date(),
        newAverageResponseTime,
        existingResponse,
        newAggResponses,
        practiceQuizId:
          updatedInstance.elementStack?.practiceQuizId ?? undefined,
        microLearningId:
          updatedInstance.elementStack?.microLearningId ?? undefined,
        resultSpacedRepetition,
      })

      // increment participant xp
      if (xpAwarded > 0) {
        await incrementParticipantXp({
          prisma,
          participantId: ctx.user.sub,
          xpAwarded,
        })
      }

      // create or increment the leaderboard entry, if the participant has an active participation in the course
      // active participation has already been checked during computation of pointsAwarded
      if (typeof pointsAwarded === 'number' && pointsAwarded !== null) {
        await updateLeaderboardOnQuestionResponse({
          prisma,
          participantId: ctx.user.sub,
          courseId,
          pointsAwarded,
        })
      }

      // if either XP or points are awarded, update the daily student timeline entry
      if (
        xpAwarded > 0 ||
        (typeof pointsAwarded === 'number' && pointsAwarded !== null)
      ) {
        await upsertDailyTimelineEntry({
          prisma,
          participantId: ctx.user.sub,
          courseId,
          xpAwarded,
          pointsAwarded: pointsAwarded ?? undefined,
        })
      }
    }

    return {
      ...updatedInstance,
      evaluation: {
        ...effectiveEvaluation,
        pointsAwarded,
        newPointsFrom,
        xpAwarded,
        newXpFrom,
      },
      status,
    }
  })

  return result
}
// #endregion

// ! Element & Stack Response & Combination Logic
// #region
async function respondToElement({
  ctx,
  response,
  courseId,
  answerTime,
  skipTracking = false,
}: {
  ctx: Context
  response: StackResponseInput
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
  } else if (response.type === DB.ElementType.QR_SCAN) {
    const qrScanResponse = normalizeQrScanCode(response.qrScanResponse)
    if (!isValidQrScanCode(qrScanResponse)) {
      throw new GraphQLError('Invalid QR scan response', {
        extensions: { code: 'BAD_USER_INPUT' },
      })
    }
    const result = await respondToQuestion(
      {
        id: response.instanceId,
        courseId,
        response: { value: qrScanResponse },
        answerTime,
        participation,
        skipTracking,
      },
      ctx
    )

    return result
      ? {
          grading: result.status,
          score: result.evaluation?.score ?? 0,
          evaluation: null,
        }
      : { grading: null, score: null, evaluation: null }
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
  responses: StackResponseInput[]
  stackAnswerTime: number
}

export async function respondToElementStack(
  { stackId, courseId, responses, stackAnswerTime }: RespondToElementStackInput,
  ctx: Context
) {
  const escapeRoomState = await prepareEscapeRoomStackSubmission(
    { stackId, courseId, responses },
    ctx
  )
  if (escapeRoomState.kind === 'skip') return null

  try {
    let stackScore: number | undefined = undefined
    let stackFeedback = StackFeedbackStatus.UNANSWERED
    const evaluationsArr: InstanceEvaluation[] = []

    // compute average answer time per element / question by dividing the
    // answer time for the entire stack through the number of responses
    const elementAnswerTime = round(stackAnswerTime / responses.length)

    for (const response of responses) {
      const { grading, score, evaluation } = await respondToElement({
        ctx,
        response,
        courseId,
        answerTime: elementAnswerTime,
        skipTracking: escapeRoomState.isOwner,
      })

      if (grading) {
        stackFeedback = combineStackStatus({
          prevStatus: stackFeedback,
          newStatus: grading,
        })
      }
      if (score !== null) {
        stackScore =
          typeof stackScore === 'undefined' ? score : stackScore + score
      }
      if (evaluation) {
        evaluationsArr.push(evaluation)
      }
    }

    await finalizeEscapeRoomStackSubmission(escapeRoomState, stackFeedback, ctx)

    return {
      id: stackId,
      status: stackFeedback,
      score: stackScore,
      evaluations: evaluationsArr,
    }
  } finally {
    await releaseEscapeRoomStackSubmission(escapeRoomState, ctx)
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

function combineChoicesResults({
  choices,
  results,
  anonymousResults,
}: {
  choices: Choice[]
  results: ElementResultsChoices['choices']
  anonymousResults: ElementResultsChoices['choices']
}) {
  return choices.map((choice) => ({
    ix: choice.ix,
    value: choice.value,
    count: (results[choice.ix] ?? 0) + (anonymousResults[choice.ix] ?? 0),
    correct: choice.correct,
    feedback: choice.feedback,
  }))
}

function combineNumericalResults({
  results,
  anonymousResults,
}: {
  results: ElementResultsOpen
  anonymousResults: ElementResultsOpen
}) {
  return [
    ...Object.values(results.responses),
    ...Object.values(anonymousResults.responses),
  ].reduce<{ value: number; count: number; correct?: boolean | null }[]>(
    (acc, response) => {
      const responseValue = parseFloat(response.value)
      const ix = acc.findIndex(
        (r) => Math.abs(r.value - responseValue) < Number.EPSILON
      )
      if (ix === -1) {
        acc.push({
          value: responseValue,
          count: response.count,
          correct: response.correct,
        })
      } else {
        acc[ix] = {
          ...acc[ix]!,
          count: acc[ix]!.count + response.count,
        }
      }
      return acc
    },
    []
  )
}

function combineFreeTextResults({
  results,
  anonymousResults,
}: {
  results: ElementResultsOpen
  anonymousResults: ElementResultsOpen
}) {
  return [
    ...Object.values(results.responses),
    ...Object.values(anonymousResults.responses),
  ].reduce<{ value: string; count: number; correct?: boolean | null }[]>(
    (acc, response) => {
      const ix = acc.findIndex((r) => r.value === response.value)
      if (ix === -1) {
        acc.push({
          value: response.value,
          count: response.count,
          correct: response.correct,
        })
      } else {
        acc[ix] = {
          ...acc[ix]!,
          count: acc[ix]!.count + response.count,
        }
      }
      return acc
    },
    []
  )
}

function combineSelectionResults({
  results,
  anonymousResults,
  answerOptions,
}: {
  results: ElementResultsSelection
  anonymousResults: ElementResultsSelection
  answerOptions: ElementOptionsAnswerCollection
}) {
  return answerOptions.entries.map((option) => ({
    answerId: option.id,
    value: option.value,
    count:
      (results.selections[option.id] ?? 0) +
      (anonymousResults.selections[option.id] ?? 0),
  }))
}

function reduceCaseStudyResults({
  results,
  anonymousResults,
  options,
}: {
  results: ElementResultsCaseStudy
  anonymousResults: ElementResultsCaseStudy
  options: ElementOptionsCaseStudy
}): SingleCaseStudyResponse[] {
  const combinedResponses = options.cases.flatMap((caseObj) =>
    options.items
      ? options.items.flatMap((item) =>
          options.criteria.map((criterion) => {
            const caseId = caseObj.id
            const itemId = item.id
            const criterionId = criterion.id

            // extract result and anonymous result values
            const resultValues = Object.values(
              results.assessments[caseId]?.[itemId]?.[criterionId] ?? {}
            ).map((r) => r.value)
            const anonymousResultValues = Object.values(
              anonymousResults.assessments[caseId]?.[itemId]?.[criterionId] ??
                {}
            ).map((r) => r.value)

            // combine the values into a single array with unique values
            const combinedResultValues = [
              ...new Set([...resultValues, ...anonymousResultValues]),
            ]

            return {
              caseId,
              itemId,
              criterionId,
              responseValues: combinedResultValues,
            }
          })
        )
      : []
  )

  return combinedResponses
}

function combineCaseStudyResults({
  results,
  anonymousResults,
  options,
}: {
  results: ElementResultsCaseStudy
  anonymousResults: ElementResultsCaseStudy
  options: ElementOptionsCaseStudy
}): ICaseStudyElementEvaluationResults['caseResults'] {
  return options.cases.map((caseObj) => {
    const caseSolutions = caseObj.solutions

    return {
      caseId: caseObj.id,
      items:
        options.items?.map((item) => {
          const itemSolutions = caseSolutions?.find((s) => s.itemId === item.id)

          return {
            itemId: item.id,
            criteria: options.criteria.map((criterion) => {
              const criterionSolution = itemSolutions?.criteriaSolutions.find(
                (c) => c.criterionId === criterion.id
              )
              const criterionResults =
                results.assessments[caseObj.id]?.[item.id]?.[criterion.id]
              const criterionAnonymousResults =
                anonymousResults.assessments[caseObj.id]?.[item.id]?.[
                  criterion.id
                ]

              // merge the results and anonymous results into a single object
              const mergedResults = [
                ...Object.entries(criterionResults ?? {}),
                ...Object.entries(criterionAnonymousResults ?? {}),
              ].reduce<{
                [valueHash: string]: {
                  value: number
                  count: number
                  correct?: boolean
                }
              }>((acc, [key, entry]) => {
                // if the key already exists in acc, sum up the counts
                if (acc[key]) {
                  acc[key] = {
                    value: acc[key]!.value,
                    count: acc[key]!.count + entry.count,
                    correct: acc[key]!.correct ?? entry.correct,
                  }
                } else {
                  acc[key] = entry
                }
                return acc
              }, {})

              // extract values from merged results
              const responses = Object.values(mergedResults)

              // if the criterion is a liker criterion, make sure the entire valid bar is included in the solution interval
              const isLikertCriterion = !!criterion.labels

              return {
                criterionId: criterion.id,
                name: criterion.name,
                min: criterion.min,
                max: criterion.max,
                step: criterion.step,
                unit: criterion.unit,
                labels: criterion.labels,

                solutionMin: criterionSolution?.min
                  ? isLikertCriterion
                    ? criterionSolution?.min - 0.5
                    : criterionSolution?.min
                  : undefined,
                solutionMax: criterionSolution?.max
                  ? isLikertCriterion
                    ? criterionSolution?.max + 0.5
                    : criterionSolution?.max
                  : undefined,

                statistics:
                  responses && responses.length > 0
                    ? (computeNumericalStatistics(responses) ?? undefined)
                    : undefined,
                responses,
              }
            }),
          }
        }) ?? [],
    }
  })
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

function computeNumericalStatistics(
  results: {
    value: number
    count: number
    correct?: boolean | null
  }[]
) {
  const valueArray = results.reduce<number[]>((acc, { count, value }) => {
    const elements = Array(count).fill(value)
    return acc.concat(elements)
  }, [])

  return valueArray.length > 0
    ? {
        max: max(valueArray),
        mean: mean(valueArray),
        median: median(valueArray),
        min: min(valueArray),
        q1: quantileSeq(valueArray, 0.25) as number,
        q3: quantileSeq(valueArray, 0.75) as number,
        sd: std(valueArray) as unknown as number, // since arrays are guaranteed to be flat -> return type always number
      }
    : null
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
