import {
  computeAwardedXp,
  computeSimpleAwardedPoints,
  gradeQuestionFreeText,
  gradeQuestionKPRIM,
  gradeQuestionMC,
  gradeQuestionNumerical,
  gradeQuestionSC,
} from '@klicker-uzh/grading'
import {
  type Element,
  type ElementInstance,
  ElementInstanceType,
  ElementOrderType,
  type ElementStack,
  ElementStackType,
  ElementType,
  type InstanceStatistics,
  type Participation,
  type QuestionResponse as PrismaQuestionResponse,
  PublicationStatus,
  ResponseCorrectness,
  UserRole,
} from '@klicker-uzh/prisma'
import type {
  AllElementTypeData,
  Choice,
  ContentResults,
  ElementInstanceResults,
  ElementResultsChoices,
  ElementResultsOpen,
  FlashcardResults,
  InstanceEvaluation,
  InstanceEvaluationChoices,
  InstanceEvaluationFreeText,
  InstanceEvaluationNumerical,
  SingleQuestionResponse,
  SingleQuestionResponseChoices,
  SingleQuestionResponseContent,
  SingleQuestionResponseFlashcard,
  SingleQuestionResponseValue,
  StackInput,
} from '@klicker-uzh/types'
import { FlashcardCorrectness, StackFeedbackStatus } from '@klicker-uzh/types'
import {
  getInitialElementResults,
  getInitialInstanceStatistics,
  processElementData,
} from '@klicker-uzh/util'
import dayjs from 'dayjs'
import { GraphQLError } from 'graphql'
import { round } from 'mathjs'
import { createHash } from 'node:crypto'
import { toLowerCase } from 'remeda'
import { v4 as uuidv4 } from 'uuid'
import type { Context, ContextWithUser } from '../lib/context.js'
import { orderStacks } from '../lib/util.js'
import type {
  FreeTextQuestionOptions,
  NumericalQuestionOptions,
  ResponseInput,
} from '../ops.js'

const POINTS_PER_INSTANCE = 10
const POINTS_AWARD_TIMEFRAME_DAYS = 6
const XP_AWARD_TIMEFRAME_DAYS = 1

const flashcardResultMap: Record<FlashcardCorrectness, StackFeedbackStatus> = {
  [FlashcardCorrectness.INCORRECT]: StackFeedbackStatus.INCORRECT,
  [FlashcardCorrectness.PARTIAL]: StackFeedbackStatus.PARTIAL,
  [FlashcardCorrectness.CORRECT]: StackFeedbackStatus.CORRECT,
}

