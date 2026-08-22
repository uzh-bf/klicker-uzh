import {
  type Context,
  type DurableContext,
  type JsonObject,
  NonRetryableError,
  type UnknownInputType,
} from '@hatchet-dev/typescript-sdk/index.js'
import { prisma } from '@klicker-uzh/prisma'
import {
  ElementType,
  Prisma,
  ResponseCorrectness,
} from '@klicker-uzh/prisma/client'
import type {
  FreeTextRestrictions,
  LiveQuizResponseInput,
  NumericalRestrictions,
} from '@klicker-uzh/types'
import { strict as assert } from 'assert'
import { createHash } from 'crypto'
import {
  DEFAULT_CORRECT_POINTS,
  DEFAULT_POINTS,
  MAX_BONUS_POINTS,
} from '../constants.js'
import { getAssessmentRedis } from '../redis.js'
import {
  getCaseStudyQuestionPointsDetails,
  getChoicesQuestionPointsDetails,
  getFreeTextQuestionPointsDetails,
  getNumericalQuestionPointsDetails,
  getSelectionQuestionPointsDetails,
  validateStudentResponse,
} from './helpers.js'
import {
  getSampleSolutionAvailability,
  getResponseState,
  validateRedisCounterTransitions,
  type ResponsePoints,
  replayPointCorrections,
} from './responseState.js'

const redisExec = getAssessmentRedis() // use assessment redis instance for assessment response processor

function parsePointValue(value: string | undefined, fallback: number) {
  const parsed = Number(value ?? fallback)
  return Number.isFinite(parsed) ? parsed : fallback
}

function isUniqueConstraintError(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2002'
  )
}

type AssessmentResponseEffectFields = {
  correlationId: string
  participantId: string
  liveQuizId: string
  blockId: string
  instanceId: string
  elementType: ElementType
  isGamificationEnabled: boolean
  pointsAwarded: number
  xpAwarded: number
  response: LiveQuizResponseInput
}

type AssessmentAggregationInput = AssessmentResponseEffectFields & {
  responseId?: number
}

type AssessmentResponseEffectPayload = AssessmentResponseEffectFields & {
  responseId: number
}

type PersistedAssessmentResponse = {
  status: 'created' | 'duplicate' | 'materialized' | 'retry'
  responseId: number
  effect: AssessmentResponseEffectPayload | null
}

async function getPendingAssessmentResponseEffect({
  instanceId,
  participantId,
  elementBlockExecution,
  correlationId,
}: {
  instanceId: number
  participantId: string
  elementBlockExecution: number
  correlationId: string
}): Promise<AssessmentResponseEffectPayload | null> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw(
      Prisma.sql`
        SELECT pg_advisory_xact_lock(
          hashtextextended(
            ${`${instanceId}:${elementBlockExecution}:${participantId}`},
            0
          )
        )
      `
    )

    const existingResponse = await tx.liveQuizResponse.findUnique({
      where: {
        instanceId_elementBlockExecution_participantId: {
          instanceId,
          elementBlockExecution,
          participantId,
        },
      },
      select: {
        correctionOnly: true,
        correlationId: true,
        assessmentResponseEffect: { select: { payload: true } },
      },
    })

    if (
      !existingResponse ||
      existingResponse.correctionOnly ||
      existingResponse.correlationId !== correlationId ||
      !existingResponse.assessmentResponseEffect
    ) {
      return null
    }

    return existingResponse.assessmentResponseEffect
      .payload as AssessmentResponseEffectPayload
  })
}

