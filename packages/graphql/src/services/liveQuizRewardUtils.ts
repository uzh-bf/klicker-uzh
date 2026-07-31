import * as DB from '@klicker-uzh/prisma/client'

export function utcDate(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  )
}

export function isoWeekStart(date: Date): Date {
  const day = utcDate(date)
  const daysSinceMonday = (day.getUTCDay() + 6) % 7
  day.setUTCDate(day.getUTCDate() - daysSinceMonday)
  return day
}

export function rewardPairKey(
  participantId: string,
  relatedId: string | number
) {
  return `${participantId}:${relatedId}`
}

export function timelineKey({
  participationId,
  courseId,
  timestamp,
  type,
}: {
  participationId: number
  courseId: string
  timestamp: Date
  type: DB.TimelineEntryType
}) {
  return `${participationId}:${courseId}:${utcDate(timestamp).toISOString()}:${type}`
}
