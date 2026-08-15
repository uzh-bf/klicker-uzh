import { prisma } from '@klicker-uzh/prisma'
import type { PrismaClient } from '@klicker-uzh/prisma/client'
import type {
  CorrelatedResponseDeliveryMessage,
  CorrelatedResponseEventMessage,
} from '@klicker-uzh/util'
import type { Redis } from 'ioredis'
import { getRedis } from '../redis.js'
import {
  applyCorrelatedRedisMutationsWithFence,
  type CorrelatedProcessingState,
  CorrelatedResponseIdentityError,
  CorrelatedResponseMutationLimitError,
  persistAcceptedCorrelatedResponse,
  prepareCorrelatedMessageProcessing,
  resolveCorrelatedResponseDelivery,
  settleCorrelatedResponseOutbox,
} from './correlatedResponse.js'
import {
  prepareQuestionResponse,
  type ResponseProcessorContext,
  responseLogContext,
} from './processor.js'
import {
  planCorrelatedQuestionResponseEffects,
  type RedisHashMutation,
} from './responseEffects.js'

type CorrelatedProcessorDatabase = Pick<
  PrismaClient,
  | '$transaction'
  | 'liveQuizPendingResponse'
  | 'liveQuizRespondent'
  | 'liveQuizResponse'
>

export async function processCorrelatedResponseMessage(
  delivery: CorrelatedResponseDeliveryMessage,
  ctx: ResponseProcessorContext
) {
  return processCorrelatedResponseMessageWithDependencies(delivery, ctx, {
    database: prisma,
    redis: getRedis(),
    secret: process.env.APP_SECRET,
  })
}

export async function processCorrelatedResponseMessageWithDependencies(
  delivery: CorrelatedResponseDeliveryMessage,
  ctx: ResponseProcessorContext,
  {
    database,
    redis,
    secret,
  }: {
    database: CorrelatedProcessorDatabase
    redis: Redis
    secret: string | undefined
  }
) {
  ctx.logger.info('ProcessCorrelatedResponse: received message', {
    messageId: delivery.messageId,
  })

  if (!secret) {
    throw new Error(
      'APP_SECRET is required to process correlated live quiz responses'
    )
  }

  const deliveryMessage = await resolveCorrelatedResponseDelivery({
    database,
    messageId: delivery.messageId,
    secret,
  })
  if (!deliveryMessage) {
    return { status: 200 }
  }

  return processResolvedCorrelatedResponse({
    ...deliveryMessage,
    ctx,
    database,
    redis,
  })
}

async function processResolvedCorrelatedResponse({
  message,
  responseKey,
  ctx,
  database,
  redis,
}: {
  message: CorrelatedResponseEventMessage
  responseKey: string
  ctx: ResponseProcessorContext
  database: CorrelatedProcessorDatabase
  redis: Redis
}) {
  let correlatedState: CorrelatedProcessingState | undefined
  let redisMutations: RedisHashMutation[] | undefined
  const instanceKey = `lq:${message.sessionId}:i:${message.instanceId}`

  const settleOutbox = () =>
    settleCorrelatedResponseOutbox({
      database,
      messageId: message.messageId,
    })
  const releaseInvalidResponse = async () => {
    await settleOutbox()
  }

  try {
    const instanceInfo = message.instanceInfo

    const preparation = await prepareCorrelatedMessageProcessing({
      database,
      message,
      blockExecution: instanceInfo.blockExecution,
      responseKey,
    })
    if (preparation.status === 'invalid') {
      await settleOutbox()
      return { status: 400 }
    }
    correlatedState = preparation.state

    if (
      instanceInfo.blockClosedAt &&
      Number(message.responseTimestamp) > Number(instanceInfo.blockClosedAt)
    ) {
      ctx.logger.error(
        `[CANCEL] Response received at ${new Date(Number(message.responseTimestamp))} after block of element instance ${message.instanceId} was closed at ${new Date(Number(instanceInfo.blockClosedAt))}.`
      )
      ctx.cancel()
      await releaseInvalidResponse()
      return { status: 200 }
    }

    const prepared = prepareQuestionResponse({ message, instanceInfo })
    if (prepared.status === 'invalid') {
      ctx.logger.error(prepared.message, {
        extra: responseLogContext(message),
      })
      await releaseInvalidResponse()
      return { status: 400 }
    }

    const effectPlan = planCorrelatedQuestionResponseEffects({
      type: prepared.type,
      choiceCount:
        'choiceCount' in instanceInfo ? instanceInfo.choiceCount : undefined,
      response: message.response,
      instanceInfo,
      instanceKey,
      firstResponseReceivedAt: instanceInfo.firstResponseReceivedAt,
      responseTimestamp: message.responseTimestamp,
      basePoints: instanceInfo.basePoints,
      defaultPoints: instanceInfo.defaultPoints,
      pointsMultiplier: instanceInfo.pointsMultiplier,
      parsedSolutions: prepared.parsedSolutions,
    })
    const grading = effectPlan.grading
    redisMutations = effectPlan.aggregateMutations

    if (!grading) {
      throw new Error('Missing correlated response grading')
    }

    const persistence = await persistAcceptedCorrelatedResponse({
      database,
      liveQuizId: message.sessionId,
      owner: correlatedState.owner,
      instanceId: correlatedState.instanceId,
      publicationGeneration: message.publicationGeneration,
      blockExecution: correlatedState.blockExecution,
      response: message.response,
      submittedAt: message.responseTimestamp,
      correctnessPercentage: grading.correctnessPercentage,
      basePoints: grading.basePoints,
      correctnessPoints: grading.correctnessPoints,
      bonusPoints: grading.bonusPoints,
    })
    if (persistence === 'inactive') {
      await releaseInvalidResponse()
      return { status: 200 }
    }
    if (persistence === 'duplicate') {
      await releaseInvalidResponse()
      return { status: 208 }
    }
    if (!persistence.applyRedisEffects) {
      await settleOutbox()
      return { status: 200 }
    }
  } catch (error) {
    ctx.logger.error(`Error processing correlated response: ${String(error)}`, {
      extra: responseLogContext(message),
    })
    if (error instanceof CorrelatedResponseIdentityError) {
      await releaseInvalidResponse()
      return { status: 400 }
    }
    throw new Error(
      `Correlated response processing failed for message ${message.messageId}: ${String(error)}`
    )
  }

  try {
    if (!correlatedState || !redisMutations) {
      throw new Error('Missing correlated response processing state')
    }
    const result = await applyCorrelatedRedisMutationsWithFence({
      database,
      liveQuizId: message.sessionId,
      instanceId: correlatedState.instanceId,
      publicationGeneration: message.publicationGeneration,
      redis,
      mutations: redisMutations,
      processedKey: correlatedState.processedKey,
      instanceInfoKey: `${instanceKey}:info`,
      blockExecution: correlatedState.blockExecution,
      identityKey: correlatedState.owner.identityKey,
      messageId: message.messageId,
    })
    if (result === 'duplicate') {
      await settleOutbox()
      return { status: 208 }
    }

    await settleOutbox()
    ctx.logger.info("Successfully processed participant's response", {
      extra: responseLogContext(message),
    })
    return { status: 200 }
  } catch (error) {
    ctx.logger.error(`Redis transaction failed: ${String(error)}`, {
      extra: responseLogContext(message),
    })
    if (error instanceof CorrelatedResponseMutationLimitError) {
      await settleOutbox()
      return { status: 400 }
    }
    throw new Error(`Redis transaction failed ${String(error)}`)
  }
}
