import type * as DB from '@klicker-uzh/prisma/client'

export interface RankAchievementReward {
  id: number
  rewardedPoints: number | null
  rewardedXP: number | null
}

export interface LiveQuizRewardParticipant {
  participantId: string
  participationId: number | null
  courseId: string | null
  hasActiveParticipation: boolean
  isCourseGamificationEnabled: boolean
  score?: number
  xp?: number
}

export interface LiveQuizRewardDelta {
  participantId: string
  participationId: number | null
  courseId: string | null
  coursePointsAwarded: number
  participantXpAwarded: number
  timelineDate: Date | null
  timelinePointsAwarded: number
  timelineXpAwarded: number
  achievementId: number | null
  achievementCountAwarded: number
}

export interface LiveQuizRewardPlan {
  endedAt: Date
  entries: LiveQuizRewardDelta[]
  isLegacyReconstructed: boolean
}

export interface RankAchievementRewards {
  first: RankAchievementReward
  second: RankAchievementReward
  third: RankAchievementReward
}

interface CalculateLiveQuizRewardPlanBaseInput {
  participants: LiveQuizRewardParticipant[]
  endedAt: Date
  isLegacyReconstructed?: boolean
}

export type CalculateLiveQuizRewardPlanInput =
  CalculateLiveQuizRewardPlanBaseInput &
    (
      | {
          awardAchievements: true
          achievements: RankAchievementRewards
        }
      | {
          awardAchievements: false
          achievements?: never
        }
    )

export interface ApplyRegularLiveQuizRewardPlanInput {
  liveQuizId: string
  plan: LiveQuizRewardPlan
  tx: DB.Prisma.TransactionClient
}

export type PersistLiveQuizRewardRunInput = ApplyRegularLiveQuizRewardPlanInput
