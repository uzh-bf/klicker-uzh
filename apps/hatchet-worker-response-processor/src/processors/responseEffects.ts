import type { LiveQuizResponseInput } from '@klicker-uzh/types'
import {
  isLiveQuizQuestionType,
  type LiveQuizQuestionType,
} from '@klicker-uzh/util'
import { createHash } from 'crypto'
import { DEFAULT_POINTS } from '../constants.js'
import {
  getCaseStudyQuestionPointsDetails,
  getChoicesQuestionPointsDetails,
  getFreeTextQuestionPointsDetails,
  getNumericalQuestionPointsDetails,
  getSelectionQuestionPointsDetails,
  updateLeaderboards,
} from './helpers.js'

export type RedisHashMutation = {
  command: 'hincrby' | 'hset' | 'hsetnx'
  key: string
  field: string
  value: string
}

export interface RedisHashMutationQueue {
  hincrby(key: string, field: string, increment: number): unknown
  hset(key: string, field: string, value: string | number): unknown
  hsetnx(key: string, field: string, value: string | number): unknown
}

export { isLiveQuizQuestionType, type LiveQuizQuestionType }

export type QuestionGrading = {
  basePoints: number
  correctnessPoints: number
  bonusPoints: number
  correctnessPercentage: number | null
  pointsAwarded: number
  xpAwarded: number
}

export type QuestionEffectPlan = {
  aggregateMutations: RedisHashMutation[]
  participantResponse?: string
  grading?: QuestionGrading
  setsFirstResponseTimestamp: boolean
  updatesLeaderboard: boolean
}

type ParticipantData = {
  sub: string
  role?: string
}

export type PlanQuestionResponseEffectsArgs = {
  type: LiveQuizQuestionType
  choiceCount?: string
  response: LiveQuizResponseInput
  instanceInfo: Record<string, string>
  instanceKey: string
  firstResponseReceivedAt?: string
  responseTimestamp: number
  basePoints?: string
  defaultPoints?: string
  pointsMultiplier?: string
  parsedSolutions: any
  gradeResponse: boolean
}

function createHashMutation(
  command: RedisHashMutation['command'],
  key: string,
  field: string,
  value: string | number
): RedisHashMutation {
  return { command, key, field, value: String(value) }
}

function buildGrading({
  type,
  basePoints,
  defaultPoints,
  details,
}: {
  type: LiveQuizQuestionType
  basePoints?: string
  defaultPoints?: string
  details: {
    correctnessPoints: number
    bonusPoints: number
    pointsPercentage: number | null
    xpAwarded: number
  }
}): QuestionGrading {
  const parsedDefaultPoints = parseInt(
    defaultPoints ?? String(DEFAULT_POINTS),
    10
  )
  const awardedBasePoints =
    type !== 'CONTENT' && basePoints === 'true'
      ? Math.max(
          Number.isNaN(parsedDefaultPoints)
            ? DEFAULT_POINTS
            : parsedDefaultPoints,
          0
        )
      : 0

  return {
    basePoints: awardedBasePoints,
    correctnessPoints: details.correctnessPoints,
    bonusPoints: details.bonusPoints,
    correctnessPercentage: details.pointsPercentage,
    pointsAwarded: Math.round(
      awardedBasePoints + details.correctnessPoints + details.bonusPoints
    ),
    xpAwarded: details.xpAwarded,
  }
}

