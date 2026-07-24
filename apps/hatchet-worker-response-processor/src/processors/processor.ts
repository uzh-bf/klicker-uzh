// TODO: code from azure function, requires a complete rework to hatchet best practices (e.g., as a DAG etc. for immutability and retriability)

// TODO: add additional processor with assessment logic
import type {
  Context,
  DurableContext,
  JsonObject,
} from '@hatchet-dev/typescript-sdk/index.js'
import { prisma } from '@klicker-uzh/prisma'
import {
  LiveQuizResponseCollectionMode,
  UserRole,
} from '@klicker-uzh/prisma/client'
import type {
  FreeTextRestrictions,
  LiveQuizResponseInput,
  NumericalRestrictions,
} from '@klicker-uzh/types'
import {
  releaseCorrelatedResponse,
  verifyJWT,
  type CorrelatedResponseClaim,
  type JWTPayload,
} from '@klicker-uzh/util'
import { strict as assert } from 'assert'
import { getRedis } from '../redis.js'
import {
  applyCorrelatedRedisMutations,
  buildCorrelatedResponseCreateData,
  CorrelatedRedisMutationBuffer,
  CorrelatedResponseIdentityError,
  prepareCorrelatedMessageProcessing,
  releaseCorrelatedProcessingLock,
  validateCorrelatedRedisHashKeys,
  type CorrelatedProcessingState,
  type RedisHashMutationQueue,
} from './correlatedResponse.js'
import { validateStudentResponse } from './helpers.js'
import {
  isLiveQuizQuestionType,
  queueQuestionResponseEffects,
} from './responseEffects.js'

// TODO: what if the participant is not part of the course? when starting a session, prepopulate the leaderboard with all participations? what if a participant joins the course during a session? filter out all 0 point participants before rendering the LB
// TODO: ensure that the response meets the restrictions specified in the element options

const redisExec = getRedis() // use standard redis instance for regular response processor

