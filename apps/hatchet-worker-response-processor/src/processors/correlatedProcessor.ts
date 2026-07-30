import { prisma } from '@klicker-uzh/prisma'
import { LiveQuizResponseCollectionMode } from '@klicker-uzh/prisma/client'
import type {
  CorrelatedResponseDeliveryMessage,
  CorrelatedResponseEventMessage,
} from '@klicker-uzh/util'
import { getRedis } from '../redis.js'
import {
  applyCorrelatedRedisMutations,
  buildCorrelatedResponseCreateData,
  CorrelatedResponseIdentityError,
  prepareCorrelatedMessageProcessing,
  releaseCorrelatedProcessingLock,
  resolveCorrelatedResponseDelivery,
  resolveCorrelatedResponseInstanceInfo,
  settleCorrelatedResponseOutbox,
  validateCorrelatedRedisHashKeys,
  type CorrelatedProcessingState,
} from './correlatedResponse.js'
import {
  assertResponseRedis,
  prepareQuestionResponse,
  resolveLiveQuizResponseCollectionMode,
  responseLogContext,
  type ResponseProcessorContext,
} from './processor.js'
import {
  queueCorrelatedQuestionResponseEffects,
  RedisHashMutationBuffer,
} from './responseEffects.js'

const redisExec = getRedis()

export async function processCorrelatedResponseMessage(
  delivery: CorrelatedResponseDeliveryMessage,
  ctx: ResponseProcessorContext
) {
  ctx.logger.info('ProcessCorrelatedResponse: received message', {
    messageId: delivery.messageId,
  })
  assertResponseRedis(redisExec, ctx)

  const secret = process.env.APP_SECRET
  if (!secret) {
    throw new Error(
      'APP_SECRET is required to process correlated live quiz responses'
    )
  }

  const message = await resolveCorrelatedResponseDelivery({
    database: prisma,
    messageId: delivery.messageId,
    secret,
  })
  if (!message) {
    return { status: 200 }
  }

  return processResolvedCorrelatedResponse({ message, ctx })
}

async function processResolvedCorrelatedResponse({
  message,
  ctx,
}: {
  message: CorrelatedResponseEventMessage
  ctx: ResponseProcessorContext
}) {
  let correlatedState: CorrelatedProcessingState | undefined
  const mutationBuffer = new RedisHashMutationBuffer()

  const settleOutbox = () =>
    settleCorrelatedResponseOutbox({
      database: prisma,
      messageId: message.messageId,
    })
  const releaseProcessingLock = async () => {
    if (!correlatedState) return
    await releaseCorrelatedProcessingLock({
      redis: redisExec,
      lockKey: correlatedState.processingLockKey,
      messageId: message.messageId,
    })
  }
  const releaseInvalidResponse = async () => {
    await releaseProcessingLock()
    await settleOutbox()
  }

  try {
    if (!message.response) {
      ctx.logger.error('Missing response', {
        extra: responseLogContext(message),
      })
      await settleOutbox()
      return { status: 400 }
    }

    const liveQuizKey = `lq:${message.sessionId}`
    const instanceKey = `${liveQuizKey}:i:${message.instanceId}`
    const instanceInfo = resolveCorrelatedResponseInstanceInfo(
      message.instanceInfo
    )
    if (!instanceInfo) {
      ctx.logger.info('Element instance metadata not found', {
        extra: responseLogContext(message),
      })
      await settleOutbox()
      return { status: 400 }
    }

    const responseCollectionMode = await resolveLiveQuizResponseCollectionMode({
      database: prisma,
      liveQuizId: message.sessionId,
      instanceInfo,
    })
    if (
      responseCollectionMode !==
      LiveQuizResponseCollectionMode.CORRELATED_EXPORT
    ) {
      ctx.logger.error(
        'Correlated response event does not match response collection mode'
      )
      await settleOutbox()
      return { status: 400 }
    }

    const preparation = await prepareCorrelatedMessageProcessing({
      redis: redisExec,
      database: prisma,
      message,
      blockExecution: instanceInfo.blockExecution,
      sessionBlockId: instanceInfo.sessionBlockId,
    })
    if (preparation.status === 'invalid') {
      await settleOutbox()
      return { status: 400 }
    }
    if (preparation.status === 'processed') {
      await settleOutbox()
      return { status: 200 }
    }
    if (preparation.status === 'duplicate') {
      await settleOutbox()
      return { status: 208 }
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

    const grading = queueCorrelatedQuestionResponseEffects({
      type: prepared.type,
      choiceCount: instanceInfo.choiceCount,
      response: message.response,
      instanceInfo,
      instanceKey,
      firstResponseReceivedAt: instanceInfo.firstResponseReceivedAt,
      responseTimestamp: message.responseTimestamp,
      basePoints: instanceInfo.basePoints,
      defaultPoints: instanceInfo.defaultPoints,
      pointsMultiplier: instanceInfo.pointsMultiplier,
      parsedSolutions: prepared.parsedSolutions,
      redisMulti: mutationBuffer,
    })

    if (!grading) {
      throw new Error('Missing correlated response grading')
    }

    await validateCorrelatedRedisHashKeys({
      redis: redisExec,
      keys: [
        `${instanceKey}:info`,
        `${instanceKey}:results`,
        `${instanceKey}:responseHashes`,
        `${instanceKey}:responses`,
        `${liveQuizKey}:b:${instanceInfo.sessionBlockId}:lb`,
        `${liveQuizKey}:b:${instanceInfo.sessionBlockId}:lbTemporary`,
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
            response: message.response,
            submittedAt: message.responseTimestamp,
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
          await settleOutbox()
          return { status: 208 }
        }
        throw error
      }
    }
  } catch (error) {
    ctx.logger.error(`Error processing correlated response: ${String(error)}`, {
      extra: responseLogContext(message),
    })
    if (error instanceof CorrelatedResponseIdentityError) {
      await releaseInvalidResponse()
      return { status: 400 }
    }
    await releaseProcessingLock()
    throw new Error(
      `Correlated response processing failed for message ${message.messageId}: ${String(error)}`
    )
  }

  try {
    if (!correlatedState) {
      throw new Error('Missing correlated response processing state')
    }
    const result = await applyCorrelatedRedisMutations({
      redis: redisExec,
      mutations: mutationBuffer.mutations,
      processedKey: correlatedState.processedKey,
      identityKey: correlatedState.owner.identityKey,
      messageId: message.messageId,
    })
    if (result === 'duplicate') {
      await releaseProcessingLock()
      await settleOutbox()
      return { status: 208 }
    }

    await releaseProcessingLock()
    await settleOutbox()
    ctx.logger.info("Successfully processed participant's response", {
      extra: responseLogContext(message),
    })
    return { status: 200 }
  } catch (error) {
    ctx.logger.error(`Redis transaction failed: ${String(error)}`, {
      extra: responseLogContext(message),
    })
    await releaseProcessingLock()
    throw new Error(`Redis transaction failed ${String(error)}`)
  }
}
