import { LiveQuizResponseCollectionMode } from '@klicker-uzh/prisma/client'
import type { LiveQuizResponseEventMessage } from '@klicker-uzh/util'
import type { LiveQuizResponseRequest } from './liveQuizResponseRequest.js'

type AggregateResponseEvent =
  | 'response-received:authenticated'
  | 'response-received:anonymous'

export async function handleAggregateResponse({
  request,
  responseCollectionMode,
  pushEvent,
}: {
  request: LiveQuizResponseRequest
  responseCollectionMode: LiveQuizResponseCollectionMode
  pushEvent: (
    eventName: AggregateResponseEvent,
    message: LiveQuizResponseEventMessage
  ) => Promise<unknown>
}) {
  if (
    responseCollectionMode === LiveQuizResponseCollectionMode.CORRELATED_EXPORT
  ) {
    return {
      status: 409,
      body: {
        error: 'Response endpoint does not match live quiz collection mode',
      },
    }
  }

  const cookie = getAggregateResponseCookie(request.cookieHeader)
  const eventName: AggregateResponseEvent = cookie
    ? 'response-received:authenticated'
    : 'response-received:anonymous'
  const message: LiveQuizResponseEventMessage = {
    messageId: request.messageId,
    sessionId: request.liveQuizId,
    instanceId: request.instanceId,
    response: request.response,
    cookie,
    responseTimestamp: request.responseTimestamp,
  }

  console.log(`Pushing event ${eventName}`, {
    messageId: request.messageId,
    sessionId: request.liveQuizId,
    instanceId: request.instanceId,
    responseTimestamp: request.responseTimestamp,
  })
  await pushEvent(eventName, message)

  return {
    status: 200,
    body: { status: 'ok', responseTimestamp: request.responseTimestamp },
  }
}

function getAggregateResponseCookie(cookieHeader: string | undefined) {
  if (!cookieHeader) return undefined

  const parts = cookieHeader.split(';').map((part) => part.trim())
  const participantPair = parts.find((part) =>
    part.startsWith('participant_token=')
  )
  const temporaryPair = parts.find((part) =>
    part.startsWith('temporary_participant_token=')
  )
  const forwarded = [participantPair, temporaryPair].filter(
    (pair): pair is string => Boolean(pair)
  )

  return forwarded.length > 0 ? forwarded.join('; ') : undefined
}
