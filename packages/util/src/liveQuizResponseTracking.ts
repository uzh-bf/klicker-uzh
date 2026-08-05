export type LiveQuizResponseTrackingStatus = 'received' | 'processed'

export const LIVE_QUIZ_RESPONSE_TRACKING_TTL_SECONDS = 60 * 60 * 24

export function getLiveQuizInstanceInfoKey({
  liveQuizId,
  instanceId,
}: {
  liveQuizId: string
  instanceId: string | number
}): string {
  return `lq:${liveQuizId}:i:${instanceId}:info`
}

export function getLiveQuizResponseTrackingTtl(
  instanceInfoTtl: number
): number | null {
  if (instanceInfoTtl >= 0) {
    return instanceInfoTtl
  }

  return instanceInfoTtl === -2 ? LIVE_QUIZ_RESPONSE_TRACKING_TTL_SECONDS : null
}

export function getLiveQuizResponseTrackingKey({
  liveQuizId,
  instanceId,
  status,
}: {
  liveQuizId: string
  instanceId: string | number
  status: LiveQuizResponseTrackingStatus
}): string {
  return `lq:${liveQuizId}:i:${instanceId}:responses:${status}`
}
