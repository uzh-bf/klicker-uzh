export type LiveQuizResponseTrackingStatus = 'received' | 'processed'

export const LIVE_QUIZ_RESPONSE_TRACKING_TTL_SECONDS = 60 * 60 * 24

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