export async function processResponseMessage(
  message: {
    messageId: string
    sessionId: string
    instanceId: string
    response: LiveQuizResponseInput
    cookie?: string
    responseTimestamp: number
    correlatedClaim?: CorrelatedResponseClaim
  },
  ctx: Context<JsonObject, {}> | DurableContext<JsonObject, {}>
) {
  ctx.logger.info('ProcessResponse: received message', {
    messageId: message.messageId,
    sessionId: message.sessionId,
    instanceId: message.instanceId,
  })

  try {
    assert(!!redisExec)
  } catch (e) {
    ctx.logger.error(`Redis connection error: ${JSON.stringify(e)}`)
    throw new Error(`Redis connection error ${String(e)}`)
  }

  if (message.sessionId === 'ping') {
    if (process.env.FUNCTION_HEARTBEAT_URL) {
      await fetch(process.env.FUNCTION_HEARTBEAT_URL)
    }
    return { status: 200 }
  }

  const releaseClaim = async () => {
    if (!message.correlatedClaim) return

    await releaseCorrelatedResponse({
      redis: redisExec,
      ...message.correlatedClaim,
      messageId: message.messageId,
    })
  }

  let aggregatePipeline = redisExec.pipeline()
  let redisMulti: RedisHashMutationQueue = aggregatePipeline
  let correlatedMutationBuffer: CorrelatedRedisMutationBuffer | undefined
  const isCorrelated = message.correlatedClaim !== undefined
  let correlatedState: CorrelatedProcessingState | undefined

  const releaseProcessingLock = async () => {
    if (!correlatedState) return

    await releaseCorrelatedProcessingLock({
      redis: redisExec,
      lockKey: correlatedState.processingLockKey,
      messageId: message.messageId,
    })
  }

  const releaseInvalidCorrelatedResponse = async () => {
    await releaseProcessingLock()
    await releaseClaim()
  }

  try {
    const liveQuizKey = `lq:${message.sessionId}`
    const instanceKey = `${liveQuizKey}:i:${message.instanceId}`
    const responseTimestamp = message.responseTimestamp
    const response = message.response
    if (!response) {
      ctx.logger.error(
        'Missing response ' +
          JSON.stringify({
            messageId: message.messageId,
            sessionId: message.sessionId,
            instanceId: message.instanceId,
          })
      )
      await releaseClaim()
      return { status: 400 }
    }

    const instanceInfo = await redisExec.hgetall(`${instanceKey}:info`)
    // if the instance metadata is not available, it has been closed and purged already
    if (!instanceInfo || Object.keys(instanceInfo).length === 0) {
      ctx.logger.info('Element instance metadata not found', {
        messageId: message.messageId,
        sessionId: message.sessionId,
        instanceId: message.instanceId,
      })
      await releaseClaim()
      return { status: 400 }
    }
    ctx.logger.info('Instance info loaded', {
      sessionId: message.sessionId,
      instanceId: message.instanceId,
    })

    const {
      type,
      solutions,
      restrictions,
      firstResponseReceivedAt,
      sessionBlockId,
      choiceCount,
      basePoints,
      pointsMultiplier,
      defaultPoints,
      blockExecution,
      blockClosedAt,
    } = instanceInfo
    if (!type) {
      await releaseClaim()
      return { status: 400 }
    }

    const cachedResponseCollectionMode = instanceInfo.responseCollectionMode
    const responseCollectionMode =
      cachedResponseCollectionMode ===
        LiveQuizResponseCollectionMode.AGGREGATED_ANONYMOUS ||
      cachedResponseCollectionMode ===
        LiveQuizResponseCollectionMode.CORRELATED_EXPORT
        ? cachedResponseCollectionMode
        : (
            await prisma.liveQuiz.findUnique({
              where: { id: message.sessionId },
              select: { responseCollectionMode: true },
            })
          )?.responseCollectionMode
    if (!responseCollectionMode) {
      await releaseClaim()
      return { status: 400 }
    }

    const storedModeIsCorrelated =
      responseCollectionMode ===
      LiveQuizResponseCollectionMode.CORRELATED_EXPORT
    if (isCorrelated !== storedModeIsCorrelated) {
      ctx.logger.error('Response event does not match response collection mode')
      await releaseClaim()
      return { status: 400 }
    }

    if (isCorrelated) {
      correlatedMutationBuffer = new CorrelatedRedisMutationBuffer()
      redisMulti = correlatedMutationBuffer
    } else {
      aggregatePipeline = redisExec.pipeline()
      redisMulti = aggregatePipeline
    }

    let participantData: JWTPayload | null = null
    if (isCorrelated) {
      const secret = process.env.APP_SECRET
      const issuer = process.env.APP_ORIGIN_API
      if (!secret || !issuer) {
        throw new Error(
          'APP_SECRET and APP_ORIGIN_API are required for correlated live quiz responses'
        )
      }

      const preparation = await prepareCorrelatedMessageProcessing({
        redis: redisExec,
        database: prisma,
        message,
        blockExecution,
        sessionBlockId,
        secret,
        issuer,
      })
      if (preparation.status === 'invalid') {
        await releaseClaim()
        return { status: 400 }
      }
      if (preparation.status === 'processed') {
        await releaseClaim()
        return { status: 200 }
      }
      if (preparation.status === 'duplicate') {
        await releaseClaim()
        return { status: 208 }
      }

      correlatedState = preparation.state

      participantData =
        correlatedState.owner.kind === 'participant'
          ? { sub: correlatedState.owner.id, role: UserRole.PARTICIPANT }
          : correlatedState.owner.kind === 'temporary'
            ? {
                sub: correlatedState.owner.id,
                role: UserRole.TEMPORARY_PARTICIPANT,
              }
            : null
    } else if (typeof message.cookie === 'string') {
      try {
        const parsedCookies = message.cookie
          .split(';')
          .map((v: string) => v.split('='))
          .reduce<Record<string, string>>((acc, v) => {
            acc[decodeURIComponent(v[0]!.trim())] = decodeURIComponent(
              v[1]!.trim()
            )
            return acc
          }, {})

        if (parsedCookies['participant_token'] !== undefined) {
          participantData = await verifyJWT(
            parsedCookies['participant_token'],
            process.env.APP_SECRET as string
          )

          if (participantData.role !== 'PARTICIPANT') {
            participantData = null
          } else {
            ctx.logger.info("Participant's JWT verified")
          }
        } else if (parsedCookies['temporary_participant_token'] !== undefined) {
          participantData = await verifyJWT(
            parsedCookies['temporary_participant_token'],
            process.env.APP_SECRET as string
          )

          if (participantData.role !== 'TEMPORARY_PARTICIPANT') {
            participantData = null
          } else {
            ctx.logger.info("Temporary Participant's JWT verified")
          }
        }
      } catch (e) {
        ctx.logger.error(`JWT verification failed: ${String(e)}`)
      }

      if (
        participantData &&
        (await redisExec.hexists(
          `${instanceKey}:responses`,
          participantData.role === 'TEMPORARY_PARTICIPANT'
            ? `temporary-${participantData.sub}`
            : participantData.sub
        ))
      ) {
        ctx.logger.info(
          'Participant has already responded to this question instance'
        )
        return { status: 200 }
      }
    }

    if (blockClosedAt && Number(responseTimestamp) > Number(blockClosedAt)) {
      ctx.logger.error(
        `[CANCEL] [AddResponse Assessment] Response received at ${new Date(Number(responseTimestamp))} after block of element instance ${message.instanceId} was closed at ${new Date(Number(blockClosedAt))}.`
      )
      ctx.cancel()
      await releaseInvalidCorrelatedResponse()
      return { status: 200 }
    }

    let parsedSolutions = undefined
    try {
      if (solutions) {
        parsedSolutions = JSON.parse(solutions)
      }
    } catch (e) {
      throw new Error('Error parsing solutions: ' + String(e))
    }

    // validate the incoming response
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
      throw new Error(
        `Error ${String(e)} occurred when parsing restrictions: ${restrictions}`
      )
    }

    if (!isLiveQuizQuestionType(type)) {
      ctx.logger.error(`Unsupported response element type ${type}`)
      await releaseInvalidCorrelatedResponse()
      return { status: 400 }
    }

    const { valid, message: validationError } = validateStudentResponse({
      type,
      response,
      restrictions: parsedRestrictions,
    })

    if (!valid) {
      ctx.logger.error(
        'Response validation failed: ' +
          validationError +
          JSON.stringify({
            messageId: message.messageId,
            sessionId: message.sessionId,
            instanceId: message.instanceId,
          })
      )
      await releaseInvalidCorrelatedResponse()
      return { status: 400 }
    }

    const grading = queueQuestionResponseEffects({
      type,
      choiceCount,
      response,
      instanceInfo,
      instanceKey,
      liveQuizKey,
      sessionBlockId: sessionBlockId!,
      firstResponseReceivedAt,
      responseTimestamp,
      basePoints,
      defaultPoints,
      pointsMultiplier,
      parsedSolutions,
      participantData,
      isCorrelated,
      redisMulti,
    })

    if (correlatedState && grading) {
      await validateCorrelatedRedisHashKeys({
        redis: redisExec,
        keys: [
          `${instanceKey}:info`,
          `${instanceKey}:results`,
          `${instanceKey}:responseHashes`,
          `${instanceKey}:responses`,
          `${liveQuizKey}:b:${sessionBlockId}:lb`,
          `${liveQuizKey}:b:${sessionBlockId}:lbTemporary`,
          `${liveQuizKey}:lb`,
          `${liveQuizKey}:lbTemporary`,
          `${liveQuizKey}:xp`,
          correlatedState.processedKey,
        ],
      })

      if (!correlatedState.responsePersisted) {
        try {
          await prisma.liveQuizResponse.create({
            data: buildCorrelatedResponseCreateData({
              owner: correlatedState.owner,
              instanceId: correlatedState.instanceId,
              blockExecution: correlatedState.blockExecution,
              response,
              submittedAt: responseTimestamp,
              correctnessPercentage: grading.correctnessPercentage,
              basePoints: grading.basePoints,
              correctnessPoints: grading.correctnessPoints,
              bonusPoints: grading.bonusPoints,
            }),
          })
          correlatedState.responsePersisted = true
        } catch (error) {
          if (
            typeof error === 'object' &&
            error !== null &&
            'code' in error &&
            error.code === 'P2002'
          ) {
            await releaseProcessingLock()
            await releaseClaim()
            return { status: 208 }
          }
          throw error
        }
      }
    }
  } catch (e) {
    ctx.logger.error(
      `Error processing response: ${String(e)} ` +
        JSON.stringify({
          messageId: message.messageId,
          sessionId: message.sessionId,
          instanceId: message.instanceId,
        })
    )
    if (!isCorrelated) {
      aggregatePipeline.discard()
    }
    if (e instanceof CorrelatedResponseIdentityError) {
      await releaseInvalidCorrelatedResponse()
      return { status: 400 }
    }
    if (isCorrelated) {
      await releaseProcessingLock()
      throw new Error(
        `Correlated response processing failed for message ${message.messageId}: ${String(e)}`
      )
    }

    return { status: 500 }
  }

  try {
    if (isCorrelated) {
      if (!correlatedState || !correlatedMutationBuffer) {
        throw new Error('Missing correlated response processing state')
      }
      const result = await applyCorrelatedRedisMutations({
        redis: redisExec,
        mutations: correlatedMutationBuffer.mutations,
        processedKey: correlatedState.processedKey,
        identityKey: correlatedState.owner.identityKey,
        messageId: message.messageId,
      })
      if (result === 'duplicate') {
        await releaseProcessingLock()
        await releaseClaim()
        return { status: 208 }
      }
    } else {
      await aggregatePipeline.exec()
    }
    await releaseProcessingLock()
    await releaseClaim()
    ctx.logger.info("Successfully processed participant's response", {
      messageId: message.messageId,
      sessionId: message.sessionId,
      instanceId: message.instanceId,
    })
    return { status: 200 }
  } catch (e) {
    ctx.logger.error(
      `Redis transaction failed: ${String(e)} ` +
        JSON.stringify({
          messageId: message.messageId,
          sessionId: message.sessionId,
          instanceId: message.instanceId,
        })
    )
    if (!isCorrelated) {
      aggregatePipeline.discard()
    }
    await releaseProcessingLock()
    throw new Error(`Redis transaction failed ${String(e)}`)
  }
}
