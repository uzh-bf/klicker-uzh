import {
  getLiveQuizInstanceInfoKey,
  getLiveQuizResponseCountKey,
  LIVE_QUIZ_RESPONSE_RECEIVED_SCRIPT,
  LIVE_QUIZ_RESPONSE_TRACKING_TTL_SECONDS,
} from '@klicker-uzh/util'
import type { Redis } from 'ioredis'

type ResponseTrackingRedis = Pick<Redis, 'eval' | 'exists'>

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
  if ((await redisClient.exists(instanceInfoKey)) !== 1) {
    return false
  }

  const instanceInfoTtl = await redisClient.eval(
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

  if (!Number.isInteger(Number(instanceInfoTtl))) {
    throw new Error('Live quiz response tracking returned an invalid TTL')
  }

  return true
}