export function planQuestionResponseEffects({
  type,
  choiceCount,
  response,
  instanceInfo,
  instanceKey,
  firstResponseReceivedAt,
  responseTimestamp,
  basePoints,
  defaultPoints,
  pointsMultiplier,
  parsedSolutions,
  gradeResponse,
}: PlanQuestionResponseEffectsArgs): QuestionEffectPlan {
  const aggregateMutations: RedisHashMutation[] = []
  const resultsKey = `${instanceKey}:results`
  const responseHashesKey = `${instanceKey}:responseHashes`
  const participantMutation = createHashMutation(
    'hincrby',
    resultsKey,
    'participants',
    1
  )

  switch (type) {
    case 'SC':
    case 'MC':
    case 'KPRIM': {
      if (!response.choices) {
        throw new Error('Missing choices after response validation')
      }

      response.choices
        .filter((choice) => choice.selected)
        .forEach((choice) => {
          aggregateMutations.push(
            createHashMutation('hincrby', resultsKey, String(choice.ix), 1)
          )
        })
      aggregateMutations.push(participantMutation)

      const grading = gradeResponse
        ? buildGrading({
            type,
            basePoints,
            defaultPoints,
            details: getChoicesQuestionPointsDetails({
              type,
              choiceCount,
              response,
              instanceInfo,
              firstResponseReceivedAt,
              responseTimestamp,
              basePoints,
              pointsMultiplier,
              parsedSolutions,
            }),
          })
        : undefined

      return {
        aggregateMutations,
        participantResponse: JSON.stringify(response.choices),
        grading,
        setsFirstResponseTimestamp:
          grading?.correctnessPercentage === 1 && !firstResponseReceivedAt,
        updatesLeaderboard: true,
      }
    }
    case 'NUMERICAL': {
      if (typeof response.value !== 'string') {
        throw new Error('Missing numerical value after response validation')
      }

      const responseHash = createHash('md5')
        .update(response.value)
        .digest('hex')
      aggregateMutations.push(
        createHashMutation('hincrby', resultsKey, responseHash, 1),
        createHashMutation(
          'hset',
          responseHashesKey,
          responseHash,
          response.value
        ),
        participantMutation
      )

      const grading = gradeResponse
        ? buildGrading({
            type,
            basePoints,
            defaultPoints,
            details: getNumericalQuestionPointsDetails({
              response,
              instanceInfo,
              firstResponseReceivedAt,
              responseTimestamp,
              basePoints,
              pointsMultiplier,
              parsedSolutions,
            }),
          })
        : undefined

      return {
        aggregateMutations,
        participantResponse: response.value,
        grading,
        setsFirstResponseTimestamp:
          Boolean(parsedSolutions && grading?.correctnessPercentage) &&
          !firstResponseReceivedAt,
        updatesLeaderboard: true,
      }
    }
    case 'FREE_TEXT': {
      if (typeof response.value !== 'string') {
        throw new Error('Missing free-text value after response validation')
      }

      const cleanResponseValue = response.value.trim()
      const responseHash = createHash('md5')
        .update(cleanResponseValue)
        .digest('hex')
      aggregateMutations.push(
        createHashMutation('hincrby', resultsKey, responseHash, 1),
        createHashMutation(
          'hset',
          responseHashesKey,
          responseHash,
          cleanResponseValue
        ),
        participantMutation
      )

      const grading = gradeResponse
        ? buildGrading({
            type,
            basePoints,
            defaultPoints,
            details: getFreeTextQuestionPointsDetails({
              response,
              instanceInfo,
              firstResponseReceivedAt,
              responseTimestamp,
              basePoints,
              pointsMultiplier,
              parsedSolutions,
            }),
          })
        : undefined

      return {
        aggregateMutations,
        participantResponse: cleanResponseValue,
        grading,
        setsFirstResponseTimestamp:
          Boolean(grading?.correctnessPercentage) && !firstResponseReceivedAt,
        updatesLeaderboard: true,
      }
    }
    case 'SELECTION': {
      if (!response.selection) {
        throw new Error('Missing selection after response validation')
      }

      const filteredSelection = response.selection.filter(
        (answerId: number) =>
          answerId !== -1 &&
          typeof answerId !== 'undefined' &&
          answerId !== null
      )
      filteredSelection.forEach((answerId: number) => {
        aggregateMutations.push(
          createHashMutation('hincrby', resultsKey, String(answerId), 1)
        )
      })
      aggregateMutations.push(participantMutation)

      const grading = gradeResponse
        ? buildGrading({
            type,
            basePoints,
            defaultPoints,
            details: getSelectionQuestionPointsDetails({
              response,
              instanceInfo,
              firstResponseReceivedAt,
              responseTimestamp,
              basePoints,
              pointsMultiplier,
              parsedSolutions,
            }),
          })
        : undefined

      return {
        aggregateMutations,
        participantResponse: `[${String(filteredSelection)}]`,
        grading,
        setsFirstResponseTimestamp:
          grading?.correctnessPercentage === 1 && !firstResponseReceivedAt,
        updatesLeaderboard: true,
      }
    }
    case 'CASE_STUDY': {
      if (!response.assessment) {
        throw new Error('Missing case-study response after response validation')
      }

      Object.entries(response.assessment).forEach(([caseId, caseData]) => {
        Object.entries(caseData).forEach(([itemId, itemData]) => {
          Object.entries(itemData).forEach(
            ([criterionId, criterionResponse]) => {
              if (
                criterionResponse === null ||
                typeof criterionResponse !== 'number'
              ) {
                return
              }

              const responseHash = createHash('md5')
                .update(String(criterionResponse))
                .digest('hex')
              const combinedHash = `${caseId}:${itemId}:${criterionId}:${responseHash}`
              aggregateMutations.push(
                createHashMutation('hincrby', resultsKey, combinedHash, 1),
                createHashMutation(
                  'hset',
                  responseHashesKey,
                  combinedHash,
                  criterionResponse
                )
              )
            }
          )
        })
      })
      aggregateMutations.push(participantMutation)

      const grading = gradeResponse
        ? buildGrading({
            type,
            basePoints,
            defaultPoints,
            details: getCaseStudyQuestionPointsDetails({
              response,
              instanceInfo,
              firstResponseReceivedAt,
              responseTimestamp,
              basePoints,
              pointsMultiplier,
              parsedSolutions,
            }),
          })
        : undefined

      return {
        aggregateMutations,
        participantResponse: JSON.stringify(response.assessment),
        grading,
        setsFirstResponseTimestamp:
          grading?.correctnessPercentage === 1 && !firstResponseReceivedAt,
        updatesLeaderboard: true,
      }
    }
    case 'CONTENT':
      return {
        aggregateMutations: [participantMutation],
        grading: gradeResponse
          ? buildGrading({
              type,
              basePoints,
              defaultPoints,
              details: {
                correctnessPoints: 0,
                bonusPoints: 0,
                pointsPercentage: null,
                xpAwarded: 0,
              },
            })
          : undefined,
        setsFirstResponseTimestamp: false,
        updatesLeaderboard: false,
      }
    default: {
      const exhaustiveType: never = type
      throw new Error(`Unsupported response element type ${exhaustiveType}`)
    }
  }
}

