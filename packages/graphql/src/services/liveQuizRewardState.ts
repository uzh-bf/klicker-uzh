import * as DB from '@klicker-uzh/prisma/client'
import {
  isoWeekStart,
  rewardPairKey,
  timelineKey,
  utcDate,
} from './liveQuizRewardUtils.js'
import type {
  LiveQuizRewardEntryEvidence,
  ValidatedLiveQuizRewardLedger,
} from './liveQuizRewardValidation.js'

export type LiveQuizRewardStateIssue =
  | 'PARTICIPANT_XP'
  | 'COURSE_POINTS'
  | 'TIMELINE'
  | 'ACHIEVEMENT'

interface ParticipantRewardState {
  id: string
  xp: number
}

interface CourseLeaderboardRewardState {
  id: number
  participantId: string
  courseId: string | null
  score: number
}

interface TimelineRewardState {
  id: number
  participationId: number
  courseId: string | null
  timestamp: Date
  type: DB.TimelineEntryType
  collectedPoints: number
  collectedXp: number
}

interface AchievementRewardState {
  id: number
  participantId: string
  achievementId: number
  achievedCount: number
}

export async function loadLiveQuizRewardCurrentState<
  Entry extends LiveQuizRewardEntryEvidence,
>({
  ledger,
  prisma,
  dailyTimelineDate,
}: {
  ledger: ValidatedLiveQuizRewardLedger<Entry>
  prisma: DB.PrismaClient | DB.Prisma.TransactionClient
  dailyTimelineDate: 'EXACT' | 'UTC_DAY'
}) {
  const getDailyTimestamp = (date: Date) =>
    dailyTimelineDate === 'UTC_DAY' ? utcDate(date) : date
  const timelineKeys = ledger.timelineEntries.flatMap((entry) => [
    {
      participationId: entry.participationId,
      courseId: entry.courseId,
      timestamp: getDailyTimestamp(entry.timelineDate),
      type: DB.TimelineEntryType.DAILY,
    },
    {
      participationId: entry.participationId,
      courseId: entry.courseId,
      timestamp: isoWeekStart(entry.timelineDate),
      type: DB.TimelineEntryType.WEEKLY,
    },
  ])
  const [participants, courseLeaderboards, timelines, achievements]: [
    ParticipantRewardState[],
    CourseLeaderboardRewardState[],
    TimelineRewardState[],
    AchievementRewardState[],
  ] = await Promise.all([
    ledger.entries.length > 0
      ? prisma.participant.findMany({
          where: {
            id: { in: ledger.entries.map((entry) => entry.participantId) },
          },
          select: { id: true, xp: true },
        })
      : Promise.resolve([]),
    ledger.courseEntries.length > 0
      ? prisma.leaderboardEntry.findMany({
          where: {
            type: DB.LeaderboardType.COURSE,
            OR: ledger.courseEntries.map((entry) => ({
              participantId: entry.participantId,
              courseId: entry.courseId,
            })),
          },
        })
      : Promise.resolve([]),
    timelineKeys.length > 0
      ? prisma.timelineEntry.findMany({
          where: { OR: timelineKeys },
        })
      : Promise.resolve([]),
    ledger.achievementEntries.length > 0
      ? prisma.participantAchievementInstance.findMany({
          where: {
            OR: ledger.achievementEntries.map((entry) => ({
              participantId: entry.participantId,
              achievementId: entry.achievementId,
            })),
          },
        })
      : Promise.resolve([]),
  ])

  const participantById = new Map(
    participants.map((participant) => [participant.id, participant] as const)
  )
  const courseLeaderboardByParticipant = new Map(
    courseLeaderboards.flatMap((leaderboard) =>
      leaderboard.courseId === null
        ? []
        : [
            [
              rewardPairKey(leaderboard.participantId, leaderboard.courseId),
              leaderboard,
            ] as const,
          ]
    )
  )
  const timelineByKey = new Map(
    timelines.flatMap((entry) =>
      entry.courseId === null
        ? []
        : [
            [
              timelineKey({
                participationId: entry.participationId,
                courseId: entry.courseId,
                timestamp: entry.timestamp,
                type: entry.type,
              }),
              entry,
            ] as const,
          ]
    )
  )
  const achievementByParticipant = new Map(
    achievements.map(
      (achievement) =>
        [
          rewardPairKey(achievement.participantId, achievement.achievementId),
          achievement,
        ] as const
    )
  )

  let issue: LiveQuizRewardStateIssue | null = null
  for (const entry of ledger.entries) {
    const participant = participantById.get(entry.participantId)
    if (!participant || participant.xp < entry.participantXpAwarded) {
      issue = 'PARTICIPANT_XP'
      break
    }
  }
  if (issue === null) {
    for (const entry of ledger.courseEntries) {
      const leaderboard = courseLeaderboardByParticipant.get(
        rewardPairKey(entry.participantId, entry.courseId)
      )
      if (!leaderboard || leaderboard.score < entry.coursePointsAwarded) {
        issue = 'COURSE_POINTS'
        break
      }
    }
  }
  if (issue === null) {
    for (const entry of ledger.timelineEntries) {
      const daily = timelineByKey.get(
        timelineKey({
          participationId: entry.participationId,
          courseId: entry.courseId,
          timestamp: getDailyTimestamp(entry.timelineDate),
          type: DB.TimelineEntryType.DAILY,
        })
      )
      const weekly = timelineByKey.get(
        timelineKey({
          participationId: entry.participationId,
          courseId: entry.courseId,
          timestamp: isoWeekStart(entry.timelineDate),
          type: DB.TimelineEntryType.WEEKLY,
        })
      )
      const timeline = daily ?? weekly
      if (
        timeline &&
        (timeline.collectedPoints < entry.timelinePointsAwarded ||
          timeline.collectedXp < entry.timelineXpAwarded)
      ) {
        issue = 'TIMELINE'
        break
      }
    }
  }
  if (issue === null) {
    for (const entry of ledger.achievementEntries) {
      const achievement = achievementByParticipant.get(
        rewardPairKey(entry.participantId, entry.achievementId)
      )
      if (
        !achievement ||
        achievement.achievedCount < entry.achievementCountAwarded
      ) {
        issue = 'ACHIEVEMENT'
        break
      }
    }
  }

  return {
    issue,
    participantById,
    courseLeaderboardByParticipant,
    timelineByKey,
    achievementByParticipant,
  }
}
