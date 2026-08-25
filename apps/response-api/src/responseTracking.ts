import {
  getLiveQuizInstanceInfoKey,
  getLiveQuizResponseCountKey,
  LIVE_QUIZ_RESPONSE_RECEIVED_SCRIPT,
  LIVE_QUIZ_RESPONSE_TRACKING_TTL_SECONDS,
} from '@klicker-uzh/util'
import type { Redis } from 'ioredis'

type ResponseTrackingRedis = Pick<Redis, 'eval'>

type ReceivedTrackingResult =
  | { status: 'inactive' }
  | { status: 'tracked'; ttl: number }
  | { status: 'tracking_failed'; error: string }

export async function trackLiveQuizResponseIfActive({
  redisClient,
  liveQuizId,
  instanceId,
}: {
  redisClient: ResponseTrackingRedis
  liveQuizId: string
  instanceId: string | number
}): Promise<boolean> {
  const instanceInfoKey = getLiveQuizInstanceInfoKey({
    liveQuizId,
    instanceId,
  })
  const trackingResult = JSON.parse(
    String(
      await redisClient.eval(
        LIVE_QUIZ_RESPONSE_RECEIVED_SCRIPT,
        2,
        getLiveQuizResponseCountKey({
          liveQuizId,
          instanceId,
          status: 'received',
        }),
        instanceInfoKey,
        String(LIVE_QUIZ_RESPONSE_TRACKING_TTL_SECONDS)
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
