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
  InvitationStatus,
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

type AssessmentResponseRecoveryState =
  | { status: 'pending'; effect: AssessmentResponseEffectPayload }
  | { status: 'completed' }

async function getAssessmentResponseRecoveryState({
  instanceId,
  participantId,
  elementBlockExecution,
  correlationId,
}: {
  instanceId: number
  participantId: string
  elementBlockExecution: number
  correlationId: string
}): Promise<AssessmentResponseRecoveryState | null> {
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
      existingResponse.correlationId !== correlationId
    ) {
      return null
    }

    if (!existingResponse.assessmentResponseEffect) {
      return { status: 'completed' }
    }

    return {
      status: 'pending',
      effect: existingResponse.assessmentResponseEffect
        .payload as AssessmentResponseEffectPayload,
    }
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
        // This endpoint does not receive the client-side time-spent value.
        timeSpent: -1,
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

type AssessmentGradingResult = {
  computedCorrectness: number | null
  awardedCorrectnessPoints: number
  awardedBonusPoints: number
  awardedXp: number
}

function parseAssessmentRestrictions(
  restrictions:
    | string
    | NumericalRestrictions
    | FreeTextRestrictions
    | undefined
) {
  if (!restrictions) return undefined

  try {
    return typeof restrictions === 'string'
      ? JSON.parse(restrictions)
      : restrictions
  } catch (error) {
    throw new NonRetryableError(
      `Error ${String(error)} occurred when parsing restrictions: ${restrictions}`
    )
  }
}

function parseAssessmentSolutions(solutions: string | undefined) {
  if (!solutions) return undefined

  try {
    return JSON.parse(solutions)
  } catch (error) {
    throw new Error(`Error parsing solutions: ${String(error)}`)
  }
}

function gradeAssessmentResponse({
  type,
  response,
  instanceInfo,
  choiceCount,
  firstResponseReceivedAt,
  responseTimestamp,
  pointsMultiplier,
  parsedSolutions,
  instanceId,
}: {
  type: string
  response: LiveQuizResponseInput
  instanceInfo: Record<string, string>
  choiceCount?: string
  firstResponseReceivedAt?: string
  responseTimestamp: number
  pointsMultiplier?: string
  parsedSolutions: unknown
  instanceId: string
}): AssessmentGradingResult {
  switch (type) {
    case ElementType.SC:
    case ElementType.MC:
    case ElementType.KPRIM: {
      if (!response.choices) {
        throw new NonRetryableError(
          `Response to choices question (instance id ${instanceId}) does not contain choices.`
        )
      }

      const result = getChoicesQuestionPointsDetails({
        type,
        choiceCount,
        response,
        instanceInfo,
        firstResponseReceivedAt,
        responseTimestamp,
        pointsMultiplier,
        parsedSolutions,
      })
      return {
        computedCorrectness: result.pointsPercentage,
        awardedCorrectnessPoints: result.correctnessPoints,
        awardedBonusPoints: result.bonusPoints,
        awardedXp: result.xpAwarded,
      }
    }

    case ElementType.NUMERICAL: {
      if (response.value === undefined || response.value === null) {
        throw new NonRetryableError(
          `Response to numerical question (instance id ${instanceId}) does not contain value.`
        )
      }

      const result = getNumericalQuestionPointsDetails({
        response,
        instanceInfo,
        firstResponseReceivedAt,
        responseTimestamp,
        pointsMultiplier,
        parsedSolutions,
      })
      return {
        computedCorrectness: result.pointsPercentage,
        awardedCorrectnessPoints: result.correctnessPoints,
        awardedBonusPoints: result.bonusPoints,
        awardedXp: result.xpAwarded,
      }
    }

    case ElementType.FREE_TEXT: {
      if (typeof response.value !== 'string') {
        throw new NonRetryableError(
          `Response to free text question (instance id ${instanceId}) does not contain value.`
        )
      }

      const result = getFreeTextQuestionPointsDetails({
        response,
        instanceInfo,
        firstResponseReceivedAt,
        responseTimestamp,
        pointsMultiplier,
        parsedSolutions,
      })
      return {
        computedCorrectness: result.pointsPercentage,
        awardedCorrectnessPoints: result.correctnessPoints,
        awardedBonusPoints: result.bonusPoints,
        awardedXp: result.xpAwarded,
      }
    }

    case ElementType.SELECTION: {
      if (!response.selection) {
        throw new NonRetryableError(
          `Response to selection question (instance id ${instanceId}) does not contain selection.`
        )
      }

      const result = getSelectionQuestionPointsDetails({
        response,
        instanceInfo,
        firstResponseReceivedAt,
        responseTimestamp,
        pointsMultiplier,
        parsedSolutions,
      })
      return {
        computedCorrectness: result.pointsPercentage,
        awardedCorrectnessPoints: result.correctnessPoints,
        awardedBonusPoints: result.bonusPoints,
        awardedXp: result.xpAwarded,
      }
    }

    case ElementType.CASE_STUDY: {
      if (!response.assessment) {
        throw new NonRetryableError(
          `Response to case study question (instance id ${instanceId}) does not contain assessments.`
        )
      }

      const result = getCaseStudyQuestionPointsDetails({
        response,
        instanceInfo,
        firstResponseReceivedAt,
        responseTimestamp,
        pointsMultiplier,
        parsedSolutions,
      })
      return {
        computedCorrectness: result.pointsPercentage,
        awardedCorrectnessPoints: result.correctnessPoints,
        awardedBonusPoints: result.bonusPoints,
        awardedXp: result.xpAwarded,
      }
    }

    case ElementType.CONTENT:
      return {
        computedCorrectness: null,
        awardedCorrectnessPoints: 0,
        awardedBonusPoints: 0,
        awardedXp: 0,
      }

    default:
      throw new NonRetryableError(
        `Element type ${type} not recognized for instance ${instanceId}.`
      )
  }
}

