import type { PrismaClient } from '@klicker-uzh/prisma/client'
import { LiveQuizResponseCollectionMode } from '@klicker-uzh/prisma/client'
import {
  CORRELATED_RESPONSE_EVENT,
  encryptCorrelatedResponseEvent,
  resolveLiveQuizResponseIdentity,
  validateStudentResponse,
  type CorrelatedResponseDeliveryMessage,
  type CorrelatedResponseEventMessage,
} from '@klicker-uzh/util'
import {
  getCorrelatedResponseAdmission,
  prepareCorrelatedResponseSubmission,
} from './correlatedResponseAdmission.js'
import { registerPendingCorrelatedResponse } from './correlatedResponseOutbox.js'
import type { LiveQuizResponseRequest } from './liveQuizResponseRequest.js'

export async function handleCorrelatedResponse({
  request,
  instanceInfo,
  responseCollectionMode,
  database,
  getIdentityConfig,
  pushEvent,
}: {
  request: LiveQuizResponseRequest
  instanceInfo: Record<string, string>
  responseCollectionMode: LiveQuizResponseCollectionMode
  database: PrismaClient
  getIdentityConfig: () => { secret: string; issuer: string }
  pushEvent: (
    eventName: typeof CORRELATED_RESPONSE_EVENT,
    message: CorrelatedResponseDeliveryMessage
  ) => Promise<unknown>
}) {
  if (
    responseCollectionMode !== LiveQuizResponseCollectionMode.CORRELATED_EXPORT
  ) {
    return {
      status: 409,
      body: {
        error: 'Response endpoint does not match live quiz collection mode',
      },
    }
  }

  const admission = await getCorrelatedResponseAdmission({
    database,
    liveQuizId: request.liveQuizId,
    cookieHeader: request.cookieHeader,
  })
  if (admission === 'not_found' || admission === 'not_required') {
    return { status: 404, body: { error: 'Live quiz not found' } }
  }
  if (admission === 'pin_required') {
    return { status: 403, body: { error: 'Live quiz PIN required' } }
  }

  const identityConfig = getIdentityConfig()
  const identity = await resolveLiveQuizResponseIdentity({
    cookieHeader: request.cookieHeader,
    liveQuizId: request.liveQuizId,
    secret: identityConfig.secret,
    issuer: identityConfig.issuer,
  })
  if (!identity) {
    return {
      status: 401,
      body: { error: 'Live quiz response identity required' },
    }
  }

  let restrictions: unknown
  try {
    restrictions = instanceInfo.restrictions
      ? JSON.parse(instanceInfo.restrictions)
      : undefined
  } catch (error) {
    throw new Error(
      `Invalid response restrictions for live quiz ${request.liveQuizId}, instance ${request.instanceId}: ${String(error)}`
    )
  }

  const validation = validateStudentResponse({
    type: instanceInfo.type,
    response: request.response,
    restrictions:
      typeof restrictions === 'object' && restrictions !== null
        ? restrictions
        : undefined,
  })
  if (!validation.valid) {
    return { status: 400, body: { error: validation.message } }
  }

  const preparation = await prepareCorrelatedResponseSubmission({
    database,
    identity,
    liveQuizId: request.liveQuizId,
    instanceId: request.instanceId,
    blockExecution: instanceInfo.blockExecution,
  })
  if (preparation.status === 'invalid_metadata') {
    return {
      status: 400,
      body: { error: 'Invalid correlated response metadata' },
    }
  }
  if (preparation.status === 'invalid_identity') {
    return {
      status: 401,
      body: { error: 'Live quiz response identity is no longer active' },
    }
  }
  const eventMessage: CorrelatedResponseEventMessage = {
    messageId: request.messageId,
    sessionId: request.liveQuizId,
    instanceId: request.instanceId,
    response: request.response,
    responseTimestamp: request.responseTimestamp,
    acceptedIdentity: preparation.acceptedIdentity,
    instanceInfo,
  }
  const registration = await registerPendingCorrelatedResponse({
    database,
    liveQuizId: request.liveQuizId,
    messageId: request.messageId,
    responseKey: preparation.responseKey,
    eventPayload: encryptCorrelatedResponseEvent({
      message: eventMessage,
      secret: identityConfig.secret,
    }),
  })
  if (registration === 'duplicate') {
    return {
      status: 208,
      body: {
        status: 'response_recorded_before',
        responseTimestamp: request.responseTimestamp,
      },
    }
  }
  if (registration === 'not_found') {
    return { status: 404, body: { error: 'Live quiz not found' } }
  }

  console.log('Pushing correlated response event', {
    event: CORRELATED_RESPONSE_EVENT,
    messageId: request.messageId,
    sessionId: request.liveQuizId,
    instanceId: request.instanceId,
    responseTimestamp: request.responseTimestamp,
  })
  try {
    await pushEvent(CORRELATED_RESPONSE_EVENT, {
      messageId: request.messageId,
    })
  } catch (error) {
    console.error('Immediate correlated response delivery failed', {
      messageId: request.messageId,
      error,
    })
    return {
      status: 200,
      body: {
        status: 'queued',
        responseTimestamp: request.responseTimestamp,
      },
    }
  }

  return {
    status: 200,
    body: { status: 'ok', responseTimestamp: request.responseTimestamp },
  }
}
