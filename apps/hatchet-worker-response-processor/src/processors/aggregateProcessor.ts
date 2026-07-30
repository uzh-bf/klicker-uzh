import { prisma } from '@klicker-uzh/prisma'
import {
  LiveQuizResponseCollectionMode,
  type PrismaClient,
} from '@klicker-uzh/prisma/client'
import {
  verifyJWT,
  type JWTPayload,
  type LiveQuizResponseEventMessage,
} from '@klicker-uzh/util'
import type { Redis } from 'ioredis'
import { getRedis } from '../redis.js'
import {
  handleResponseHeartbeat,
  prepareQuestionResponse,
  resolveLiveQuizResponseCollectionMode,
  responseLogContext,
  type ResponseProcessorContext,
} from './processor.js'
import { queueAggregateQuestionResponseEffects } from './responseEffects.js'

export async function processAggregateResponseMessage(
  message: LiveQuizResponseEventMessage,
  ctx: ResponseProcessorContext
) {
  return processAggregateResponseMessageWithDependencies(message, ctx, {
    database: prisma,
    redis: getRedis(),
  })
}

export async function processAggregateResponseMessageWithDependencies(
  message: LiveQuizResponseEventMessage,
  ctx: ResponseProcessorContext,
  {
    database,
    redis,
  }: {
    database: Pick<PrismaClient, 'liveQuiz'>
    redis: Redis
  }
) {
  ctx.logger.info('ProcessAggregateResponse: received message', {
    messageId: message.messageId,
  })

  if (await handleResponseHeartbeat(message)) {
    return { status: 200 }
  }

  let aggregatePipeline = redis.pipeline()

  try {
    if (!message.response) {
      ctx.logger.error('Missing response', {
        extra: responseLogContext(message),
      })
      return { status: 400 }
    }

    const liveQuizKey = `lq:${message.sessionId}`
    const instanceKey = `${liveQuizKey}:i:${message.instanceId}`
    const instanceInfo = await redis.hgetall(`${instanceKey}:info`)
    if (Object.keys(instanceInfo).length === 0) {
      ctx.logger.info('Element instance metadata not found', {
        extra: responseLogContext(message),
      })
      return { status: 400 }
    }

    const responseCollectionMode = await resolveLiveQuizResponseCollectionMode({
      database,
      liveQuizId: message.sessionId,
      instanceInfo,
    })
    if (
      responseCollectionMode !==
      LiveQuizResponseCollectionMode.AGGREGATED_ANONYMOUS
    ) {
      ctx.logger.error(
        'Aggregate response event does not match response collection mode'
      )
      return { status: 400 }
    }

    aggregatePipeline = redis.pipeline()
    const participantData = await resolveAggregateParticipant({
      message,
      instanceKey,
      ctx,
      redis,
    })
    if (participantData?.alreadyResponded) {
      return { status: 200 }
    }

    if (
      instanceInfo.blockClosedAt &&
      Number(message.responseTimestamp) > Number(instanceInfo.blockClosedAt)
    ) {
      ctx.logger.error(
        `[CANCEL] Response received at ${new Date(Number(message.responseTimestamp))} after block of element instance ${message.instanceId} was closed at ${new Date(Number(instanceInfo.blockClosedAt))}.`
      )
      ctx.cancel()
      return { status: 200 }
    }

    const prepared = prepareQuestionResponse({ message, instanceInfo })
    if (prepared.status === 'invalid') {
      ctx.logger.error(prepared.message, {
        extra: responseLogContext(message),
      })
      return { status: 400 }
    }

    queueAggregateQuestionResponseEffects({
      type: prepared.type,
      choiceCount: instanceInfo.choiceCount,
      response: message.response,
      instanceInfo,
      instanceKey,
      liveQuizKey,
      sessionBlockId: instanceInfo.sessionBlockId!,
      firstResponseReceivedAt: instanceInfo.firstResponseReceivedAt,
      responseTimestamp: message.responseTimestamp,
      basePoints: instanceInfo.basePoints,
      defaultPoints: instanceInfo.defaultPoints,
      pointsMultiplier: instanceInfo.pointsMultiplier,
      parsedSolutions: prepared.parsedSolutions,
      participantData: participantData?.payload ?? null,
      redisMulti: aggregatePipeline,
    })
  } catch (error) {
    ctx.logger.error(`Error processing aggregate response: ${String(error)}`, {
      extra: responseLogContext(message),
    })
    aggregatePipeline.discard()
    return { status: 500 }
  }

  try {
    await aggregatePipeline.exec()
    ctx.logger.info("Successfully processed participant's response", {
      extra: responseLogContext(message),
    })
    return { status: 200 }
  } catch (error) {
    ctx.logger.error(`Redis transaction failed: ${String(error)}`, {
      extra: responseLogContext(message),
    })
    aggregatePipeline.discard()
    throw new Error(`Redis transaction failed ${String(error)}`)
  }
}

async function resolveAggregateParticipant({
  message,
  instanceKey,
  ctx,
  redis,
}: {
  message: LiveQuizResponseEventMessage
  instanceKey: string
  ctx: ResponseProcessorContext
  redis: Pick<Redis, 'hexists'>
}) {
  if (typeof message.cookie !== 'string') return null

  let payload: JWTPayload | null = null
  try {
    const parsedCookies = message.cookie
      .split(';')
      .map((value) => value.split('='))
      .reduce<Record<string, string>>((cookies, [key, value]) => {
        cookies[decodeURIComponent(key!.trim())] = decodeURIComponent(
          value!.trim()
        )
        return cookies
      }, {})

    if (parsedCookies.participant_token !== undefined) {
      payload = await verifyJWT(
        parsedCookies.participant_token,
        process.env.APP_SECRET as string
      )
      if (payload.role !== 'PARTICIPANT') {
        payload = null
      } else {
        ctx.logger.info("Participant's JWT verified")
      }
    } else if (parsedCookies.temporary_participant_token !== undefined) {
      payload = await verifyJWT(
        parsedCookies.temporary_participant_token,
        process.env.APP_SECRET as string
      )
      if (payload.role !== 'TEMPORARY_PARTICIPANT') {
        payload = null
      } else {
        ctx.logger.info("Temporary Participant's JWT verified")
      }
    }
  } catch (error) {
    ctx.logger.error(`JWT verification failed: ${String(error)}`)
  }

  if (!payload) return null

  const alreadyResponded = await redis.hexists(
    `${instanceKey}:responses`,
    payload.role === 'TEMPORARY_PARTICIPANT'
      ? `temporary-${payload.sub}`
      : payload.sub
  )
  if (alreadyResponded) {
    ctx.logger.info(
      'Participant has already responded to this question instance'
    )
  }

  return { payload, alreadyResponded: Boolean(alreadyResponded) }
}
