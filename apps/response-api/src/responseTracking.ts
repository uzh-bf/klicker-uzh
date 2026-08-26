import {
  getLiveQuizInstanceInfoKey,
  getLiveQuizLegacyResponseReceivedKey,
  getLiveQuizResponseCountKey,
  LIVE_QUIZ_RESPONSE_RECEIVED_SCRIPT,
  LIVE_QUIZ_RESPONSE_TRACKING_TTL_SECONDS,
} from '@klicker-uzh/util'
import type { Redis } from 'ioredis'

type ResponseTrackingRedis = Pick<Redis, 'eval'>

export const LIVE_QUIZ_RESPONSE_TRACKING_TIMEOUT_MS = 250
export const LIVE_QUIZ_RESPONSE_TRACKING_REDIS_OPTIONS = {
  commandTimeout: LIVE_QUIZ_RESPONSE_TRACKING_TIMEOUT_MS,
  enableOfflineQueue: false,
  lazyConnect: true,
  maxRetriesPerRequest: 0,
} as const

type ReceivedTrackingResult =
  | { status: 'inactive' }
  | { status: 'tracked'; ttl: number }
  | { status: 'tracking_failed'; error: string }

export async function trackLiveQuizResponseIfActive({
  redisClient,
  liveQuizId,
  instanceId,
  claimId,
}: {
  redisClient: ResponseTrackingRedis
  liveQuizId: string
  instanceId: string | number
  claimId: string
}): Promise<boolean> {
  const instanceInfoKey = getLiveQuizInstanceInfoKey({
    liveQuizId,
    instanceId,
  })
  const trackingResult = JSON.parse(
    String(
      await withTimeout(
        redisClient.eval(
          LIVE_QUIZ_RESPONSE_RECEIVED_SCRIPT,
          3,
          getLiveQuizResponseCountKey({
            liveQuizId,
            instanceId,
            status: 'received',
          }),
          instanceInfoKey,
          getLiveQuizLegacyResponseReceivedKey({ liveQuizId, instanceId }),
          String(LIVE_QUIZ_RESPONSE_TRACKING_TTL_SECONDS),
          claimId
        ),
        LIVE_QUIZ_RESPONSE_TRACKING_TIMEOUT_MS
      )
    )
  ) as ReceivedTrackingResult

  if (trackingResult.status === 'inactive') {
    return false
  }

  if (trackingResult.status === 'tracking_failed') {
    throw new Error(
      `Live quiz response tracking failed: ${trackingResult.error}`
    )
  }

  if (
    trackingResult.status !== 'tracked' ||
    !Number.isInteger(trackingResult.ttl)
  ) {
    throw new Error('Live quiz response tracking returned an invalid result')
  }

  return true
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number
): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined

  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => {
          reject(
            new Error(
              `Live quiz response tracking timed out after ${timeoutMs}ms`
            )
          )
        }, timeoutMs)
      }),
    ])
  } finally {
    if (timeout) {
      clearTimeout(timeout)
    }
  }
}
