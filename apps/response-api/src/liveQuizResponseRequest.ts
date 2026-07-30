import type { PrismaClient } from '@klicker-uzh/prisma/client'
import type { LiveQuizResponseInput } from '@klicker-uzh/types'
import type { Redis } from 'ioredis'
import { randomUUID } from 'node:crypto'
import { resolveResponseCollectionMode } from './correlatedResponses.js'

export type LiveQuizResponseRequest = {
  messageId: string
  liveQuizId: string
  instanceId: string
  response: LiveQuizResponseInput
  responseTimestamp: number
  cookieHeader: string | undefined
}

export function parseLiveQuizResponseRequest({
  payload,
  cookieHeader,
  now = Date.now,
}: {
  payload: unknown
  cookieHeader: string | undefined
  now?: () => number
}):
  | { ok: true; request: LiveQuizResponseRequest }
  | { ok: false; message: string } {
  if (!payload || typeof payload !== 'object') {
    return { ok: false, message: 'Body must be a JSON object' }
  }

  const { response, liveQuizId, instanceId } = payload as Record<
    string,
    unknown
  >
  if (!response || !liveQuizId || typeof instanceId === 'undefined') {
    return {
      ok: false,
      message: 'Missing required fields: response, liveQuizId, instanceId',
    }
  }

  return {
    ok: true,
    request: {
      messageId: randomUUID(),
      liveQuizId: String(liveQuizId),
      instanceId: String(instanceId),
      response: response as LiveQuizResponseInput,
      responseTimestamp: now(),
      cookieHeader,
    },
  }
}

export async function loadLiveQuizResponseInstance({
  database,
  redis,
  request,
}: {
  database: Pick<PrismaClient, 'liveQuiz'>
  redis: Pick<Redis, 'hgetall'>
  request: LiveQuizResponseRequest
}) {
  const instanceInfo = await redis.hgetall(
    `lq:${request.liveQuizId}:i:${request.instanceId}:info`
  )
  const responseCollectionMode = await resolveResponseCollectionMode({
    cachedMode: instanceInfo.responseCollectionMode,
    liveQuizId: request.liveQuizId,
    lookupMode: async (id) =>
      (
        await database.liveQuiz.findUnique({
          where: { id },
          select: { responseCollectionMode: true },
        })
      )?.responseCollectionMode ?? null,
  })

  return { instanceInfo, responseCollectionMode }
}
