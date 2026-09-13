import type {
  Context,
  DurableContext,
  JsonObject,
} from '@hatchet-dev/typescript-sdk/index.js'
import {
  getLiveQuizInstanceInfoKey,
  getLiveQuizLegacyResponseProcessedKey,
  getLiveQuizLegacyResponseReceivedKey,
  getLiveQuizResponseCountKey,
  getLiveQuizResponseReconciliationKey,
  getLiveQuizResponseReplayClaimKey,
  LIVE_QUIZ_RESPONSE_MAX_AGGREGATION_COMMANDS,
  LIVE_QUIZ_RESPONSE_PROCESSING_SCRIPT,
  LIVE_QUIZ_RESPONSE_REPLAY_CLAIM_TTL_SECONDS,
} from '@klicker-uzh/util'
import type { Redis } from 'ioredis'
import type { RedisCommand } from './helpers.js'

type ResponseAggregationContext =
  | Context<JsonObject>
  | DurableContext<JsonObject>

type ResponseAggregationResult = {
  status:
    | 'already_processed'
    | 'processed'
    | 'aggregation_failed'
    | 'reconciliation_required'
  counted?: boolean
  commandErrors?: string[]
  trackingErrors?: string[]
}

type ResponseAggregationRequest = {
  kind: 'regular' | 'assessment'
  claimId: string
  liveQuizId: string
  instanceId: string
  commands: RedisCommand[]
}

export async function executeResponseAggregation({
  redis,
  ctx,
  request,
}: {
  redis: Pick<Redis, 'eval'>
  ctx: ResponseAggregationContext
  request: ResponseAggregationRequest
}) {
  const metadata =
    request.kind === 'regular'
      ? {
          messageId: request.claimId,
          sessionId: request.liveQuizId,
          instanceId: request.instanceId,
        }
      : {
          correlationId: request.claimId,
          liveQuizId: request.liveQuizId,
          instanceId: request.instanceId,
        }

  try {
    const processingResult = JSON.parse(
      String(
        await redis.eval(
          LIVE_QUIZ_RESPONSE_PROCESSING_SCRIPT,
          6,
          getLiveQuizResponseReplayClaimKey({
            liveQuizId: request.liveQuizId,
            instanceId: request.instanceId,
          }),
          getLiveQuizResponseCountKey({
            liveQuizId: request.liveQuizId,
            instanceId: request.instanceId,
            status: 'processed',
          }),
          getLiveQuizInstanceInfoKey({
            liveQuizId: request.liveQuizId,
            instanceId: request.instanceId,
          }),
          getLiveQuizLegacyResponseProcessedKey({
            liveQuizId: request.liveQuizId,
            instanceId: request.instanceId,
          }),
          getLiveQuizResponseReconciliationKey({
            liveQuizId: request.liveQuizId,
            instanceId: request.instanceId,
          }),
          getLiveQuizLegacyResponseReceivedKey({
            liveQuizId: request.liveQuizId,
            instanceId: request.instanceId,
          }),
          request.claimId,
          String(LIVE_QUIZ_RESPONSE_REPLAY_CLAIM_TTL_SECONDS),
          JSON.stringify(request.commands),
          String(LIVE_QUIZ_RESPONSE_MAX_AGGREGATION_COMMANDS)
        )
      )
    ) as ResponseAggregationResult

    if (processingResult.status === 'already_processed') {
      ctx.logger.info(
        request.kind === 'regular'
          ? 'Response already processed, skipping'
          : 'Assessment response already processed, skipping',
        metadata
      )
      return { status: 200 }
    }

    if (processingResult.status === 'reconciliation_required') {
      ctx.logger.error(
        request.kind === 'regular'
          ? 'Redis response aggregation requires reconciliation; replay claim retained'
          : 'Redis assessment aggregation requires reconciliation; replay claim retained',
        {
          extra: {
            ...metadata,
            commandErrors: processingResult.commandErrors ?? [],
            trackingErrors: processingResult.trackingErrors ?? [],
          },
        }
      )
      throw new Error(
        `${
          request.kind === 'regular'
            ? 'Redis response aggregation'
            : 'Redis assessment aggregation'
        } requires reconciliation: ${(processingResult.commandErrors ?? []).join('; ') || 'unknown command error'}`
      )
    }

    if (
      processingResult.status !== 'processed' &&
      processingResult.status !== 'aggregation_failed'
    ) {
      throw new Error('Redis response processing returned an invalid status')
    }

    if (
      processingResult.status === 'aggregation_failed' ||
      processingResult.commandErrors?.length
    ) {
      const commandErrors = processingResult.commandErrors ?? []
      ctx.logger.error(
        request.kind === 'regular'
          ? 'Redis results aggregation commands failed; retrying response processing'
          : 'Redis results aggregation commands failed; retrying assessment processing',
        { extra: { ...metadata, commandErrors } }
      )
      throw new Error(
        `Redis response aggregation failed: ${commandErrors.join('; ') || 'unknown command error'}`
      )
    }

    if (processingResult.trackingErrors?.length) {
      ctx.logger.error(
        request.kind === 'regular'
          ? 'Failed to track processed response'
          : 'Failed to track processed assessment response',
        {
          extra: {
            ...metadata,
            trackingErrors: processingResult.trackingErrors,
          },
        }
      )
    }

    ctx.logger.info(
      request.kind === 'regular'
        ? "Successfully processed participant's response"
        : "Successfully aggregated a participant's results",
      metadata
    )
    return { status: 200 }
  } catch (error) {
    const logMessage =
      request.kind === 'regular'
        ? 'Redis transaction failed'
        : 'Redis pipeline for results aggregation failed'
    ctx.logger.error(logMessage, {
      error: error instanceof Error ? error : new Error(String(error)),
      extra: metadata,
    })
    throw new Error(`${logMessage} ${String(error)}`)
  }
}
