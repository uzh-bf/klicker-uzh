import { createHash } from 'node:crypto'
import * as DB from '@klicker-uzh/prisma/client'
import type {
  CaseStudySolutionsObject,
  ElementInstanceResults,
  ElementResultsCaseStudy,
  ElementResultsChoices,
  ElementResultsOpen,
  ElementResultsSelection,
  SingleQuestionResponse,
  SingleQuestionResponseChoices,
} from '@klicker-uzh/types'
import { StackFeedbackStatus } from '@klicker-uzh/types'
import {
  getInitialInstanceResults,
  type PrismaTransactionClient,
} from '@klicker-uzh/util'
import { toLowerCase } from 'remeda'
import type { CaseStudyCaseResponse, ResponseInput } from '../ops.js'
import { upsertDailyTimelineEntry } from './participants.js'
import { computeQuestionEvaluation } from './questionResponseEvaluation.js'
import {
  convertCaseStudySolutionsObject,
  updateCaseStudyResults,
  updateQuestionResults,
} from './questionResponseResults.js'
import {
  combineCorrectnessParams,
  combineNewCorrectnessParams,
  computeAwardedPointsAndXP,
  computeAwardOverrideDates,
  computeNewAverageTimes,
  computeUpdatedInstanceStatistics,
  type SpacedRepetitionResult,
  updateSpacedRepetition,
} from './responseTracking.js'

export type QuestionResponseActor = {
  participation: DB.Participation & { participant: DB.Participant }
}

export type QuestionResponseEvaluationPolicy =
  | { kind: 'DEFAULT' }
  | {
      kind: 'PRECOMPUTED'
      correctness: number
      award: {
        pointsAwarded: number | null
        xpAwarded: number
      }
    }

export type ApplyQuestionResponseInput = {
  id: number
  courseId: string
  response: ResponseInput
  answerTime: number
  actor: QuestionResponseActor | null
  skipTracking?: boolean
  evaluationPolicy?: QuestionResponseEvaluationPolicy
}

type ComputedQuestionEvaluation = NonNullable<
  ReturnType<typeof computeQuestionEvaluation>
>

export type AppliedQuestionResponse = {
  status: StackFeedbackStatus
  evaluation:
    | (ComputedQuestionEvaluation & {
        pointsAwarded: number | null | undefined
        newPointsFrom: Date | undefined
        xpAwarded: number | undefined
        newXpFrom: Date | undefined
      })
    | undefined
  responseDetailId: number | undefined
}