export async function getPracticeQuizData(
  { id }: { id: string },
  ctx: Context
) {
  const quiz = await ctx.prisma.practiceQuiz.findUnique({
    where: {
      id,
      OR: [
        {
          status: PublicationStatus.PUBLISHED,
          isDeleted: false,
        },
        {
          status: PublicationStatus.SCHEDULED,
        },
        {
          ownerId: ctx.user?.sub,
        },
      ],
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

  // if the quiz is scheduled, return the quiz without the stacks
  if (quiz.status === PublicationStatus.SCHEDULED) {
    return { ...quiz, stacks: [] }
  }

  if (ctx.user?.sub && ctx.user.role === UserRole.PARTICIPANT) {
    // TODO: adapt the implementation to multiple instances per stack - resorting inside the stack does probably not make sense
    const orderedStacks =
      quiz.orderType === ElementOrderType.SPACED_REPETITION
        ? orderStacks(quiz.stacks)
        : quiz.stacks

    return {
      ...quiz,
      stacks: orderedStacks,
      numOfStacks: orderedStacks.length,
    }
  }

  return quiz
}

export function computeStackEvaluation(
  stacks: (ElementStack & { elements: ElementInstance[] })[]
) {
  return stacks.map((stack) => {
    return {
      stackId: stack.id!,
      stackName: stack.displayName,
      stackDescription: stack.description,
      stackOrder: stack.order,

      instances: stack.elements.flatMap((instance) => {
        let hasSampleSolution = false
        let hasAnswerFeedbacks = false
        const elementData = instance.elementData
        const instanceType = instance.elementData.type

        if (
          instanceType !== ElementType.FLASHCARD &&
          instanceType !== ElementType.CONTENT
        ) {
          hasSampleSolution =
            instance.elementData.options.hasSampleSolution ?? false
          hasAnswerFeedbacks =
            instance.elementData.options.hasAnswerFeedbacks ?? false
        }

        const commonInstanceData = {
          id: instance.id,
          type: instanceType,
          name: instance.elementData.name,
          content: instance.elementData.content,
          explanation: instance.elementData.explanation,

          hasSampleSolution,
          hasAnswerFeedbacks,
        }

        switch (instanceType) {
          case ElementType.SC:
          case ElementType.MC:
          case ElementType.KPRIM: {
            const instanceResults = instance.results as ElementResultsChoices
            const anonymousInstanceResults =
              instance.anonymousResults as ElementResultsChoices
            const choiceResults = instanceResults.choices
            const anonymousChoiceResults = anonymousInstanceResults.choices
            const availableChoices = instance.elementData.options
              .choices as Choice[]

            // combine anonymous and participant results into new format
            const choices = availableChoices.map((choice) => {
              return {
                value: choice.value,
                count:
                  (choiceResults[choice.ix] ?? 0) +
                  (anonymousChoiceResults[choice.ix] ?? 0),
                correct: choice.correct,
                feedback: choice.feedback,
              }
            })

            return {
              ...commonInstanceData,
              results: {
                totalAnswers:
                  instanceResults.total + anonymousInstanceResults.total,
                anonymousAnswers: anonymousInstanceResults.total,
                choices,
              },
            }
          }

          case ElementType.NUMERICAL: {
            const instanceResults = instance.results as ElementResultsOpen
            const anonymousInstanceResults =
              instance.anonymousResults as ElementResultsOpen
            const options = instance.elementData
              .options as NumericalQuestionOptions

            // combine anonymous and participant results into new format
            const nrResponses = [
              ...Object.values(instanceResults.responses),
              ...Object.values(anonymousInstanceResults.responses),
            ].reduce<
              { value: number; count: number; correct?: boolean | null }[]
            >((acc, response) => {
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
            }, [])

            return {
              ...commonInstanceData,
              results: {
                totalAnswers:
                  instanceResults.total + anonymousInstanceResults.total,
                anonymousAnswers: anonymousInstanceResults.total,
                maxValue: options.restrictions?.max,
                minValue: options.restrictions?.min,
                solutionRanges: options.solutionRanges,
                responseValues: nrResponses,
                // TODO: extend with statistics
              },
            }
          }

          case ElementType.FREE_TEXT: {
            const instanceResults = instance.results as ElementResultsOpen
            const anonymousInstanceResults =
              instance.anonymousResults as ElementResultsOpen
            const options = instance.elementData
              .options as FreeTextQuestionOptions

            // combine anonymous and participant results into new format
            const ftResponses = [
              ...Object.values(instanceResults.responses),
              ...Object.values(anonymousInstanceResults.responses),
            ].reduce<
              { value: string; count: number; correct?: boolean | null }[]
            >((acc, response) => {
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
            }, [])

            return {
              ...commonInstanceData,
              results: {
                totalAnswers:
                  instanceResults.total + anonymousInstanceResults.total,
                anonymousAnswers: anonymousInstanceResults.total,
                maxLength: options.restrictions?.maxLength,
                solutions: options.solutions,
                responses: ftResponses,
              },
            }
          }

          case ElementType.FLASHCARD: {
            const instanceResults = instance.results as FlashcardResults
            const anonymousInstanceResults =
              instance.anonymousResults as FlashcardResults

            return {
              ...commonInstanceData,
              results: {
                totalAnswers:
                  instanceResults.total + anonymousInstanceResults.total,
                anonymousAnswers: anonymousInstanceResults.total,
                correctCount:
                  instanceResults[FlashcardCorrectness.CORRECT] +
                  anonymousInstanceResults[FlashcardCorrectness.CORRECT],
                partialCount:
                  instanceResults[FlashcardCorrectness.PARTIAL] +
                  anonymousInstanceResults[FlashcardCorrectness.PARTIAL],
                incorrectCount:
                  instanceResults[FlashcardCorrectness.INCORRECT] +
                  anonymousInstanceResults[FlashcardCorrectness.INCORRECT],
              },
            }
          }

          case ElementType.CONTENT: {
            return {
              ...commonInstanceData,
              results: {
                totalAnswers:
                  instance.results.total + instance.anonymousResults.total,
                anonymousAnswers: instance.anonymousResults.total,
              },
            }
          }

          default:
            return []
        }
      }),
    }
  })
}

export async function getPracticeQuizEvaluation(
  {
    id,
  }: {
    id: string
  },
  ctx: ContextWithUser
) {
  const practiceQuiz = await ctx.prisma.practiceQuiz.findUnique({
    where: {
      id,
      status: PublicationStatus.PUBLISHED,
      isDeleted: false,
    },
    include: {
      stacks: {
        include: {
          elements: {
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

  if (!practiceQuiz) {
    return null
  }

  // compute evaluation
  const stackEvaluation = computeStackEvaluation(practiceQuiz.stacks)

  return {
    id: practiceQuiz.id,
    name: practiceQuiz.name,
    displayName: practiceQuiz.displayName,
    description: practiceQuiz.description,
    results: stackEvaluation,
  }
}

export async function getSinglePracticeQuiz(
  { id }: { id: string },
  ctx: Context
) {
  const quiz = await ctx.prisma.practiceQuiz.findUnique({
    where: {
      id,
      isDeleted: false,
    },
    include: {
      course: true,
      stacks: {
        include: {
          elements: {
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

  return quiz
}

interface CombineCorrectnessParamsInput {
  correct: boolean
  partial: boolean
  incorrect: boolean
  existingResponse?: PrismaQuestionResponse | null
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

function updateSpacedRepetition({
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
  existingInstance: ElementInstance & {
    instanceStatistics: InstanceStatistics | null
  }
  existingResponse: PrismaQuestionResponse | null
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
  participation: Participation | null
  existingResponse: PrismaQuestionResponse | null
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
          averageTimeSpent: newAverageInstanceTime,
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
                  ResponseCorrectness.CORRECT
              ),
          },
          lastPartialCorrectCount: {
            increment:
              Number(answerPartial && instanceInPracticeQuiz) -
              Number(
                existingResponse?.lastResponseCorrectness ===
                  ResponseCorrectness.PARTIAL
              ),
          },
          lastWrongCount: {
            increment:
              Number(answerIncorrect && instanceInPracticeQuiz) -
              Number(
                existingResponse?.lastResponseCorrectness ===
                  ResponseCorrectness.WRONG
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

export function updateFlashcardResults({
  previousResults,
  response,
}: {
  previousResults: FlashcardResults
  response: FlashcardCorrectness
}): FlashcardResults {
  return {
    ...previousResults,
    [response]: (previousResults[response] ?? 0) + 1,
    total: previousResults.total + 1,
  }
}

interface RespondToFlashcardInput {
  id: number
  courseId: string
  response: FlashcardCorrectness
  answerTime: number
}

async function respondToFlashcard(
  { id, courseId, response, answerTime }: RespondToFlashcardInput,
  ctx: Context
) {
  const transactionResult = await ctx.prisma.$transaction(async (prisma) => {
    const existingInstance = await prisma.elementInstance.findUnique({
      where: {
        id,
      },
      include: {
        elementStack: true,
        instanceStatistics: true,
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

    const existingResponse = ctx.user?.sub
      ? await prisma.questionResponse.findUnique({
          where: {
            participantId_elementInstanceId: {
              participantId: ctx.user.sub,
              elementInstanceId: id,
            },
          },
        })
      : null

    // create result from flashcard response
    const result = {
      grading: flashcardResultMap[response],
      score: null,
    }

    // fetch the participation of the participant
    const participation = ctx.user?.sub
      ? await prisma.participation.findUnique({
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

    const newResults = updateFlashcardResults({
      previousResults: participation
        ? (existingInstance.results as FlashcardResults)
        : (existingInstance.anonymousResults as FlashcardResults),
      response,
    })

    // average answer time computations if participant is logged in
    const { newAverageResponseTime, newAverageInstanceTime } = participation
      ? computeNewAverageTimes({
          existingInstance,
          existingResponse,
          answerTime,
        })
      : { newAverageInstanceTime: undefined, newAverageResponseTime: undefined }

    // variable summaries for code readability
    const answerCorrect = response === FlashcardCorrectness.CORRECT
    const answerPartial = response === FlashcardCorrectness.PARTIAL
    const answerIncorrect = response === FlashcardCorrectness.INCORRECT
    const instanceInPracticeQuiz =
      !!existingInstance.elementStack.practiceQuizId

    // compute updated instance statistics
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

    // if no user exists, return the grading for client display
    if (!ctx.user?.sub || !participation) {
      return result
    }

    // create question detail response
    await prisma.questionResponseDetail.create({
      data: {
        response: {
          correctness: response,
        },
        timeSpent: answerTime,
        participant: {
          connect: { id: ctx.user.sub },
        },
        elementInstance: {
          connect: { id },
        },
        practiceQuiz: existingInstance.elementStack.practiceQuizId
          ? {
              connect: {
                id: existingInstance.elementStack.practiceQuizId,
              },
            }
          : undefined,
        microLearning: existingInstance.elementStack.microLearningId
          ? {
              connect: {
                id: existingInstance.elementStack.microLearningId,
              },
            }
          : undefined,
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
    const aggregatedResponses =
      (existingResponse?.aggregatedResponses as FlashcardResults) ?? {
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
        ? ResponseCorrectness.CORRECT
        : correctness === 0
          ? ResponseCorrectness.WRONG
          : ResponseCorrectness.PARTIAL
    const resultSpacedRepetition = updateSpacedRepetition({
      eFactor: existingResponse?.eFactor ?? 2.5,
      interval: existingResponse?.interval ?? 1,
      streak: (existingResponse?.correctCountStreak ?? 0) + streakIncrement,
      grade: correctness,
    })

    await prisma.questionResponse.upsert({
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
        averageTimeSpent: newAverageResponseTime,
        elementInstance: {
          connect: { id },
        },
        practiceQuiz: existingInstance.elementStack.practiceQuizId
          ? {
              connect: {
                id: existingInstance.elementStack.practiceQuizId,
              },
            }
          : undefined,
        microLearning: existingInstance.elementStack.microLearningId
          ? {
              connect: {
                id: existingInstance.elementStack.microLearningId,
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
              participantId: ctx.user.sub,
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
        averageTimeSpent: newAverageResponseTime,
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
    return result
  })

  return transactionResult
}

interface RespondToContentInput {
  id: number
  courseId: string
  answerTime: number
}

async function respondToContent(
  { id, courseId, answerTime }: RespondToContentInput,
  ctx: Context
) {
  const transactionResult = await ctx.prisma.$transaction(async (prisma) => {
    const existingInstance = await prisma.elementInstance.findUnique({
      where: {
        id,
      },
      include: {
        elementStack: true,
        instanceStatistics: true,
      },
    })

    // check if the instance exists and the response is valid
    if (!existingInstance) {
      return null
    }

    const existingResponse = ctx.user?.sub
      ? await prisma.questionResponse.findUnique({
          where: {
            participantId_elementInstanceId: {
              participantId: ctx.user.sub,
              elementInstanceId: id,
            },
          },
        })
      : null

    // context elements can only be "read" when submitted
    const result = {
      grading: StackFeedbackStatus.CORRECT,
      score: null,
    }

    // fetch the participation of the participant
    const participation = ctx.user?.sub
      ? await prisma.participation.findUnique({
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

    // average answer time computations if participant is logged in
    const { newAverageResponseTime, newAverageInstanceTime } = participation
      ? computeNewAverageTimes({
          existingInstance,
          existingResponse,
          answerTime,
        })
      : { newAverageInstanceTime: undefined, newAverageResponseTime: undefined }

    // compute updated instance statistics
    const instanceInPracticeQuiz =
      !!existingInstance.elementStack.practiceQuizId
    const statisticsUpdate = computeUpdatedInstanceStatistics({
      participation,
      existingResponse,
      newAverageInstanceTime,
      answerCorrect: true,
      answerPartial: false,
      answerIncorrect: false,
      instanceInPracticeQuiz,
    })

    await prisma.elementInstance.update({
      where: {
        id,
      },
      data: {
        results: participation
          ? { total: existingInstance.results.total + 1 }
          : undefined,
        anonymousResults: participation
          ? undefined
          : {
              total: existingInstance.anonymousResults.total + 1,
            },
        instanceStatistics: statisticsUpdate,
      },
    })

    // if no user exists, return the grading for client display
    if (!ctx.user?.sub || !participation) {
      return result
    }

    // create question detail response
    await prisma.questionResponseDetail.create({
      data: {
        response: {
          viewed: true,
        },
        timeSpent: answerTime,
        participant: {
          connect: { id: ctx.user.sub },
        },
        elementInstance: {
          connect: { id },
        },
        practiceQuiz: existingInstance.elementStack.practiceQuizId
          ? {
              connect: {
                id: existingInstance.elementStack.practiceQuizId,
              },
            }
          : undefined,
        microLearning: existingInstance.elementStack.microLearningId
          ? {
              connect: {
                id: existingInstance.elementStack.microLearningId,
              },
            }
          : undefined,
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

    const aggregatedResponses =
      (existingResponse?.aggregatedResponses as ContentResults) ?? {
        total: 0,
      }

    const resultSpacedRepetition = updateSpacedRepetition({
      eFactor: existingResponse?.eFactor ?? 2.5,
      interval: existingResponse?.interval ?? 1,
      streak: (existingResponse?.correctCountStreak ?? 0) + 1,
      grade: 1,
    })

    // create / update question response
    await prisma.questionResponse.upsert({
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
        averageTimeSpent: newAverageResponseTime,
        elementInstance: {
          connect: { id },
        },
        practiceQuiz: existingInstance.elementStack.practiceQuizId
          ? {
              connect: {
                id: existingInstance.elementStack.practiceQuizId,
              },
            }
          : undefined,
        microLearning: existingInstance.elementStack.microLearningId
          ? {
              connect: {
                id: existingInstance.elementStack.microLearningId,
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
              participantId: ctx.user.sub,
            },
          },
        },
        // RESPONSE and aggregated response creation
        firstResponse: {
          viewed: true,
        },
        firstResponseCorrectness: ResponseCorrectness.CORRECT,
        lastResponse: {
          viewed: true,
        },
        lastResponseCorrectness: ResponseCorrectness.CORRECT,
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
        averageTimeSpent: newAverageResponseTime,
        lastResponse: {
          viewed: true,
        },
        lastResponseCorrectness: ResponseCorrectness.CORRECT,
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
    return result
  })

  return transactionResult
}

interface EvaluateAnswerCorrectnessArgs {
  elementData: AllElementTypeData
  response: ResponseInput
}

export function evaluateAnswerCorrectness({
  elementData,
  response,
}: EvaluateAnswerCorrectnessArgs) {
  switch (elementData.type) {
    case ElementType.SC:
    case ElementType.MC:
    case ElementType.KPRIM: {
      const elementOptions = elementData.options
      const solution = elementOptions.choices.reduce<number[]>(
        (acc, choice) => {
          if (choice.correct) return [...acc, choice.ix]
          return acc
        },
        []
      )

      if (elementData.type === ElementType.SC) {
        const correctness = gradeQuestionSC({
          responseCount: elementOptions.choices.length,
          response: (response as SingleQuestionResponseChoices).choices,
          solution,
        })
        return correctness
      } else if (elementData.type === ElementType.MC) {
        const correctness = gradeQuestionMC({
          responseCount: elementOptions.choices.length,
          response: (response as SingleQuestionResponseChoices).choices,
          solution,
        })
        return correctness
      } else {
        const correctness = gradeQuestionKPRIM({
          responseCount: elementOptions.choices.length,
          response: (response as SingleQuestionResponseChoices).choices,
          solution,
        })
        return correctness
      }
    }

    case ElementType.NUMERICAL: {
      const solutionRanges = (elementData.options as NumericalQuestionOptions)
        .solutionRanges

      const correctness = gradeQuestionNumerical({
        response: parseFloat(String(response.value)),
        solutionRanges: solutionRanges ?? [],
      })
      return correctness
    }

    case ElementType.FREE_TEXT: {
      const solutions = (elementData.options as FreeTextQuestionOptions)
        .solutions

      const correctness = gradeQuestionFreeText({
        response: response.value ?? '',
        solutions: solutions ?? [],
      })
      return correctness
    }

    default:
      return null
  }
}

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
  SharedEvaluationProps | 'solutionRanges' | 'answers'
>
type FreeTextEvaluationReturnType = Pick<
  InstanceEvaluationFreeText,
  SharedEvaluationProps | 'solutions' | 'answers'
>

function evaluateElementResponse(
  elementData: AllElementTypeData,
  results: any, // TODO: as soon as correctly typed element instance results are available, update this import and the type checking inside the function
  correctness: number | null,
  multiplier?: number
):
  | ChoicesEvaluationReturnType
  | NumericalEvaluationReturnType
  | FreeTextEvaluationReturnType
  | null {
  switch (elementData.type) {
    case ElementType.SC:
    case ElementType.MC:
    case ElementType.KPRIM: {
      // TODO: feedbacks only for selected options?
      // const feedbacks = elementData.options.choices.filter((choice) =>
      //   response.choices!.includes(choice.ix)
      // )

      const elementOptions = elementData.options
      const feedbacks = elementOptions.choices

      if (elementData.type === ElementType.SC) {
        return {
          elementType: ElementType.SC,
          feedbacks,
          numAnswers: results.total,
          choices: results.choices,
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
      } else if (elementData.type === ElementType.MC) {
        return {
          elementType: ElementType.MC,
          feedbacks,
          numAnswers: results.total,
          choices: results.choices,
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
      } else {
        return {
          elementType: ElementType.KPRIM,
          feedbacks,
          numAnswers: results.total,
          choices: results.choices,
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
    }

    case ElementType.NUMERICAL: {
      // TODO: add feedbacks here once they are implemented for specified solution ranges
      return {
        elementType: ElementType.NUMERICAL,
        feedbacks: [],
        numAnswers: results.total,
        answers: results?.responses ?? {},
        score: correctness ? correctness * 10 * (multiplier ?? 1) : 0,
        xp: computeAwardedXp({
          pointsPercentage: correctness,
        }),
        percentile: correctness ?? 0,
        pointsMultiplier: multiplier ?? 1,
        explanation: elementData.explanation,
      }
    }

    case ElementType.FREE_TEXT: {
      return {
        elementType: ElementType.FREE_TEXT,
        feedbacks: [],
        numAnswers: results.total,
        answers: elementData.options.hasSampleSolution
          ? (results.responses ?? {})
          : {},
        score: correctness ? correctness * 10 * (multiplier ?? 1) : 0,
        xp: computeAwardedXp({
          pointsPercentage: correctness,
        }),
        percentile: correctness ?? 0,
        pointsMultiplier: multiplier ?? 1,
        explanation: elementData.explanation,
      }
    }

    default:
      return null
  }
}

interface UpdateQuestionResultsInputs {
  previousResults: ElementInstanceResults
  elementData: AllElementTypeData
  response: ResponseInput
  correct?: boolean
}

export function updateQuestionResults({
  previousResults,
  elementData,
  response,
  correct,
}: UpdateQuestionResultsInputs) {
  const MD5 = createHash('md5')

  switch (elementData.type) {
    case ElementType.SC:
    case ElementType.MC:
    case ElementType.KPRIM: {
      const results = previousResults as ElementResultsChoices
      let updatedResults: ElementResultsChoices = results

      updatedResults.choices = (
        response as SingleQuestionResponseChoices
      ).choices.reduce(
        (acc, ix) => ({
          ...acc,
          [ix]: acc[ix]! + 1,
        }),
        results.choices
      )
      updatedResults.total = results.total + 1
      return { results: updatedResults, modified: true }
    }

    case ElementType.NUMERICAL: {
      const results = previousResults as ElementResultsOpen
      let updatedResults: ElementResultsOpen = results

      if (
        typeof response.value === 'undefined' ||
        response.value === null ||
        response.value === ''
      ) {
        return { results: results, modified: false }
      }

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
        return { results: results, modified: false }
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

    case ElementType.FREE_TEXT: {
      const results = previousResults as ElementResultsOpen
      let updatedResults: ElementResultsOpen = results

      if (
        typeof response.value === 'undefined' ||
        response.value === null ||
        response.value === '' ||
        (typeof elementData.options.restrictions?.maxLength === 'number' &&
          response.value.length > elementData.options.restrictions?.maxLength)
      ) {
        return { results: results, modified: false }
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

    default:
      return { results: null, modified: false }
  }
}

export async function respondToQuestion(
  {
    courseId,
    id,
    response,
    answerTime,
  }: {
    courseId: string
    id: number
    response: ResponseInput
    answerTime: number
  },
  ctx: Context
) {
  const MD5 = createHash('md5')
  let treatAnonymous = false

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

  // if the participant is logged in does not participate in the course, treat him as anonymous
  if (ctx.user?.sub && !participation) {
    treatAnonymous = true
  }

  const {
    instance,
    existingResponse,
    updatedInstance,
    correctness,
    newAverageResponseTime,
    validResponse,
  } = await ctx.prisma.$transaction(async (prisma) => {
    const instance = await prisma.elementInstance.findUnique({
      where: { id },
      include: {
        elementStack: true,
        instanceStatistics: true,
      },
    })

    if (!instance || !instance?.elementData) {
      return {
        instance: null,
        existingResponse: null,
        updatedInstance: null,
        correctness: null,
        newAverageResponseTime: null,
        validResponse: false,
      }
    }

    const existingResponse = ctx.user?.sub
      ? await ctx.prisma.questionResponse.findUnique({
          where: {
            participantId_elementInstanceId: {
              participantId: ctx.user.sub,
              elementInstanceId: id,
            },
          },
        })
      : null

    // evaluate the correctness of the response
    const elementData = instance?.elementData

    let correctness: number | null
    if (
      elementData.type === ElementType.CONTENT ||
      elementData.type === ElementType.FLASHCARD
    ) {
      correctness = 1
    } else {
      correctness = elementData.options.hasSampleSolution
        ? evaluateAnswerCorrectness({ elementData, response })
        : 1
    }

    const updatedResults = updateQuestionResults({
      previousResults:
        ctx.user?.sub && !treatAnonymous
          ? instance.results
          : instance.anonymousResults,
      elementData,
      response,
      correct: correctness === 1,
    })

    if (!updatedResults.results) {
      return {
        instance: null,
        existingResponse: null,
        updatedInstance: null,
        correctness: null,
        newAverageResponseTime: null,
        validResponse: false,
      }
    }

    // average answer time computations if participant is logged in
    const { newAverageResponseTime, newAverageInstanceTime } = participation
      ? computeNewAverageTimes({
          existingInstance: instance,
          existingResponse: existingResponse, // this is safe because we check for the participation before
          answerTime,
        })
      : {
          newAverageInstanceTime: undefined,
          newAverageResponseTime: undefined,
        }

    // variable summaries for code readability
    const answerCorrect = correctness === 1
    const answerPartial = (correctness ?? 0) < 1 && (correctness ?? 0) > 0
    const answerIncorrect = correctness === 0
    const instanceInPracticeQuiz = !!instance.elementStack.practiceQuizId

    // compute updated instance statistics
    const statisticsUpdate = computeUpdatedInstanceStatistics({
      participation,
      existingResponse: existingResponse, // this is safe because we only use it inside the function if the participation is defined
      newAverageInstanceTime,
      answerCorrect,
      answerPartial,
      answerIncorrect,
      instanceInPracticeQuiz,
    })

    const updatedInstance = await prisma.elementInstance.update({
      where: { id },
      data: {
        results: participation ? updatedResults.results : undefined,
        anonymousResults: participation ? undefined : updatedResults.results,
        instanceStatistics: statisticsUpdate,
      },
      include: {
        elementStack: true,
      },
    })

    return {
      instance,
      existingResponse,
      updatedInstance,
      correctness,
      newAverageResponseTime,
      validResponse: true,
    }
  })

  const elementData = updatedInstance?.elementData
  const results = updatedInstance?.results

  if (
    !instance ||
    !updatedInstance ||
    !elementData ||
    !validResponse ||
    correctness === null
  ) {
    return null
  }

  const evaluation = evaluateElementResponse(
    elementData,
    results,
    correctness,
    updatedInstance.options.pointsMultiplier
  )
  const score = evaluation?.score ?? 0

  let xp: number | null
  if (
    elementData.type === ElementType.CONTENT ||
    elementData.type === ElementType.FLASHCARD
  ) {
    xp = 0
  } else {
    xp = elementData.options.hasSampleSolution ? (evaluation?.xp ?? 0) : 0
  }
  let pointsAwarded
  let newPointsFrom
  let lastAwardedAt
  let lastXpAwardedAt
  let xpAwarded
  let newXpFrom
  const promises: any[] = []

  // if the user is logged in and the last response was not within the past 6 days
  // award points and update the response
  if (
    ctx.user?.sub &&
    !treatAnonymous &&
    ctx.user.role === UserRole.PARTICIPANT
  ) {
    if (existingResponse) {
      const previousResponseOutsideTimeframe =
        !existingResponse.lastAwardedAt ||
        dayjs(existingResponse.lastAwardedAt).isBefore(
          dayjs().subtract(
            instance?.options.resetTimeDays ?? POINTS_AWARD_TIMEFRAME_DAYS,
            'days'
          )
        )

      if (previousResponseOutsideTimeframe) {
        pointsAwarded = score
      } else {
        pointsAwarded = 0
      }

      const previousXpResponseOutsideTimeframe =
        !existingResponse.lastXpAwardedAt ||
        dayjs(existingResponse.lastXpAwardedAt).isBefore(
          dayjs().subtract(XP_AWARD_TIMEFRAME_DAYS, 'days')
        )

      if (previousXpResponseOutsideTimeframe) {
        xpAwarded = xp
      } else {
        xpAwarded = 0
      }

      lastAwardedAt = previousResponseOutsideTimeframe
        ? new Date()
        : existingResponse.lastAwardedAt
      lastXpAwardedAt = previousXpResponseOutsideTimeframe
        ? new Date()
        : existingResponse.lastXpAwardedAt
      newPointsFrom = dayjs(lastAwardedAt)
        .add(
          instance?.options.resetTimeDays ?? POINTS_AWARD_TIMEFRAME_DAYS,
          'days'
        )
        .toDate()
      newXpFrom = dayjs(lastXpAwardedAt)
        .add(XP_AWARD_TIMEFRAME_DAYS, 'days')
        .toDate()
    } else {
      pointsAwarded = score
      xpAwarded = xp

      lastAwardedAt = new Date()
      lastXpAwardedAt = new Date()
      newPointsFrom = dayjs(lastAwardedAt)
        .add(
          instance?.options.resetTimeDays ?? POINTS_AWARD_TIMEFRAME_DAYS,
          'days'
        )
        .toDate()
      newXpFrom = dayjs(lastAwardedAt)
        .add(XP_AWARD_TIMEFRAME_DAYS, 'days')
        .toDate()
    }

    // if the user is not participating in the leaderboard, do not award points
    if (ctx.user.sub && participation?.isActive === false) {
      pointsAwarded = null
      lastAwardedAt = undefined
    }

    // update aggregated results for choices and open questions
    let newAggResponses
    if (
      instance.elementType === ElementType.SC ||
      instance.elementType === ElementType.MC ||
      instance.elementType === ElementType.KPRIM
    ) {
      newAggResponses = (existingResponse?.aggregatedResponses ??
        getInitialElementResults({
          type: instance.elementType,
          options: instance.elementData.options,
        } as Element)) as ElementResultsChoices

      // update aggregated responses for choices
      newAggResponses.choices = (
        response as SingleQuestionResponseChoices
      ).choices.reduce(
        (acc, ix) => ({
          ...acc,
          [ix]: acc[ix]! + 1,
        }),
        newAggResponses.choices
      )
      newAggResponses.total = newAggResponses.total + 1
    } else {
      newAggResponses = (existingResponse?.aggregatedResponses ??
        getInitialElementResults({
          type: instance.elementType,
        } as Element)) as ElementResultsOpen

      // update aggregated responses for open questions
      if (instance.elementType === ElementType.NUMERICAL) {
        const value = String(parseFloat(response.value!))
        MD5.update(value)
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
              value: value,
              count: 1,
              correct: correctness === 1,
            },
          }
        }
        newAggResponses.total = newAggResponses.total + 1
      } else {
        const value = toLowerCase(response.value!.trim())
        MD5.update(value)
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
              value: value,
              count: 1,
              correct: correctness === 1,
            },
          }
        }
        newAggResponses.total = newAggResponses.total + 1
      }
    }

    const streakIncrement = correctness === 1 ? 1 : 0
    const resultSpacedRepetition = updateSpacedRepetition({
      eFactor: existingResponse?.eFactor ?? 2.5,
      interval: existingResponse?.interval ?? 1,
      streak: (existingResponse?.correctCountStreak ?? 0) + streakIncrement,
      grade: correctness,
    })

    const responseCorrectness =
      correctness === 1
        ? ResponseCorrectness.CORRECT
        : correctness === 0
          ? ResponseCorrectness.WRONG
          : ResponseCorrectness.PARTIAL

    promises.push(
      ctx.prisma.questionResponse.upsert({
        where: {
          participantId_elementInstanceId: {
            participantId: ctx.user.sub,
            elementInstanceId: id,
          },
        },
        create: {
          totalScore: score,
          totalPointsAwarded: pointsAwarded,
          totalXpAwarded: xpAwarded,
          trialsCount: 1,
          averageTimeSpent: newAverageResponseTime,
          lastAwardedAt,
          lastXpAwardedAt,
          firstResponse: response as SingleQuestionResponse,
          firstResponseCorrectness: responseCorrectness,
          lastResponse: response as SingleQuestionResponse,
          lastResponseCorrectness: responseCorrectness,
          aggregatedResponses: newAggResponses,
          participant: {
            connect: { id: ctx.user.sub },
          },
          elementInstance: {
            connect: { id },
          },
          practiceQuiz: updatedInstance.elementStack.practiceQuizId
            ? {
                connect: {
                  id: updatedInstance.elementStack.practiceQuizId,
                },
              }
            : undefined,
          microLearning: updatedInstance.elementStack.microLearningId
            ? {
                connect: {
                  id: updatedInstance.elementStack.microLearningId,
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
                participantId: ctx.user.sub,
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
          averageTimeSpent: newAverageResponseTime,
          totalScore: {
            increment: score,
          },
          totalPointsAwarded:
            typeof pointsAwarded === 'number'
              ? {
                  increment: pointsAwarded,
                }
              : null,
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
      }),
      ctx.prisma.questionResponseDetail.create({
        data: {
          score,
          pointsAwarded,
          xpAwarded,
          timeSpent: answerTime,
          response: response as SingleQuestionResponse,
          participant: {
            connect: { id: ctx.user.sub },
          },
          elementInstance: {
            connect: { id },
          },
          practiceQuiz: updatedInstance.elementStack.practiceQuizId
            ? {
                connect: {
                  id: updatedInstance.elementStack.practiceQuizId,
                },
              }
            : undefined,
          microLearning: updatedInstance.elementStack.microLearningId
            ? {
                connect: {
                  id: updatedInstance.elementStack.microLearningId,
                },
              }
            : undefined,
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
    )

    if (typeof xpAwarded === 'number' && xpAwarded > 0) {
      promises.push(
        ctx.prisma.participant.update({
          where: {
            id: ctx.user.sub,
          },
          data: {
            xp: {
              increment: xpAwarded,
            },
          },
        })
      )
    }

    if (typeof pointsAwarded === 'number') {
      promises.push(
        ctx.prisma.leaderboardEntry.upsert({
          where: {
            type_participantId_courseId: {
              type: 'COURSE',
              courseId,
              participantId: ctx.user.sub,
            },
          },
          create: {
            type: 'COURSE',
            score: pointsAwarded,
            participant: {
              connect: {
                id: ctx.user.sub,
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
                  participantId: ctx.user.sub,
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
      )
    }
  }

  await ctx.prisma.$transaction(promises)

  // processing of percentile into status of instance
  const status =
    evaluation?.percentile === 0
      ? StackFeedbackStatus.INCORRECT
      : evaluation?.percentile === 1
        ? StackFeedbackStatus.CORRECT
        : StackFeedbackStatus.PARTIAL

  return {
    ...updatedInstance,
    evaluation: evaluation
      ? {
          ...evaluation,
          pointsAwarded,
          newPointsFrom,
          xpAwarded,
          newXpFrom,
          solutions:
            elementData.type === ElementType.FREE_TEXT
              ? elementData.options.hasSampleSolution
                ? elementData.options.solutions
                : []
              : null,
          solutionRanges:
            elementData.type === ElementType.NUMERICAL
              ? elementData.options.solutionRanges
              : null,
        }
      : undefined,
    status: status,
  }
}

function combineStackStatus({
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

export async function getPreviousStackEvaluation(
  { stackId }: { stackId: number },
  ctx: Context
) {
  // previous results only exist for logged in users
  if (!ctx.user?.sub) {
    return null
  }

  const stackEvaluation = await ctx.prisma.elementStack.findUnique({
    where: { id: stackId, type: ElementStackType.MICROLEARNING },
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
    !stackEvaluation ||
    !stackEvaluation.elements ||
    !stackEvaluation.elements[0] ||
    !stackEvaluation.elements[0].responses
  ) {
    return null
  }

  // aggregate the evaluation content from the responses
  let stackScore: number | undefined = undefined
  let stackFeedback = StackFeedbackStatus.UNANSWERED

  // TODO: investigate if this logic can be combined with content of the respondToElementStack
  // function once it is refactored and split up into smaller functions
  const evaluations: InstanceEvaluation[] = stackEvaluation.elements.flatMap(
    (element) => {
      if (!element.responses || element.responses.length === 0) {
        return []
      }

      if (element.elementType === ElementType.FLASHCARD) {
        const lastResponse = element.responses[0]!
          .lastResponse as SingleQuestionResponseFlashcard
        stackFeedback = combineStackStatus({
          prevStatus: stackFeedback,
          newStatus: flashcardResultMap[lastResponse.correctness],
        })

        return {
          ...element.elementData,
          instanceId: element.id,
          elementType: ElementType.FLASHCARD,
          score: 0,
          correctness: null,
          lastResponse: element.responses[0]!
            .lastResponse as SingleQuestionResponseFlashcard,
        }
      } else if (element.elementType === ElementType.CONTENT) {
        stackFeedback = combineStackStatus({
          prevStatus: stackFeedback,
          newStatus: StackFeedbackStatus.CORRECT,
        })

        return {
          ...element.elementData,
          instanceId: element.id,
          elementType: ElementType.CONTENT,
          score: 0,
          correctness: 1,
          lastResponse: element.responses[0]!
            .lastResponse as SingleQuestionResponseContent,
        }
      } else if (
        (element.elementData.type === ElementType.SC ||
          element.elementData.type === ElementType.MC ||
          element.elementData.type === ElementType.KPRIM) &&
        (element.elementType === ElementType.SC ||
          element.elementType === ElementType.MC ||
          element.elementType === ElementType.KPRIM)
      ) {
        const elementData = element.elementData
        const lastResponse = element.responses[0]!
          .lastResponse as SingleQuestionResponseChoices
        const correctness = evaluateAnswerCorrectness({
          elementData,
          response: lastResponse,
        })

        const evaluation = evaluateElementResponse(
          elementData,
          element.results,
          correctness,
          element.options.pointsMultiplier
        )

        // update stack aggregates
        stackFeedback = combineStackStatus({
          prevStatus: stackFeedback,
          newStatus:
            correctness === 1
              ? StackFeedbackStatus.CORRECT
              : correctness === 0
                ? StackFeedbackStatus.INCORRECT
                : StackFeedbackStatus.PARTIAL,
        })
        stackScore = (stackScore ?? 0) + (evaluation?.score ?? 0)

        return {
          ...evaluation,
          ...element.elementData,
          instanceId: element.id,
          pointsAwarded: evaluation?.score,
          xpAwarded: evaluation?.xp,
          correctness,
          lastResponse,
        } as InstanceEvaluation
      } else if (
        element.elementData.type === ElementType.NUMERICAL &&
        element.elementType === ElementType.NUMERICAL
      ) {
        const elementData = element.elementData
        const lastResponse = element.responses[0]!
          .lastResponse as SingleQuestionResponseValue
        const correctness = evaluateAnswerCorrectness({
          elementData,
          response: lastResponse,
        })

        const evaluation = evaluateElementResponse(
          elementData,
          element.results,
          correctness,
          element.options.pointsMultiplier
        )

        // update stack aggregates
        stackFeedback = combineStackStatus({
          prevStatus: stackFeedback,
          newStatus:
            correctness === 1
              ? StackFeedbackStatus.CORRECT
              : correctness === 0
                ? StackFeedbackStatus.INCORRECT
                : StackFeedbackStatus.PARTIAL,
        })
        stackScore = (stackScore ?? 0) + (evaluation?.score ?? 0)

        return {
          ...evaluation,
          ...element.elementData,
          instanceId: element.id,
          pointsAwarded: evaluation?.score,
          xpAwarded: evaluation?.xp,
          solutionRanges: elementData.options.hasSampleSolution
            ? elementData.options.solutionRanges
            : [],
          correctness,
          lastResponse,
        } as InstanceEvaluation
      } else if (
        element.elementData.type === ElementType.FREE_TEXT &&
        element.elementType === ElementType.FREE_TEXT
      ) {
        const elementData = element.elementData
        const lastResponse = element.responses[0]!
          .lastResponse as SingleQuestionResponseValue
        const correctness = evaluateAnswerCorrectness({
          elementData,
          response: lastResponse,
        })

        const evaluation = evaluateElementResponse(
          elementData,
          element.results,
          correctness,
          element.options.pointsMultiplier
        )

        // update stack aggregates
        stackFeedback = combineStackStatus({
          prevStatus: stackFeedback,
          newStatus:
            correctness === 1
              ? StackFeedbackStatus.CORRECT
              : correctness === 0
                ? StackFeedbackStatus.INCORRECT
                : StackFeedbackStatus.PARTIAL,
        })
        stackScore = (stackScore ?? 0) + (evaluation?.score ?? 0)

        return {
          ...evaluation,
          ...element.elementData,
          instanceId: element.id,
          pointsAwarded: evaluation?.score,
          xpAwarded: evaluation?.xp,
          solutions: elementData.options.hasSampleSolution
            ? elementData.options.solutions
            : [],
          correctness,
          lastResponse,
        } as InstanceEvaluation
      } else {
        throw new Error(
          'Evaluation of previous stack answers not implemented for type ' +
            element.elementType
        )
      }
    }
  )

  return {
    id: stackEvaluation.id,
    status: stackFeedback,
    score: stackScore,
    evaluations,
  }
}

export interface RespondToElementStackInput {
  stackId: number
  courseId: string
  responses: {
    instanceId: number
    type: ElementType
    flashcardResponse?: FlashcardCorrectness | null
    contentReponse?: boolean | null
    choicesResponse?: number[] | null
    numericalResponse?: number | null
    freeTextResponse?: string | null
  }[]
  stackAnswerTime: number
}

export async function respondToElementStack(
  { stackId, courseId, responses, stackAnswerTime }: RespondToElementStackInput,
  ctx: Context
) {
  // if the element stack is part of a microlearning and the student has already responses to it, ignore this submission
  if (ctx.user?.sub) {
    const stack = await ctx.prisma.elementStack.findUnique({
      where: { id: stackId },
      include: {
        microLearning: true,
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

    if (
      stack?.microLearning &&
      (stack.elements.some((element) => element.responses.length > 0) ||
        dayjs().isAfter(dayjs(stack.microLearning.scheduledEndAt)))
    ) {
      return null
    }
  }

  let stackScore: number | undefined = undefined
  let stackFeedback = StackFeedbackStatus.UNANSWERED
  const evaluationsArr: InstanceEvaluation[] = []

  // compute average answer time per element / question by dividing the
  // answer time for the entire stack through the number of responses
  const elementAnswerTime = round(stackAnswerTime / responses.length)

  // TODO: refactor this into a transaction and single combination of status and score for the stack
  for (const response of responses) {
    if (response.type === ElementType.FLASHCARD) {
      const result = await respondToFlashcard(
        {
          id: response.instanceId,
          courseId: courseId,
          response: response.flashcardResponse!,
          answerTime: elementAnswerTime,
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
          answerTime: elementAnswerTime,
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
    } else if (
      response.type === ElementType.SC ||
      response.type === ElementType.MC ||
      response.type === ElementType.KPRIM
    ) {
      const result = await respondToQuestion(
        {
          courseId: courseId,
          id: response.instanceId,
          response: { choices: response.choicesResponse },
          answerTime: elementAnswerTime,
        },
        ctx
      )

      if (result) {
        stackFeedback = combineStackStatus({
          prevStatus: stackFeedback,
          newStatus: result.status,
        })

        stackScore =
          typeof stackScore === 'undefined'
            ? result.evaluation?.score
            : stackScore + (result.evaluation?.score ?? 0)

        evaluationsArr.push({
          instanceId: response.instanceId,
          ...result.evaluation,
        } as InstanceEvaluation)
      }
    } else if (response.type === ElementType.NUMERICAL) {
      const result = await respondToQuestion(
        {
          courseId: courseId,
          id: response.instanceId,
          response: { value: String(response.numericalResponse) },
          answerTime: elementAnswerTime,
        },
        ctx
      )

      if (result) {
        stackFeedback = combineStackStatus({
          prevStatus: stackFeedback,
          newStatus: result.status,
        })

        stackScore =
          typeof stackScore === 'undefined'
            ? result.evaluation?.score
            : stackScore + (result.evaluation?.score ?? 0)

        evaluationsArr.push({
          instanceId: response.instanceId,
          ...result.evaluation,
        } as InstanceEvaluation)
      }
    } else if (response.type === ElementType.FREE_TEXT) {
      const result = await respondToQuestion(
        {
          courseId: courseId,
          id: response.instanceId,
          response: { value: response.freeTextResponse },
          answerTime: elementAnswerTime,
        },
        ctx
      )

      if (result) {
        stackFeedback = combineStackStatus({
          prevStatus: stackFeedback,
          newStatus: result.status,
        })

        stackScore =
          typeof stackScore === 'undefined'
            ? result.evaluation?.score
            : stackScore + (result.evaluation?.score ?? 0)

        evaluationsArr.push({
          instanceId: response.instanceId,
          ...result.evaluation,
        } as InstanceEvaluation)
      }
    } else {
      throw new Error(
        'Submission of practice quiz stack answers not implemented for type ' +
          response.type
      )
    }
  }

  return {
    id: stackId,
    status: stackFeedback,
    score: stackScore,
    evaluations: evaluationsArr,
  }
}

interface ManipulatePracticeQuizArgs {
  id?: string
  name: string
  displayName: string
  description?: string | null
  stacks: StackInput[]
  courseId: string
  multiplier: number
  order: ElementOrderType
  availableFrom?: Date | null
  resetTimeDays: number
}

export async function manipulatePracticeQuiz(
  {
    id,
    name,
    displayName,
    description,
    stacks,
    courseId,
    multiplier,
    order,
    availableFrom,
    resetTimeDays,
  }: ManipulatePracticeQuizArgs,
  ctx: ContextWithUser
) {
  if (id) {
    // find all instances belonging to the old session and delete them as the content of the questions might have changed
    const oldElement = await ctx.prisma.practiceQuiz.findUnique({
      where: {
        id,
        ownerId: ctx.user.sub,
        isDeleted: false,
      },
      include: {
        stacks: {
          include: {
            elements: true,
          },
        },
      },
    })

    if (!oldElement) {
      throw new GraphQLError('Practice quiz not found')
    }
    if (oldElement.status === PublicationStatus.PUBLISHED) {
      throw new GraphQLError('Cannot edit a published practice quiz')
    }

    await ctx.prisma.practiceQuiz.update({
      where: { id },
      data: {
        stacks: {
          deleteMany: {},
        },
      },
    })
  }

  const elements = stacks
    .flatMap((stack) => stack.elements)
    .map((stackElem) => stackElem.elementId)
    .filter(
      (stackElem) => stackElem !== null && typeof stackElem !== 'undefined'
    )

  const dbElements = await ctx.prisma.element.findMany({
    where: {
      id: { in: elements },
      ownerId: ctx.user.sub,
    },
  })

  const uniqueElements = new Set(dbElements.map((q) => q.id))
  if (dbElements.length !== uniqueElements.size) {
    throw new GraphQLError('Not all elements could be found')
  }

  const elementMap = dbElements.reduce<Record<number, Element>>(
    (acc, elem) => ({ ...acc, [elem.id]: elem }),
    {}
  )

  const availabilityTime =
    availableFrom && dayjs(availableFrom).isBefore(dayjs())
      ? null
      : (availableFrom ?? undefined)

  const createOrUpdateJSON = {
    name: name.trim(),
    displayName: displayName.trim(),
    description,
    pointsMultiplier: multiplier,
    orderType: order,
    availableFrom: availabilityTime,
    resetTimeDays: resetTimeDays,
    stacks: {
      create: stacks.map((stack) => {
        return {
          type: ElementStackType.PRACTICE_QUIZ,
          order: stack.order,
          displayName: stack.displayName?.trim() ?? '',
          description: stack.description ?? '',
          options: {},
          elements: {
            create: stack.elements.map((elem) => {
              const element = elementMap[elem.elementId]!
              const processedElementData = processElementData(element)
              const initialResults = getInitialElementResults(element)

              return {
                elementType: element.type,
                migrationId: uuidv4(),
                order: elem.order,
                type: ElementInstanceType.PRACTICE_QUIZ,
                elementData: processedElementData,
                options: {
                  pointsMultiplier: multiplier * element.pointsMultiplier,
                  resetTimeDays,
                },
                results: initialResults,
                anonymousResults: initialResults,
                instanceStatistics: {
                  create: getInitialInstanceStatistics(
                    ElementInstanceType.PRACTICE_QUIZ
                  ),
                },
                element: {
                  connect: { id: element.id },
                },
                owner: {
                  connect: { id: ctx.user.sub },
                },
              }
            }),
          },
        }
      }),
    },
    owner: {
      connect: { id: ctx.user.sub },
    },
    course: {
      connect: { id: courseId },
    },
  }

  const element = await ctx.prisma.practiceQuiz.upsert({
    where: { id: id ?? uuidv4() },
    create: createOrUpdateJSON,
    update: createOrUpdateJSON,
    include: {
      course: true,
      stacks: {
        include: {
          elements: {
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

  ctx.emitter.emit('invalidate', {
    typename: 'PracticeQuiz',
    id,
  })

  return element
}

interface GetBookmarksPracticeQuizArgs {
  quizId?: string | null
  courseId: string
}

export async function getBookmarksPracticeQuiz(
  { quizId, courseId }: GetBookmarksPracticeQuizArgs,
  ctx: Context
) {
  if (!ctx.user?.sub) {
    return null
  }

  const participation = await ctx.prisma.participation.findUnique({
    where: {
      courseId_participantId: {
        courseId,
        participantId: ctx.user.sub,
      },
    },
    include: {
      bookmarkedElementStacks: {
        where: {
          practiceQuizId: quizId ?? undefined,
        },
      },
    },
  })

  return participation?.bookmarkedElementStacks.map((stack) => stack.id)
}

interface UnpublishPracticeQuizArgs {
  id: string
}

export async function unpublishPracticeQuiz(
  { id }: UnpublishPracticeQuizArgs,
  ctx: ContextWithUser
) {
  const practiceQuiz = await ctx.prisma.practiceQuiz.update({
    where: {
      id,
      ownerId: ctx.user.sub,
      status: PublicationStatus.SCHEDULED,
    },
    data: {
      status: PublicationStatus.DRAFT,
    },
    include: {
      stacks: {
        include: {
          elements: true,
        },
      },
    },
  })

  return practiceQuiz
}

export async function getPracticeQuizSummary(
  { id }: { id: string },
  ctx: ContextWithUser
) {
  const practiceQuiz = await ctx.prisma.practiceQuiz.findUnique({
    where: {
      id,
      ownerId: ctx.user.sub,
    },
    include: {
      stacks: {
        include: {
          elements: true,
        },
      },
    },
  })

  if (!practiceQuiz) {
    return null
  }

  const { responses, anonymousResponses } = practiceQuiz.stacks.reduce(
    (acc, stack) => {
      const elem_counts = stack.elements.reduce(
        (acc_elem, instance) => {
          acc_elem.responses += instance.results.total
          acc_elem.anonymousResponses += instance.anonymousResults.total
          return acc_elem
        },
        { responses: 0, anonymousResponses: 0 }
      )

      acc.responses += elem_counts.responses
      acc.anonymousResponses += elem_counts.anonymousResponses
      return acc
    },
    { responses: 0, anonymousResponses: 0 }
  )

  return {
    numOfResponses: responses,
    numOfAnonymousResponses: anonymousResponses,
  }
}

interface DeletePracticeQuizArgs {
  id: string
}

export async function deletePracticeQuiz(
  { id }: DeletePracticeQuizArgs,
  ctx: ContextWithUser
) {
  const practiceQuiz = await ctx.prisma.practiceQuiz.findUnique({
    where: {
      id,
      ownerId: ctx.user.sub,
    },
    include: {
      responses: true,
    },
  })

  if (!practiceQuiz) {
    return null
  }

  // if the practice quiz is not published yet or has no responses -> hard deletion
  // anonymous results are ignored, since deleting them does not have an impage on data consistency
  if (
    practiceQuiz.status === PublicationStatus.DRAFT ||
    practiceQuiz.status === PublicationStatus.SCHEDULED ||
    practiceQuiz.responses.length === 0
  ) {
    const deletedItem = await ctx.prisma.practiceQuiz.delete({
      where: {
        id,
        ownerId: ctx.user.sub,
      },
    })

    ctx.emitter.emit('invalidate', { typename: 'PracticeQuiz', id })

    return deletedItem
  } else {
    // if the practice quiz is published and has responses -> soft deletion
    const updatedPracticeQuiz = await ctx.prisma.practiceQuiz.update({
      where: {
        id,
        ownerId: ctx.user.sub,
      },
      data: {
        isDeleted: true,
      },
      include: {
        stacks: true,
      },
    })

    // disconnect the stacks from the course they are linked to
    const stackIds = updatedPracticeQuiz.stacks.map((stack) => stack.id)
    await ctx.prisma.elementStack.updateMany({
      where: {
        id: {
          in: stackIds,
        },
      },
      data: {
        courseId: null,
      },
    })

    ctx.emitter.emit('invalidate', { typename: 'PracticeQuiz', id })
    return updatedPracticeQuiz
  }
}

interface PublishPracticeQuizArgs {
  id: string
}

export async function publishPracticeQuiz(
  { id }: PublishPracticeQuizArgs,
  ctx: ContextWithUser
) {
  const practiceQuiz = await ctx.prisma.practiceQuiz.findUnique({
    where: {
      id,
      ownerId: ctx.user.sub,
      isDeleted: false,
    },
  })

  if (!practiceQuiz) {
    return null
  }

  // if the practice quiz starts in the future, change its status to scheduled, otherwise publish it
  if (
    practiceQuiz.availableFrom &&
    dayjs(practiceQuiz.availableFrom).isAfter(dayjs())
  ) {
    // change the status of the practice quiz to scheduled for the cronjob to identify it and publish it at the given time
    const updatedQuiz = await ctx.prisma.practiceQuiz.update({
      where: {
        id,
        ownerId: ctx.user.sub,
      },
      data: {
        status: PublicationStatus.SCHEDULED,
      },
    })

    ctx.emitter.emit('invalidate', {
      typename: 'PracticeQuiz',
      id,
    })

    return updatedQuiz
  } else {
    // publish practice quiz completely and link all stacks to the course
    const updatedQuiz = await ctx.prisma.practiceQuiz.update({
      where: {
        id,
        ownerId: ctx.user.sub,
      },
      data: {
        status: PublicationStatus.PUBLISHED,
      },
      include: {
        stacks: true,
      },
    })

    // connect all elementStacks in the practice quiz to the course
    const courseId = updatedQuiz.courseId
    await ctx.prisma.course.update({
      where: {
        id: courseId,
      },
      data: {
        elementStacks: {
          connect: updatedQuiz.stacks.map((stack) => ({ id: stack.id })),
        },
      },
    })

    ctx.emitter.emit('invalidate', {
      typename: 'PracticeQuiz',
      id,
    })

    return updatedQuiz
  }
}
