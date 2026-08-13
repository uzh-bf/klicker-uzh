import type {
  Context,
  DurableContext,
  JsonObject,
} from '@hatchet-dev/typescript-sdk/index.js'
import {
  LiveQuizResponseCollectionMode,
  type PrismaClient,
} from '@klicker-uzh/prisma/client'
import type {
  FreeTextRestrictions,
  NumericalRestrictions,
} from '@klicker-uzh/types'
import type { LiveQuizResponseEventMessage } from '@klicker-uzh/util'
import { validateStudentResponse } from './helpers.js'
import {
  isLiveQuizQuestionType,
  type LiveQuizQuestionType,
} from './responseEffects.js'

export type ResponseProcessorContext =
  | Context<JsonObject, {}>
  | DurableContext<JsonObject, {}>

export async function handleResponseHeartbeat(
  message: LiveQuizResponseEventMessage
) {
  if (message.sessionId !== 'ping') return false

  if (process.env.FUNCTION_HEARTBEAT_URL) {
    await fetch(process.env.FUNCTION_HEARTBEAT_URL)
  }
  return true
}

export async function resolveLiveQuizResponseCollectionMode({
  database,
  liveQuizId,
  instanceInfo,
}: {
  database: Pick<PrismaClient, 'liveQuiz'>
  liveQuizId: string
  instanceInfo: Record<string, string>
}) {
  const cachedMode = instanceInfo.responseCollectionMode
  if (
    cachedMode === LiveQuizResponseCollectionMode.AGGREGATED_ANONYMOUS ||
    cachedMode === LiveQuizResponseCollectionMode.CORRELATED_EXPORT
  ) {
    return cachedMode
  }

  return (
    await database.liveQuiz.findUnique({
      where: { id: liveQuizId },
      select: { responseCollectionMode: true },
    })
  )?.responseCollectionMode
}

export function prepareQuestionResponse({
  message,
  instanceInfo,
  strictMetadata = true,
}: {
  message: LiveQuizResponseEventMessage
  instanceInfo: Record<string, string>
  strictMetadata?: boolean
}):
  | {
      status: 'ready'
      type: LiveQuizQuestionType
      parsedSolutions: unknown
    }
  | { status: 'invalid'; message: string } {
  if (!message.response) {
    return { status: 'invalid', message: 'Missing response' }
  }

  const type = instanceInfo.type
  if (!type) {
    return { status: 'invalid', message: 'Missing response element type' }
  }

  let parsedSolutions: unknown
  if (instanceInfo.solutions) {
    try {
      parsedSolutions = JSON.parse(instanceInfo.solutions)
    } catch (error) {
      throw new Error(`Error parsing solutions: ${String(error)}`)
    }
  }

  let parsedRestrictions:
    | NumericalRestrictions
    | FreeTextRestrictions
    | undefined
  if (instanceInfo.restrictions) {
    try {
      parsedRestrictions = JSON.parse(instanceInfo.restrictions)
    } catch (error) {
      throw new Error(
        `Error parsing restrictions for response instance ${message.instanceId}: ${String(error)}`
      )
    }
  }

  if (!isLiveQuizQuestionType(type)) {
    return {
      status: 'invalid',
      message: `Unsupported response element type ${type}`,
    }
  }

  const validation = validateStudentResponse({
    type,
    response: message.response,
    instanceInfo: strictMetadata ? instanceInfo : undefined,
    restrictions: parsedRestrictions,
  })
  if (!validation.valid) {
    return {
      status: 'invalid',
      message: `Response validation failed for ${type} question`,
    }
  }

  return { status: 'ready', type, parsedSolutions }
}

export function responseLogContext(message: LiveQuizResponseEventMessage) {
  return {
    messageId: message.messageId,
    sessionId: message.sessionId,
    instanceId: message.instanceId,
  }
}