export async function persistAssessmentResponse({
  instanceId,
  participantId,
  elementBlockExecution,
  correlationId,
  effectPayload,
  responseTimestamp,
  response,
  correctness,
  responsePoints,
  availablePoints,
}: {
  instanceId: number
  participantId: string
  elementBlockExecution: number
  correlationId: string
  effectPayload: Omit<AssessmentResponseEffectPayload, 'responseId'>
  responseTimestamp: number
  response: LiveQuizResponseInput
  correctness: ResponseCorrectness
  responsePoints: ResponsePoints
  availablePoints: ResponsePoints
}): Promise<PersistedAssessmentResponse> {
  const persist = (): Promise<PersistedAssessmentResponse> =>
    prisma.$transaction(async (tx) => {
      // Serialize validated acceptance with quiz-audience snapshots first,
      // then point corrections for this response identity.
      await tx.$executeRaw(
        Prisma.sql`
          SELECT pg_advisory_xact_lock(
            hashtextextended(
              ${`assessment-audience:${effectPayload.liveQuizId}`},
              0
            )
          )
        `
      )

      await tx.$executeRaw(
        Prisma.sql`
          SELECT pg_advisory_xact_lock(
            hashtextextended(
              ${`${instanceId}:${elementBlockExecution}:${participantId}`},
              0
            )
          )
        `
      )

      const existingResponse = await tx.liveQuizResponse.findUnique({
        where: {
          instanceId_elementBlockExecution_participantId: {
            instanceId,
            elementBlockExecution,
            participantId,
          },
        },
        select: {
          id: true,
          correctionOnly: true,
          correlationId: true,
          acceptedAt: true,
          appliedCorrections: {
            select: {
              id: true,
              pointCorrection: {
                select: {
                  basePoints: true,
                  correctnessPoints: true,
                  bonusPoints: true,
                },
              },
            },
          },
        },
      })
      const acceptanceTimestamp = new Date()

      const state = getResponseState(existingResponse, correlationId)
      if (state === 'duplicate' && existingResponse) {
        return {
          status: 'duplicate' as const,
          responseId: existingResponse.id,
          effect: null,
        }
      }
      if (state === 'retry' && existingResponse) {
        const effect = await tx.assessmentResponseEffect.findUnique({
          where: { responseId: existingResponse.id },
          select: { payload: true },
        })
        return {
          status: 'retry' as const,
          responseId: existingResponse.id,
          effect: (effect?.payload as AssessmentResponseEffectPayload) ?? null,
        }
      }

      const responseData = {
        submittedAt: new Date(responseTimestamp),
        response,
        timeSpent: -1, // TODO: set this in future improvements
        correctness,
      }

      if (state === 'create') {
        const createdResponse = await tx.liveQuizResponse.create({
          data: {
            ...responseData,
            acceptedAt: acceptanceTimestamp,
            correlationId,
            basePoints: responsePoints.basePoints,
            correctnessPoints: responsePoints.correctnessPoints,
            bonusPoints: responsePoints.bonusPoints,
            elementBlockExecution,
            instance: { connect: { id: instanceId } },
            participant: { connect: { id: participantId } },
          },
        })

        const effect = {
          ...effectPayload,
          responseId: createdResponse.id,
        }
        await tx.assessmentResponseEffect.create({
          data: {
            responseId: createdResponse.id,
            payload: effect as unknown as Prisma.InputJsonValue,
          },
        })

        return {
          status: 'created' as const,
          responseId: createdResponse.id,
          effect,
        }
      }

      if (!existingResponse) {
        throw new Error('Cannot materialize a missing live quiz response')
      }

      const replayedCorrections = replayPointCorrections({
        rawPoints: responsePoints,
        availablePoints,
        corrections: existingResponse.appliedCorrections.map(
          ({ id, pointCorrection }) => ({
            appliedCorrectionId: id,
            pointCorrection,
          })
        ),
      })

      await tx.liveQuizResponse.update({
        where: { id: existingResponse.id },
        data: {
          ...responseData,
          basePoints: replayedCorrections.points.basePoints,
          correctnessPoints: replayedCorrections.points.correctnessPoints,
          bonusPoints: replayedCorrections.points.bonusPoints,
          correctionOnly: false,
          acceptedAt: existingResponse.acceptedAt ?? acceptanceTimestamp,
          correlationId: existingResponse.correlationId ?? correlationId,
        },
      })

      for (const correction of replayedCorrections.appliedCorrections) {
        const { appliedCorrectionId, ...correctionDelta } = correction
        await tx.appliedPointCorrection.update({
          where: { id: appliedCorrectionId },
          data: correctionDelta,
        })
      }

      const effect = {
        ...effectPayload,
        responseId: existingResponse.id,
      }
      await tx.assessmentResponseEffect.upsert({
        where: { responseId: existingResponse.id },
        create: {
          responseId: existingResponse.id,
          payload: effect as unknown as Prisma.InputJsonValue,
        },
        update: {
          payload: effect as unknown as Prisma.InputJsonValue,
        },
      })

      return {
        status: 'materialized' as const,
        responseId: existingResponse.id,
        effect,
      }
    })

  try {
    return await persist()
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error

    // A response and a correction-only placeholder can race on the compound
    // key. The winning insert determines which state should be persisted.
    return persist()
  }
}