function getAssessmentResponseCorrectness(
  computedCorrectness: number | null
): ResponseCorrectness {
  if (computedCorrectness === null || computedCorrectness === 1) {
    return ResponseCorrectness.CORRECT
  }
  if (computedCorrectness === 0) return ResponseCorrectness.WRONG
  return ResponseCorrectness.PARTIAL
}

async function resumePendingAssessmentEffect(
  message: {
    correlationId: string
    participantId: string
    liveQuizId: string
    instanceId: string
    elementBlockExecution?: number
  },
  ctx: DurableContext<UnknownInputType, {}>
) {
  if (message.elementBlockExecution === undefined) return null

  const recoveryState = await getAssessmentResponseRecoveryState({
    instanceId: Number(message.instanceId),
    participantId: message.participantId,
    elementBlockExecution: message.elementBlockExecution,
    correlationId: message.correlationId,
  })
  if (!recoveryState) return null

  if (recoveryState.status === 'completed') {
    return { status: 208 }
  }

  const pendingEffect = recoveryState.effect

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

function assertAssessmentDependencies(
  ctx: DurableContext<UnknownInputType, {}>
) {
  try {
    assert(!!redisExec)
  } catch (error) {
    ctx.logger.error(`Redis connection error: ${JSON.stringify(error)}`)
    throw new Error(`Redis connection error ${String(error)}`)
  }

  try {
    assert(!!prisma)
  } catch (error) {
    ctx.logger.error(`Prisma client error: ${JSON.stringify(error)}`)
    throw new Error(`Prisma client error ${String(error)}`)
  }
}

async function handleAssessmentHeartbeat(
  liveQuizId: string
): Promise<{ status: 200 } | null> {
  if (liveQuizId !== 'ping') return null
  if (process.env.FUNCTION_HEARTBEAT_URL) {
    await fetch(process.env.FUNCTION_HEARTBEAT_URL)
  }
  return { status: 200 }
}

type AssessmentCache = {
  type: string
  courseId: string
  sessionBlockId: string
  blockExecution?: string
  persistedExecution: number
  solutions?: string
  restrictions?: string
  firstResponseReceivedAt?: string
  choiceCount?: string
  basePoints?: string
  defaultPoints?: string
  defaultCorrectPoints?: string
  maxBonusPoints?: string
  hasSampleSolution?: string
  pointsMultiplier?: string
  blockClosedAt?: string
}

function validateAssessmentCache({
  message,
  response,
  instanceInfo,
  ctx,
}: {
  message: {
    correlationId: string
    liveQuizId: string
    instanceId: string
    elementBlockExecution?: number
  }
  response: LiveQuizResponseInput
  instanceInfo: Record<string, string>
  ctx: DurableContext<UnknownInputType, {}>
}): AssessmentCache {
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

  if (!instanceInfo || Object.keys(instanceInfo).length === 0) {
    throw new Error(
      `Instance metadata for instance ${message.instanceId} not found.`
    )
  }

  const { type, courseId, sessionBlockId, blockExecution, ...cache } =
    instanceInfo
  const persistedExecution =
    message.elementBlockExecution ?? Number.parseInt(blockExecution ?? '0', 10)

  if (
    !Number.isFinite(persistedExecution) ||
    (message.elementBlockExecution !== undefined &&
      Number(blockExecution) !== message.elementBlockExecution)
  ) {
    throw new NonRetryableError(
      `Response for instance ${message.instanceId} belongs to a different block execution.`
    )
  }

  if (!type || !courseId || !sessionBlockId) {
    throw new NonRetryableError(
      `Instance ${message.instanceId} does not have a type (${type}) or is not linked to a course (${courseId}) or session block (${sessionBlockId}).`
    )
  }

  return {
    solutions: cache.solutions,
    restrictions: cache.restrictions,
    firstResponseReceivedAt: cache.firstResponseReceivedAt,
    choiceCount: cache.choiceCount,
    basePoints: cache.basePoints,
    defaultPoints: cache.defaultPoints,
    defaultCorrectPoints: cache.defaultCorrectPoints,
    maxBonusPoints: cache.maxBonusPoints,
    hasSampleSolution: cache.hasSampleSolution,
    pointsMultiplier: cache.pointsMultiplier,
    blockClosedAt: cache.blockClosedAt,
    type,
    courseId,
    sessionBlockId,
    blockExecution,
    persistedExecution,
  }
}

function validateAssessmentResponseFormat({
  type,
  response,
  restrictions,
  instanceId,
}: {
  type: string
  response: LiveQuizResponseInput
  restrictions:
    | string
    | NumericalRestrictions
    | FreeTextRestrictions
    | undefined
  instanceId: string
}) {
  const parsedRestrictions = parseAssessmentRestrictions(restrictions)
  const { valid, message } = validateStudentResponse({
    type: type as any,
    response,
    restrictions: parsedRestrictions,
  })
  if (!valid) {
    throw new NonRetryableError(
      `Response to question instance ${instanceId} is not valid: ${message}`
    )
  }
}

async function setFirstAssessmentResponseTimestamp({
  instanceKey,
  computedCorrectness,
  firstResponseReceivedAt,
  responseTimestamp,
}: {
  instanceKey: string
  computedCorrectness: number | null
  firstResponseReceivedAt?: string
  responseTimestamp: number
}) {
  if (
    computedCorrectness !== null &&
    computedCorrectness === 1 &&
    !firstResponseReceivedAt
  ) {
    await redisExec.hsetnx(
      `${instanceKey}:info`,
      'firstResponseReceivedAt',
      responseTimestamp
    )
  }
}

async function requireAssessmentParticipation(
  courseId: string,
  participantId: string,
  liveQuizId: string
) {
  const participation = await prisma.participation.findFirst({
    where: {
      courseId,
      participantId,
      participant: { isActive: true },
      course: {
        isAssessmentEnabled: true,
        participantInvitations: {
          some: {
            participantId,
            status: InvitationStatus.ACCEPTED,
            acceptedAt: { not: null },
          },
        },
      },
    },
  })
  if (!participation) {
    throw new NonRetryableError(
      `Participant ${participantId} does not have a participation in course ${courseId} linked to assessment live quiz ${liveQuizId}.`
    )
  }
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

  assertAssessmentDependencies(ctx)
  const heartbeat = await handleAssessmentHeartbeat(message.liveQuizId)
  if (heartbeat) return heartbeat

  // A response can be persisted before block closure while its Redis effect
  // is still pending. Resume that durable effect before validating the current
  // cache state, which may already describe a closed or later execution.
  const resumedEffect = await resumePendingAssessmentEffect(message, ctx)
  if (resumedEffect) return resumedEffect

  // extract the relevant information from the redis cache
  const liveQuizKey = `lq:${message.liveQuizId}`
  const instanceKey = `${liveQuizKey}:i:${message.instanceId}`
  const responseTimestamp = message.responseTimestamp
  const response = message.response

  // get live quiz and instance information from redis cache
  const instanceInfo = await redisExec.hgetall(`${instanceKey}:info`)

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
    persistedExecution,
  } = validateAssessmentCache({ message, response, instanceInfo, ctx })

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
  validateAssessmentResponseFormat({
    type,
    response,
    restrictions,
    instanceId: message.instanceId,
  })

  // ! Step 2: Switch between different types, validate response and compute awarded points and XP
  const parsedSolutions = parseAssessmentSolutions(solutions)

  const awardedBasePoints =
    basePoints === 'true'
      ? Number.parseInt(defaultPoints ?? String(DEFAULT_POINTS), 10)
      : 0
  const grading = gradeAssessmentResponse({
    type,
    response,
    instanceInfo,
    choiceCount,
    firstResponseReceivedAt,
    responseTimestamp,
    pointsMultiplier,
    parsedSolutions,
    instanceId: message.instanceId,
  })
  const {
    computedCorrectness,
    awardedCorrectnessPoints,
    awardedBonusPoints,
    awardedXp,
  } = grading

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
    getAssessmentResponseCorrectness(computedCorrectness)

  // if the response was correct, set the corresponding timestamp on the instance
  // if we are processing a first response, set the timestamp on the instance
  // this will allow us to award points for response timing
  await setFirstAssessmentResponseTimestamp({
    instanceKey,
    computedCorrectness,
    firstResponseReceivedAt,
    responseTimestamp,
  })

  // send audit-log event for computed points and XP
  const gradingLog = `[INFO] [AddResponse Assessment] Computed points for instance ${message.instanceId}. Base Points: ${awardedBasePoints}, Correctness Points: ${awardedCorrectnessPoints}, Bonus Points: ${awardedBonusPoints}, XP: ${awardedXp}.`
  ctx.logger.info(gradingLog)
  ctx.v1.events.push('create-audit-log-entry', {
    correlationId: message.correlationId,
    info: gradingLog,
  })

  // ! Step 3: Validate that the submitting user has a valid participation in the assessment course (requirement for assessment responses)
  await requireAssessmentParticipation(
    courseId,
    message.participantId,
    message.liveQuizId
  )

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

  if (persistence.status === 'retry' && !persistence.effect) {
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
      throw new TypeError(
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

async function getExistingRedisCounterValues(
  redis: typeof redisExec,
  increments: Array<{ key: string; field: string }>
) {
  const values = new Map<string, string | null>()
  for (const { key, field } of increments) {
    const counterKey = `${key}\u0000${field}`
    if (!values.has(counterKey)) {
      values.set(counterKey, await redis.hget(key, field))
    }
  }
  return values
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

      const existingCounterValues = await getExistingRedisCounterValues(
        redis,
        plan.increments
      )
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
