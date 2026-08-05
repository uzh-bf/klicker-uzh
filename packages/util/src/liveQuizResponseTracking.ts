export type LiveQuizResponseTrackingStatus = 'received' | 'processed'

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