export async function clearPendingAssessmentResponseAcceptance({
  instanceId,
  participantId,
  elementBlockExecution,
  correlationId,
}: {
  instanceId: number
  participantId: string
  elementBlockExecution?: number
  correlationId: string
}) {
  await prisma.liveQuizResponse.updateMany({
    where: {
      instanceId,
      participantId,
      correlationId,
      correctionOnly: true,
      elementBlockExecution,
    },
    data: {
      acceptedAt: null,
      correlationId: null,
    },
  })
}

export async function processAssessmentResponse(
  message: {
    correlationId: string
    participantId: string
    liveQuizId: string
    instanceId: string
    elementBlockExecution?: number
    response: LiveQuizResponseInput
    cookie?: string
    responseTimestamp: number
  },
  ctx: DurableContext<UnknownInputType, {}>
) {
  const receivedMessage = `[INFO] [AddResponse Assessment] Processing response for instance ${message.instanceId} by participant ${message.participantId}.`
  ctx.logger.info(receivedMessage)
  ctx.v1.events.push('create-audit-log-entry', {
    correlationId: message.correlationId,
    info: receivedMessage,
  })

  try {
    assert(!!redisExec)
  } catch (e) {
    ctx.logger.error(`Redis connection error: ${JSON.stringify(e)}`)
    throw new Error(`Redis connection error ${String(e)}`)
  }

  try {
    assert(!!prisma)
  } catch (e) {
    ctx.logger.error(`Prisma client error: ${JSON.stringify(e)}`)
    throw new Error(`Prisma client error ${String(e)}`)
  }

  if (message.liveQuizId === 'ping') {
    if (process.env.FUNCTION_HEARTBEAT_URL) {
      await fetch(process.env.FUNCTION_HEARTBEAT_URL)
    }
    return { status: 200 }
  }

  // A response can be persisted before block closure while its Redis effect
  // is still pending. Resume that durable effect before validating the current
  // cache state, which may already describe a closed or later execution.
  if (message.elementBlockExecution !== undefined) {
    const pendingEffect = await getPendingAssessmentResponseEffect({
      instanceId: Number(message.instanceId),
      participantId: message.participantId,
      elementBlockExecution: message.elementBlockExecution,
      correlationId: message.correlationId,
    })
    if (pendingEffect) {
      if (
        pendingEffect.liveQuizId !== message.liveQuizId ||
        pendingEffect.instanceId !== message.instanceId
      ) {
        throw new NonRetryableError(
          `Pending response effect does not match response ${message.correlationId}.`
        )
      }

      await aggregateAssessmentResponses(
        pendingEffect,
        ctx as unknown as DurableContext<JsonObject, {}>
      )
      return {
        status: 200,
        pointsAwarded: pendingEffect.pointsAwarded,
        xpAwarded: pendingEffect.xpAwarded,
      }
    }
  }

  // extract the relevant information from the redis cache
  const liveQuizKey = `lq:${message.liveQuizId}`
  const instanceKey = `${liveQuizKey}:i:${message.instanceId}`
  const responseTimestamp = message.responseTimestamp
  const response = message.response

  // get live quiz and instance information from redis cache
  const instanceInfo = await redisExec.hgetall(`${instanceKey}:info`)

  if (!response && instanceInfo.type !== ElementType.CONTENT) {
    ctx.logger.error(
      'Missing response ' +
        JSON.stringify({
          correlationId: message.correlationId,
          liveQuizId: message.liveQuizId,
          instanceId: message.instanceId,
        })
    )
    throw new NonRetryableError('Missing response')
  }

  // ! Step 1: Validation of answer timestamp (from message before block closure)
  // if the instance info is not available, return that the corresponding cache data is not available
  if (!instanceInfo || Object.keys(instanceInfo).length === 0) {
    throw new Error(
      `Instance metadata for instance ${message.instanceId} not found.`
    )
  }

  // verify that the student answer was submitted before the block was closed
  const {
    type,
    solutions,
    restrictions,
    firstResponseReceivedAt,
    sessionBlockId,
    courseId,
    choiceCount,
    basePoints,
    defaultPoints,
    defaultCorrectPoints,
    maxBonusPoints,
    hasSampleSolution,
    pointsMultiplier,
    blockExecution,
    blockClosedAt,
  } = instanceInfo

  const persistedExecution =
    message.elementBlockExecution ?? parseInt(blockExecution ?? '0', 10)
  if (
    !Number.isFinite(persistedExecution) ||
    (message.elementBlockExecution !== undefined &&
      Number(blockExecution) !== message.elementBlockExecution)
  ) {
    throw new NonRetryableError(
      `Response for instance ${message.instanceId} belongs to a different block execution.`
    )
  }

  // instances in assessment live quizzes always need to have a type, course linked to the activity and session block id
  if (!type || !courseId || !sessionBlockId) {
    throw new NonRetryableError(
      `Instance ${message.instanceId} does not have a type (${type}) or is not linked to a course (${courseId}) or session block (${sessionBlockId}).`
    )
  }

  if (blockClosedAt && Number(responseTimestamp) > Number(blockClosedAt)) {
    ctx.logger.error(
      `[CANCEL] [AddResponse Assessment] Response received at ${new Date(Number(responseTimestamp))} after block of element instance ${message.instanceId} was closed at ${new Date(Number(blockClosedAt))}.`
    )
    await clearPendingAssessmentResponseAcceptance({
      instanceId: Number(message.instanceId),
      participantId: message.participantId,
      elementBlockExecution: message.elementBlockExecution,
      correlationId: message.correlationId,
    })
    return { status: 409, error: 'response_after_block_closed' }
  }

  // ! Step 1.2 Validation of response format
  let parsedRestrictions:
    | NumericalRestrictions
    | FreeTextRestrictions
    | undefined
  try {
    if (restrictions) {
      parsedRestrictions = restrictions
        ? typeof restrictions === 'string'
          ? JSON.parse(restrictions)
          : restrictions
        : undefined
    }
  } catch (e) {
    throw new NonRetryableError(
      `Error ${String(e)} occurred when parsing restrictions: ${restrictions}`
    )
  }

  const { valid, message: validationError } = validateStudentResponse({
    type: type as any,
    response,
    restrictions: parsedRestrictions,
  })

  if (!valid) {
    throw new NonRetryableError(
      `Response to question instance ${message.instanceId} is not valid: ${validationError}`
    )
  }

  // ! Step 2: Switch between different types, validate response and compute awarded points and XP
  let parsedSolutions: unknown
  try {
    if (solutions) {
      parsedSolutions = JSON.parse(solutions)
    }
  } catch (e) {
    throw new Error(`Error parsing solutions: ${String(e)}`)
  }

  const awardedBasePoints =
    basePoints === 'true'
      ? parseInt(defaultPoints ?? String(DEFAULT_POINTS), 10)
      : 0
  let computedCorrectness: number | null = null
  let awardedCorrectnessPoints = 0
  let awardedBonusPoints = 0
  let awardedXp = 0

  switch (type) {
    case ElementType.SC:
    case ElementType.MC:
    case ElementType.KPRIM: {
      // if response choices are not defined, return early
      if (!response.choices) {
        throw new NonRetryableError(
          `Response to choices question (instance id ${message.instanceId}) does not contain choices.`
        )
      }

      // compute the relevant points
      const { correctnessPoints, bonusPoints, xpAwarded, pointsPercentage } =
        getChoicesQuestionPointsDetails({
          type,
          choiceCount,
          response,
          instanceInfo,
          firstResponseReceivedAt,
          responseTimestamp,
          pointsMultiplier,
          parsedSolutions,
        })
      computedCorrectness = pointsPercentage
      awardedCorrectnessPoints = correctnessPoints
      awardedBonusPoints = bonusPoints
      awardedXp = xpAwarded

      break
    }

    case ElementType.NUMERICAL: {
      // if response value is not defined, return early
      if (typeof response.value === 'undefined' || response.value === null) {
        throw new NonRetryableError(
          `Response to numerical question (instance id ${message.instanceId}) does not contain value.`
        )
      }

      // compute the relevant points
      const { correctnessPoints, bonusPoints, xpAwarded, pointsPercentage } =
        getNumericalQuestionPointsDetails({
          response,
          instanceInfo,
          firstResponseReceivedAt,
          responseTimestamp,
          pointsMultiplier,
          parsedSolutions,
        })
      computedCorrectness = pointsPercentage
      awardedCorrectnessPoints = correctnessPoints
      awardedBonusPoints = bonusPoints
      awardedXp = xpAwarded

      break
    }

    case ElementType.FREE_TEXT: {
      // if response value is not defined, return early
      if (typeof response.value !== 'string') {
        throw new NonRetryableError(
          `Response to free text question (instance id ${message.instanceId}) does not contain value.`
        )
      }

      // compute the relevant points
      const { correctnessPoints, bonusPoints, xpAwarded, pointsPercentage } =
        getFreeTextQuestionPointsDetails({
          response,
          instanceInfo,
          firstResponseReceivedAt,
          responseTimestamp,
          pointsMultiplier,
          parsedSolutions,
        })
      computedCorrectness = pointsPercentage
      awardedCorrectnessPoints = correctnessPoints
      awardedBonusPoints = bonusPoints
      awardedXp = xpAwarded

      break
    }

    case ElementType.SELECTION: {
      // if response selection is not defined, return early
      if (!response.selection) {
        throw new NonRetryableError(
          `Response to selection question (instance id ${message.instanceId}) does not contain selection.`
        )
      }

      // compute the relevant points
      const { correctnessPoints, bonusPoints, xpAwarded, pointsPercentage } =
        getSelectionQuestionPointsDetails({
          response,
          instanceInfo,
          firstResponseReceivedAt,
          responseTimestamp,
          pointsMultiplier,
          parsedSolutions,
        })
      computedCorrectness = pointsPercentage
      awardedCorrectnessPoints = correctnessPoints
      awardedBonusPoints = bonusPoints
      awardedXp = xpAwarded

      break
    }

    case ElementType.CASE_STUDY: {
      // if response assessment is not defined, return early
      if (!response.assessment) {
        throw new NonRetryableError(
          `Response to case study question (instance id ${message.instanceId}) does not contain assessments.`
        )
      }

      // compute the relevant points
      const { correctnessPoints, bonusPoints, xpAwarded, pointsPercentage } =
        getCaseStudyQuestionPointsDetails({
          response,
          instanceInfo,
          firstResponseReceivedAt,
          responseTimestamp,
          pointsMultiplier,
          parsedSolutions,
        })
      computedCorrectness = pointsPercentage
      awardedCorrectnessPoints = correctnessPoints
      awardedBonusPoints = bonusPoints
      awardedXp = xpAwarded

      break
    }

    case ElementType.CONTENT: {
      // content elements do not have a correct solution, award default points and 0 xp
      computedCorrectness = null
      awardedCorrectnessPoints = 0
      awardedBonusPoints = 0
      awardedXp = 0
      break
    }

    default: {
      throw new NonRetryableError(
        `Element type ${type} not recognized for instance ${message.instanceId}.`
      )
    }
  }

  const responsePoints: ResponsePoints = {
    basePoints: Number.isNaN(awardedBasePoints) ? 0 : awardedBasePoints,
    correctnessPoints: Number.isNaN(awardedCorrectnessPoints)
      ? 0
      : awardedCorrectnessPoints,
    bonusPoints: Number.isNaN(awardedBonusPoints) ? 0 : awardedBonusPoints,
  }
  const parsedPointsMultiplier = parsePointValue(pointsMultiplier, 1)
  const sampleSolutionAvailable = getSampleSolutionAvailability({
    type,
    cachedFlag: hasSampleSolution,
    solutions,
  })
  const availablePoints: ResponsePoints = {
    basePoints:
      basePoints === 'true'
        ? parsePointValue(defaultPoints, DEFAULT_POINTS)
        : 0,
    correctnessPoints: sampleSolutionAvailable
      ? parsedPointsMultiplier *
        parsePointValue(defaultCorrectPoints, DEFAULT_CORRECT_POINTS)
      : 0,
    bonusPoints: sampleSolutionAvailable
      ? parsedPointsMultiplier *
        parsePointValue(maxBonusPoints, MAX_BONUS_POINTS)
      : 0,
  }
  const responseCorrectness =
    computedCorrectness === null || computedCorrectness === 1
      ? ResponseCorrectness.CORRECT
      : computedCorrectness === 0
        ? ResponseCorrectness.WRONG
        : ResponseCorrectness.PARTIAL

  // if the response was correct, set the corresponding timestamp on the instance
  if (
    computedCorrectness !== null &&
    computedCorrectness === 1 &&
    !firstResponseReceivedAt
  ) {
    // if we are processing a first response, set the timestamp on the instance
    // this will allow us to award points for response timing
    await redisExec.hsetnx(
      `${instanceKey}:info`,
      'firstResponseReceivedAt',
      responseTimestamp
    )
  }

  // send audit-log event for computed points and XP
  const gradingLog = `[INFO] [AddResponse Assessment] Computed points for instance ${message.instanceId}. Base Points: ${awardedBasePoints}, Correctness Points: ${awardedCorrectnessPoints}, Bonus Points: ${awardedBonusPoints}, XP: ${awardedXp}.`
  ctx.logger.info(gradingLog)
  ctx.v1.events.push('create-audit-log-entry', {
    correlationId: message.correlationId,
    info: gradingLog,
  })

  // ! Step 3: Validate that the submitting user has a valid participation in the assessment course (requirement for assessment responses)
  const participation = await prisma.participation.findUnique({
    where: {
      courseId_participantId: {
        courseId,
        participantId: message.participantId,
      },
    },
  })

  if (!participation) {
    throw new NonRetryableError(
      `Participant ${message.participantId} does not have a participation in course ${courseId} linked to assessment live quiz ${message.liveQuizId}.`
    )
  }

  // The effect payload is persisted together with the response. This makes a
  // worker retry resumable after the database commit, even if Redis or the
  // downstream aggregation task was unavailable at that point.
  const effectPayload = {
    correlationId: message.correlationId,
    participantId: message.participantId,
    liveQuizId: message.liveQuizId,
    blockId: sessionBlockId,
    instanceId: message.instanceId,
    elementType: type as ElementType,
    isGamificationEnabled: instanceInfo.isGamificationEnabled === 'true',
    pointsAwarded: Number.isFinite(responsePoints.basePoints)
      ? responsePoints.basePoints
      : 0,
    xpAwarded: Number.isFinite(awardedXp) ? awardedXp : 0,
    response: response ?? {},
  }

  // ! Step 4: Store the submitted response and its pending Redis effect atomically.
  let persistence: PersistedAssessmentResponse
  try {
    persistence = await persistAssessmentResponse({
      instanceId: Number(message.instanceId),
      participantId: message.participantId,
      elementBlockExecution: persistedExecution,
      correlationId: message.correlationId,
      effectPayload,
      responseTimestamp,
      response,
      correctness: responseCorrectness,
      responsePoints,
      availablePoints,
    })
  } catch (e) {
    throw new Error(
      `Failed to persist live quiz response for instance ${message.instanceId} and participant ${message.participantId}: ${String(e)}`
    )
  }

  if (persistence.status === 'duplicate') {
    ctx.logger.error(
      `[CANCEL] [AddResponse Assessment] Participant ${message.participantId} has already submitted a response for instance ${message.instanceId} and block execution ${blockExecution}.`
    )
    ctx.cancel()
    return { status: 208 }
  }

  // ! Step 5: Apply the pending effect before acknowledging the workflow.
  // The Redis transaction is idempotent, so an older queued aggregation event
  // can safely race this direct completion path.
  if (persistence.effect) {
    await aggregateAssessmentResponses(
      persistence.effect,
      ctx as unknown as DurableContext<JsonObject, {}>
    )
  }

  return {
    status: 200,
    pointsAwarded: awardedBasePoints,
    correctnessPoints: awardedCorrectnessPoints,
    bonusPoints: awardedBonusPoints,
    xpAwarded: awardedXp,
  }
}