async function loadQuestionInstance({
  prisma,
  id,
  participantId,
}: {
  prisma: PrismaTransactionClient
  id: number
  participantId?: string
}) {
  return await prisma.elementInstance.findUnique({
    where: { id },
    include: {
      elementStack: true,
      instanceStatistics: true,
      responses: participantId
        ? {
            where: { participantId },
          }
        : false,
    },
  })
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
  const newAggResponses = (existingResponse?.aggregatedResponses ??
    getInitialInstanceResults(instance.elementData)) as ElementResultsChoices

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
  const newAggResponses = (existingResponse?.aggregatedResponses ??
    getInitialInstanceResults(instance.elementData)) as ElementResultsOpen
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
  if (
    !('items' in instance.elementData.options) ||
    !('cases' in instance.elementData.options) ||
    !('criteria' in instance.elementData.options)
  ) {
    throw new Error(
      'Items, cases, or criteria are missing in case study element'
    )
  }

  const newAggResponses = (existingResponse?.aggregatedResponses ??
    getInitialInstanceResults(instance.elementData)) as ElementResultsCaseStudy
  return updateCaseStudyResults({
    previousResults: newAggResponses,
    response: { assessment: responseAssessment },
    solutions,
  }).results
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
      participantId_elementInstanceId: { participantId, elementInstanceId: id },
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
      participant: { connect: { id: participantId } },
      elementInstance: { connect: { id } },
      practiceQuiz: practiceQuizId
        ? { connect: { id: practiceQuizId } }
        : undefined,
      microLearning: microLearningId
        ? { connect: { id: microLearningId } }
        : undefined,
      course: { connect: { id: courseId } },
      participation: {
        connect: {
          courseId_participantId: { courseId, participantId },
        },
      },
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
      trialsCount: { increment: 1 },
      averageTimeSpent: newAverageResponseTime ?? 0,
      totalScore: { increment: score },
      totalPointsAwarded:
        typeof pointsAwarded === 'number' ? { increment: pointsAwarded } : null,
      totalXpAwarded: { increment: xpAwarded },
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
  return await prisma.questionResponseDetail.create({
    data: {
      score,
      pointsAwarded,
      xpAwarded,
      timeSpent: answerTime,
      response: response as SingleQuestionResponse,
      participant: { connect: { id: participantId } },
      elementInstance: { connect: { id } },
      practiceQuiz: practiceQuizId
        ? { connect: { id: practiceQuizId } }
        : undefined,
      microLearning: microLearningId
        ? { connect: { id: microLearningId } }
        : undefined,
      participation: {
        connect: {
          courseId_participantId: { courseId, participantId },
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
    where: { id: participantId },
    data: { xp: { increment: xpAwarded } },
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
      participant: { connect: { id: participantId } },
      course: { connect: { id: courseId } },
      participation: {
        connect: {
          courseId_participantId: { courseId, participantId },
        },
      },
    },
    update: { score: { increment: pointsAwarded } },
  })
}

export async function applyQuestionResponseInTransaction(
  {
    id,
    courseId,
    response,
    answerTime,
    actor,
    skipTracking,
    evaluationPolicy = { kind: 'DEFAULT' },
  }: ApplyQuestionResponseInput,
  prisma: PrismaTransactionClient
): Promise<AppliedQuestionResponse | null> {
  if (actor && actor.participation.courseId !== courseId) {
    throw new Error('Question response actor does not belong to this course')
  }
  const participantId = actor?.participation.participantId
  const participation = actor?.participation ?? null
  const existingInstance = await loadQuestionInstance({
    prisma,
    id,
    participantId,
  })

  if (!existingInstance?.elementData) {
    return null
  }

  const existingResponse =
    existingInstance.responses &&
    existingInstance.responses.length > 0 &&
    existingInstance.responses[0]
      ? existingInstance.responses[0]
      : null
  const caseStudySolutions =
    existingInstance.elementType === DB.ElementType.CASE_STUDY
      ? convertCaseStudySolutionsObject({ instance: existingInstance })
      : undefined
  const { correctness, results, modified } = updateQuestionResults({
    existingInstance,
    participation,
    response,
    caseStudySolutions,
    correctnessOverride:
      evaluationPolicy.kind === 'PRECOMPUTED'
        ? evaluationPolicy.correctness
        : undefined,
  })

  if (!modified || results === null) {
    return null
  }

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
  const statisticsUpdate = computeUpdatedInstanceStatistics({
    participation,
    existingResponse,
    newAverageInstanceTime,
    answerCorrect: correctness === 1,
    answerPartial: (correctness ?? 0) < 1 && (correctness ?? 0) > 0,
    answerIncorrect: correctness === 0,
    instanceInPracticeQuiz: !!existingInstance.elementStack?.practiceQuizId,
  })
  const updatedInstance = !skipTracking
    ? await prisma.elementInstance.update({
        where: { id },
        data: {
          results: participation ? results : undefined,
          anonymousResults: participation ? undefined : results,
          instanceStatistics: statisticsUpdate,
        },
        include: { elementStack: true },
      })
    : existingInstance
  const questionEval = computeQuestionEvaluation({
    elementData: existingInstance.elementData,
    results: updatedInstance.results,
    anonymousResults: updatedInstance.anonymousResults,
    correctness,
    multiplier: updatedInstance.options.pointsMultiplier,
  })
  const percentile = questionEval?.percentile ?? 0
  const status =
    percentile === 0
      ? StackFeedbackStatus.INCORRECT
      : percentile === 1
        ? StackFeedbackStatus.CORRECT
        : StackFeedbackStatus.PARTIAL

  if (!questionEval || !actor) {
    return {
      evaluation: questionEval
        ? {
            ...questionEval,
            pointsAwarded: undefined,
            newPointsFrom: undefined,
            xpAwarded: undefined,
            newXpFrom: undefined,
          }
        : undefined,
      status,
      responseDetailId: undefined,
    }
  }

  const activeParticipantId = actor.participation.participantId

  let {
    pointsAwarded,
    newPointsFrom,
    lastAwardedAt,
    lastXpAwardedAt,
    xpAwarded,
    newXpFrom,
  } = computeAwardedPointsAndXP({
    score: questionEval.score ?? 0,
    xp: questionEval.xp ?? 0,
    existingResponse,
    participation,
    instance: updatedInstance,
  })

  if (evaluationPolicy.kind === 'PRECOMPUTED') {
    pointsAwarded = evaluationPolicy.award.pointsAwarded
    xpAwarded = evaluationPolicy.award.xpAwarded
    const overrideDates = computeAwardOverrideDates({
      pointsAwarded,
      xpAwarded,
      instance: updatedInstance,
      lastAwardedAt,
      lastXpAwardedAt,
      newPointsFrom,
      newXpFrom,
    })
    lastAwardedAt = overrideDates.lastAwardedAt
    lastXpAwardedAt = overrideDates.lastXpAwardedAt
    newPointsFrom = overrideDates.newPointsFrom
    newXpFrom = overrideDates.newXpFrom
  }

  let responseDetailId: number | undefined
  if (!skipTracking) {
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

    const resultSpacedRepetition = updateSpacedRepetition({
      eFactor: existingResponse?.eFactor ?? 2.5,
      interval: existingResponse?.interval ?? 1,
      streak:
        (existingResponse?.correctCountStreak ?? 0) +
        (percentile === 1 ? 1 : 0),
      grade: percentile,
    })
    const responseDetail = await createQuestionResponseDetail({
      prisma,
      id,
      participantId: activeParticipantId,
      courseId,
      response,
      score: questionEval.score ?? 0,
      pointsAwarded,
      xpAwarded,
      answerTime,
      practiceQuizId: updatedInstance.elementStack?.practiceQuizId ?? undefined,
      microLearningId:
        updatedInstance.elementStack?.microLearningId ?? undefined,
    })
    responseDetailId = responseDetail.id

    await upsertQuestionResponse({
      prisma,
      id,
      participantId: activeParticipantId,
      courseId,
      response,
      correctness: percentile,
      score: questionEval.score ?? 0,
      pointsAwarded,
      lastAwardedAt: lastAwardedAt ?? new Date(),
      xpAwarded,
      lastXpAwardedAt: lastXpAwardedAt ?? new Date(),
      newAverageResponseTime,
      existingResponse,
      newAggResponses,
      practiceQuizId: updatedInstance.elementStack?.practiceQuizId ?? undefined,
      microLearningId:
        updatedInstance.elementStack?.microLearningId ?? undefined,
      resultSpacedRepetition,
    })

    if (xpAwarded > 0) {
      await incrementParticipantXp({
        prisma,
        participantId: activeParticipantId,
        xpAwarded,
      })
    }
    if (typeof pointsAwarded === 'number' && pointsAwarded !== null) {
      await updateLeaderboardOnQuestionResponse({
        prisma,
        participantId: activeParticipantId,
        courseId,
        pointsAwarded,
      })
    }
    if (
      xpAwarded > 0 ||
      (typeof pointsAwarded === 'number' && pointsAwarded !== null)
    ) {
      await upsertDailyTimelineEntry({
        prisma,
        participantId: activeParticipantId,
        courseId,
        xpAwarded,
        pointsAwarded: pointsAwarded ?? undefined,
      })
    }
  }

  return {
    evaluation: {
      ...questionEval,
      pointsAwarded,
      newPointsFrom,
      xpAwarded,
      newXpFrom,
    },
    status,
    responseDetailId,
  }
}