function queueMutation({
  redisMulti,
  mutation,
}: {
  redisMulti: RedisHashMutationQueue
  mutation: RedisHashMutation
}) {
  if (mutation.command === 'hincrby') {
    redisMulti.hincrby(mutation.key, mutation.field, Number(mutation.value))
  } else if (mutation.command === 'hset') {
    redisMulti.hset(mutation.key, mutation.field, mutation.value)
  } else {
    redisMulti.hsetnx(mutation.key, mutation.field, mutation.value)
  }
}

type QueueQuestionResponseEffectsArgs = Omit<
  PlanQuestionResponseEffectsArgs,
  'gradeResponse'
> & {
  redisMulti: RedisHashMutationQueue
}

function queuePlannedQuestionResponseEffects({
  type,
  choiceCount,
  response,
  instanceInfo,
  instanceKey,
  firstResponseReceivedAt,
  responseTimestamp,
  basePoints,
  defaultPoints,
  pointsMultiplier,
  parsedSolutions,
  redisMulti,
  gradeResponse,
}: QueueQuestionResponseEffectsArgs & { gradeResponse: boolean }) {
  const plan = planQuestionResponseEffects({
    type,
    choiceCount,
    response,
    instanceInfo,
    instanceKey,
    firstResponseReceivedAt,
    responseTimestamp,
    basePoints,
    defaultPoints,
    pointsMultiplier,
    parsedSolutions,
    gradeResponse,
  })

  plan.aggregateMutations.forEach((mutation) => {
    queueMutation({ redisMulti, mutation })
  })

  return plan
}

export function queueAggregateQuestionResponseEffects({
  participantData,
  liveQuizKey,
  sessionBlockId,
  ...args
}: QueueQuestionResponseEffectsArgs & {
  liveQuizKey: string
  sessionBlockId: string
  participantData: ParticipantData | null
}) {
  const plan = queuePlannedQuestionResponseEffects({
    ...args,
    gradeResponse: participantData !== null,
  })

  if (participantData && plan.participantResponse !== undefined) {
    args.redisMulti.hset(
      `${args.instanceKey}:responses`,
      participantData.role === 'TEMPORARY_PARTICIPANT'
        ? `temporary-${participantData.sub}`
        : participantData.sub,
      plan.participantResponse
    )
  }

  if (participantData && plan.grading && plan.updatesLeaderboard) {
    if (plan.setsFirstResponseTimestamp) {
      args.redisMulti.hsetnx(
        `${args.instanceKey}:info`,
        'firstResponseReceivedAt',
        args.responseTimestamp
      )
    }

    updateLeaderboards({
      redisMulti: args.redisMulti,
      participantId: participantData.sub,
      participantRole: participantData.role!,
      liveQuizKey,
      sessionBlockId,
      pointsAwarded: plan.grading.pointsAwarded,
      xpAwarded: plan.grading.xpAwarded,
    })
  }

  return plan.grading
}

export function planCorrelatedQuestionResponseEffects(
  args: Omit<PlanQuestionResponseEffectsArgs, 'gradeResponse'>
) {
  const plan = planQuestionResponseEffects({
    ...args,
    gradeResponse: true,
  })

  if (
    plan.grading?.correctnessPercentage === 1 &&
    !args.firstResponseReceivedAt
  ) {
    plan.aggregateMutations.push(
      createHashMutation(
        'hsetnx',
        `${args.instanceKey}:info`,
        'firstResponseReceivedAt',
        args.responseTimestamp
      )
    )
  }

  return plan
}