type RedisHashIncrement = {
  key: string
  field: string
  amount: number
}

type RedisHashSet = {
  key: string
  field: string
  value: string
}

type RedisAggregationPlan = {
  markerKey: string
  expectedTypes: Map<string, 'hash' | 'string'>
  increments: RedisHashIncrement[]
  sets: RedisHashSet[]
}

function buildRedisAggregationPlan(
  message: AssessmentAggregationInput
): RedisAggregationPlan {
  const liveQuizKey = `lq:${message.liveQuizId}`
  const instanceKey = `${liveQuizKey}:i:${message.instanceId}`
  const markerKey = `lq:${message.liveQuizId}:processedResponse:${message.correlationId}`
  const expectedTypes = new Map<string, 'hash' | 'string'>()
  const increments: RedisHashIncrement[] = []
  const sets: RedisHashSet[] = []

  const expectType = (key: string, type: 'hash' | 'string') => {
    const existingType = expectedTypes.get(key)
    if (existingType && existingType !== type) {
      throw new Error(`Redis aggregation key ${key} has conflicting types`)
    }
    expectedTypes.set(key, type)
  }
  const addIncrement = (key: string, field: string, amount: number) => {
    if (!Number.isSafeInteger(amount)) {
      throw new Error(
        `Redis aggregation increment for ${key}:${field} is not an integer`
      )
    }
    expectType(key, 'hash')
    increments.push({ key, field, amount })
  }
  const addSet = (key: string, field: string, value: string) => {
    expectType(key, 'hash')
    sets.push({ key, field, value })
  }

  addSet(`${instanceKey}:votes`, message.correlationId, 'true')

  if (
    message.isGamificationEnabled &&
    message.elementType !== ElementType.CONTENT
  ) {
    addIncrement(
      `${liveQuizKey}:b:${message.blockId}:lb`,
      message.participantId,
      message.pointsAwarded
    )
    addIncrement(
      `${liveQuizKey}:lb`,
      message.participantId,
      message.pointsAwarded
    )
    addIncrement(`${liveQuizKey}:xp`, message.participantId, message.xpAwarded)
  }

  const resultsKey = `${instanceKey}:results`
  const responseHashesKey = `${instanceKey}:responseHashes`
  // These hashes are stable Redis bucket identifiers, not security tokens.
  // Keep the existing algorithm so correction and result reads remain compatible.
  switch (message.elementType) {
    case ElementType.SC:
    case ElementType.MC:
    case ElementType.KPRIM:
      message.response
        .choices!.filter((choice) => choice.selected)
        .forEach((choice) => addIncrement(resultsKey, String(choice.ix), 1))
      addIncrement(resultsKey, 'participants', 1)
      break

    case ElementType.NUMERICAL: {
      const value = String(message.response.value!)
      const responseHash = createHash('md5') // NOSONAR - compatibility bucket key, not a security token
        .update(value)
        .digest('hex')
      addIncrement(resultsKey, responseHash, 1)
      addSet(responseHashesKey, responseHash, value)
      addIncrement(resultsKey, 'participants', 1)
      break
    }

    case ElementType.FREE_TEXT: {
      const value = message.response.value!.trim()
      const responseHash = createHash('md5') // NOSONAR - compatibility bucket key, not a security token
        .update(value)
        .digest('hex')
      addIncrement(resultsKey, responseHash, 1)
      addSet(responseHashesKey, responseHash, value)
      addIncrement(resultsKey, 'participants', 1)
      break
    }

    case ElementType.SELECTION:
      message.response.selection!.forEach((answerId) => {
        if (answerId !== -1 && answerId !== null) {
          addIncrement(resultsKey, String(answerId), 1)
        }
      })
      addIncrement(resultsKey, 'participants', 1)
      break

    case ElementType.CASE_STUDY:
      Object.entries(message.response.assessment!).forEach(
        ([caseId, caseData]) => {
          Object.entries(caseData).forEach(([itemId, itemData]) => {
            Object.entries(itemData).forEach(
              ([criterionId, criterionResponse]) => {
                if (
                  criterionResponse === null ||
                  typeof criterionResponse !== 'number'
                ) {
                  return
                }

                const responseHash = createHash('md5') // NOSONAR - compatibility bucket key, not a security token
                  .update(String(criterionResponse))
                  .digest('hex')
                const combinedHash = `${caseId}:${itemId}:${criterionId}:${responseHash}`
                addIncrement(resultsKey, combinedHash, 1)
                addSet(
                  responseHashesKey,
                  combinedHash,
                  String(criterionResponse)
                )
              }
            )
          })
        }
      )
      addIncrement(resultsKey, 'participants', 1)
      break

    case ElementType.CONTENT:
      addIncrement(resultsKey, 'participants', 1)
      break
  }

  expectType(markerKey, 'string')
  return { markerKey, expectedTypes, increments, sets }
}

