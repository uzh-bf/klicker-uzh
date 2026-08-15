import type { PrismaClient } from '@klicker-uzh/prisma/client'
import { LiveQuizResponseCollectionMode } from '@klicker-uzh/prisma/client'
import {
  CORRELATED_RESPONSE_EVENT,
  type CorrelatedResponseDeliveryMessage,
  parseCorrelatedResponseInstanceInfo,
  validateStudentResponse,
} from '@klicker-uzh/util'
import { admitCorrelatedResponse } from './correlatedResponseAdmission.js'
import { resolveCorrelatedResponseIdentity } from './liveQuizResponseInitialization.js'
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

  const identityConfig = getIdentityConfig()
  const identity = await resolveCorrelatedResponseIdentity({
    database,
    cookieHeader: request.cookieHeader,
    liveQuizId: request.liveQuizId,
    secret: identityConfig.secret,
    issuer: identityConfig.issuer,
    respondentToken: request.respondentToken,
  })
  if (!identity) {
    return {
      status: 401,
      body: { error: 'Live quiz response identity required' },
    }
  }
  if (identity.kind === 'temporary') {
    return {
      status: 401,
      body: { error: 'Live quiz response identity is no longer active' },
    }
  }

  const acceptedInstanceInfo = parseCorrelatedResponseInstanceInfo(instanceInfo)
  if (!acceptedInstanceInfo) {
    return {
      status: 400,
      body: { error: 'Invalid correlated response metadata' },
    }
  }

  if (acceptedInstanceInfo.type === 'FREE_TEXT') {
    return {
      status: 400,
      body: {
        error:
          'Free-text responses are not retained for correlated teaching exports',
      },
    }
  }

  let restrictions: unknown
  try {
    restrictions = acceptedInstanceInfo.restrictions
      ? JSON.parse(acceptedInstanceInfo.restrictions)
      : undefined
  } catch {
    return {
      status: 400,
      body: { error: 'Invalid correlated response metadata' },
    }
  }

  const validation = validateStudentResponse({
    type: acceptedInstanceInfo.type,
    response: request.response,
    instanceInfo: acceptedInstanceInfo,
    restrictions,
  })
  if (!validation.valid) {
    return { status: 400, body: { error: validation.message } }
  }

  const registration = await admitCorrelatedResponse({
    database,
    identity,
    liveQuizId: request.liveQuizId,
    instanceId: request.instanceId,
    messageId: request.messageId,
    response: request.response,
    responseTimestamp: request.responseTimestamp,
    instanceInfo: acceptedInstanceInfo,
    cookieHeader: request.cookieHeader,
    secret: identityConfig.secret,
  })
  if (registration.status === 'invalid_metadata') {
    return {
      status: 400,
      body: { error: 'Invalid correlated response metadata' },
    }
  }
  if (registration.status === 'invalid_identity') {
    return {
      status: 401,
      body: { error: 'Live quiz response identity is no longer active' },
    }
  }
  if (registration.status === 'pin_required') {
    return { status: 403, body: { error: 'Live quiz PIN required' } }
  }
  if (registration.status === 'duplicate') {
    return {
      status: 208,
      body: {
        status: 'response_recorded_before',
        responseTimestamp: request.responseTimestamp,
      },
    }
  }
  if (registration.status === 'not_found') {
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