export async function aggregateAssessmentResponses(
  message: AssessmentAggregationInput,
  ctx: Context<JsonObject, {}> | DurableContext<JsonObject, {}>
) {
  // Older queued aggregation events do not carry responseId. The correlation
  // ID therefore remains the shared idempotency key for both delivery paths.
  const redis = redisExec.duplicate()

  const finish = async () => {
    if (message.responseId) {
      await prisma.assessmentResponseEffect.deleteMany({
        where: { responseId: message.responseId },
      })
    }

    ctx.logger.info("Successfully aggregated a participant's results", {
      correlationId: message.correlationId,
      liveQuizId: message.liveQuizId,
      instanceId: message.instanceId,
    })
    return { status: 200 }
  }

  try {
    const plan = buildRedisAggregationPlan(message)

    // WATCH/MULTI keeps all cache effects and the completion marker atomic.
    // Use a dedicated connection because WATCH state is connection-scoped.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const watchedKeys = [...plan.expectedTypes.keys()]
      await redis.watch(...watchedKeys)

      const invalidType = (
        await Promise.all(
          watchedKeys.map(async (key) => {
            const actualType = await redis.type(key)
            const expectedType = plan.expectedTypes.get(key)
            return actualType !== 'none' && actualType !== expectedType
              ? `${key} is ${actualType}, expected ${expectedType}`
              : null
          })
        )
      ).find(Boolean)
      if (invalidType) {
        await redis.unwatch()
        throw new Error(`Redis aggregation key type mismatch: ${invalidType}`)
      }

      if (await redis.exists(plan.markerKey)) {
        await redis.unwatch()
        return finish()
      }

      const existingCounterValues = new Map<string, string | null>()
      for (const { key, field } of plan.increments) {
        const counterKey = `${key}\u0000${field}`
        if (!existingCounterValues.has(counterKey)) {
          existingCounterValues.set(counterKey, await redis.hget(key, field))
        }
      }
      const invalidCounter = validateRedisCounterTransitions(
        plan.increments,
        existingCounterValues
      )
      if (invalidCounter) {
        await redis.unwatch()
        throw new Error(
          `Redis aggregation counter is invalid: ${invalidCounter}`
        )
      }

      const transaction = redis.multi()
      plan.sets.forEach(({ key, field, value }) => {
        transaction.hset(key, field, value)
      })
      plan.increments.forEach(({ key, field, amount }) => {
        transaction.hincrby(key, field, amount)
      })

      transaction.set(plan.markerKey, 'true')
      const result = await transaction.exec()
      if (result !== null) {
        const commandError = result.find(([error]) => error !== null)?.[0]
        if (commandError) throw commandError
        return finish()
      }
    }

    throw new Error('Redis aggregation transaction conflicted repeatedly')
  } catch (e) {
    ctx.logger.error(
      `Redis transaction for results aggregation failed: ${String(e)}` +
        JSON.stringify({
          correlationId: message.correlationId,
          liveQuizId: message.liveQuizId,
          instanceId: message.instanceId,
        })
    )
    throw new Error(
      `Redis transaction for results aggregation failed ${String(e)}`
    )
  } finally {
    await redis.quit().catch(() => undefined)
  }
}
