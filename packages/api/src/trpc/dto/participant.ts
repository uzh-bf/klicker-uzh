import type * as DB from '@klicker-uzh/prisma/client'
import { UserRole, type Prisma } from '@klicker-uzh/prisma/client'
import { levelFromXp } from '@klicker-uzh/util'

type AvatarSettings = {
  skinTone: string
  eyes: string
  mouth: string
  hair: string
  facialHair: string
  accessory: string
  hairColor: string
  clothing: string
  clothingColor: string
}

type LevelSource = Pick<
  DB.Level,
  'avatar' | 'id' | 'index' | 'name' | 'requiredXp'
> & {
  nextLevel?: Pick<
    DB.Level,
    'avatar' | 'id' | 'index' | 'name' | 'requiredXp'
  > | null
}

type ParticipantSelfSource = Pick<
  DB.Participant,
  | 'avatar'
  | 'avatarSettings'
  | 'email'
  | 'id'
  | 'isActive'
  | 'isProfilePublic'
  | 'locale'
  | 'username'
  | 'xp'
>

type PublicParticipantAchievementSource = Pick<
  DB.ParticipantAchievementInstance,
  'achievedAt' | 'achievedCount' | 'id'
> & {
  achievement: Pick<
    DB.Achievement,
    | 'descriptionDE'
    | 'descriptionEN'
    | 'icon'
    | 'iconColor'
    | 'id'
    | 'nameDE'
    | 'nameEN'
  >
}

type PublicParticipantProfileSource = Pick<
  DB.Participant,
  'avatar' | 'avatarSettings' | 'id' | 'isProfilePublic' | 'username' | 'xp'
> & {
  achievements?: PublicParticipantAchievementSource[] | null
  isSelf?: boolean
}

type TemporaryParticipantSelfSource = Pick<
  DB.TemporaryLeaderboardEntry,
  'avatar' | 'quizId' | 'username'
>

type ParticipantCourseSource = Pick<
  DB.Course,
  'description' | 'displayName' | 'id' | 'isArchived'
>

type PracticeCourseSource = Pick<DB.Course, 'displayName' | 'id'>

type ParticipantParticipationSource = Pick<
  DB.Participation,
  'completedMicroLearnings' | 'id'
> & {
  subscriptions: Pick<DB.PushSubscription, 'endpoint' | 'id'>[]
  course: Pick<
    DB.Course,
    | 'description'
    | 'displayName'
    | 'endDate'
    | 'id'
    | 'isGamificationEnabled'
    | 'startDate'
  > & {
    microLearnings: Pick<
      DB.MicroLearning,
      'displayName' | 'id' | 'scheduledEndAt' | 'scheduledStartAt'
    >[]
    liveQuizzes: Pick<DB.LiveQuiz, 'displayName' | 'id'>[]
  }
}

type CourseAwardSource = Pick<
  DB.AwardEntry,
  'description' | 'displayName' | 'id' | 'order' | 'type'
> & {
  participant: Pick<DB.Participant, 'avatar' | 'id' | 'username'> | null
  participantGroup: Pick<DB.ParticipantGroup, 'id' | 'name'> | null
}

type CourseOverviewCourseSource = Pick<
  DB.Course,
  | 'color'
  | 'description'
  | 'displayName'
  | 'groupDeadlineDate'
  | 'id'
  | 'isAssessmentEnabled'
  | 'isGamificationEnabled'
  | 'isGroupCreationEnabled'
  | 'maxGroupSize'
  | 'preferredGroupSize'
> & {
  awards?: CourseAwardSource[] | null
}

type CourseOverviewParticipantSource = Pick<
  DB.Participant,
  'avatar' | 'id' | 'username' | 'xp'
> & {
  participantGroups?: Pick<DB.ParticipantGroup, 'id'>[] | null
}

type CourseOverviewGroupLeaderboardSource = Pick<
  DB.ParticipantGroup,
  'id' | 'name'
> & {
  isMember?: boolean
  rank: number
  score: number
}

type LeaderboardStatisticsSource = {
  averageScore: number
  participantCount: number
}

type CourseOverviewSource = {
  course: CourseOverviewCourseSource
  groupLeaderboard?: CourseOverviewGroupLeaderboardSource[] | null
  groupLeaderboardStatistics?: LeaderboardStatisticsSource | null
  id: string
  inRandomGroupPool?: boolean | null
  participant: CourseOverviewParticipantSource | null
  participation: Pick<DB.Participation, 'id' | 'isActive'> | null
}

type ParticipantGroupSource = Pick<
  DB.ParticipantGroup,
  'averageMemberScore' | 'code' | 'groupActivityScore' | 'id' | 'name'
> & {
  messages?: (Pick<
    DB.GroupMessage,
    'content' | 'createdAt' | 'id' | 'updatedAt'
  > & {
    participant: Pick<DB.Participant, 'avatar' | 'id' | 'username'>
  })[]
  participants?: (Pick<DB.Participant, 'avatar' | 'id' | 'username' | 'xp'> & {
    isSelf: boolean
    rank: number
    score: number
  })[]
  score: number
}

type CourseLeaderboardEntrySource = {
  avatar: string | null
  id: number
  isSelf?: boolean
  level?: number
  participantId: string
  rank: number
  score: number
  username: string
}

type CourseLeaderboardSource = {
  leaderboard: CourseLeaderboardEntrySource[]
  leaderboardStatistics: LeaderboardStatisticsSource
}

type CourseGroupActivitySource = Pick<
  DB.GroupActivity,
  | 'description'
  | 'displayName'
  | 'id'
  | 'scheduledEndAt'
  | 'scheduledStartAt'
  | 'status'
>

type GroupActivityInstanceSource = Pick<
  DB.GroupActivityInstance,
  | 'decisionsSubmittedAt'
  | 'groupActivityId'
  | 'id'
  | 'results'
  | 'resultsComputedAt'
>

function toAvatarSettings(settings: Prisma.JsonValue | null) {
  return settings as AvatarSettings | null
}

function toLevelData(levelData: LevelSource | null) {
  if (!levelData) return null

  return {
    id: levelData.id,
    index: levelData.index,
    name: levelData.name,
    avatar: levelData.avatar,
    requiredXp: levelData.requiredXp,
    nextLevel: levelData.nextLevel
      ? {
          id: levelData.nextLevel.id,
          index: levelData.nextLevel.index,
          name: levelData.nextLevel.name,
          avatar: levelData.nextLevel.avatar,
          requiredXp: levelData.nextLevel.requiredXp,
        }
      : null,
  }
}

export function toParticipantSelf(
  participant: ParticipantSelfSource,
  {
    institutionalEmail,
    isCourseParticipant,
    isCourseParticipationActive,
    levelData,
  }: {
    institutionalEmail: string | null
    isCourseParticipant: boolean
    isCourseParticipationActive: boolean
    levelData: LevelSource | null
  }
) {
  return {
    id: participant.id,
    role: UserRole.PARTICIPANT,
    scopeQuizId: null,
    isCourseParticipant,
    isCourseParticipationActive,
    email: participant.email,
    institutionalEmail,
    username: participant.username,
    locale: participant.locale,
    avatar: participant.avatar,
    avatarSettings: toAvatarSettings(participant.avatarSettings),
    isActive: participant.isActive,
    isProfilePublic: participant.isProfilePublic,
    xp: participant.xp,
    level: levelFromXp(participant.xp ?? 0),
    levelData: toLevelData(levelData),
  }
}

export function toTemporaryParticipantSelf(
  participant: TemporaryParticipantSelfSource,
  { id, levelData }: { id: string; levelData: LevelSource | null }
) {
  return {
    id,
    role: UserRole.TEMPORARY_PARTICIPANT,
    scopeQuizId: participant.quizId,
    isCourseParticipant: false,
    isCourseParticipationActive: false,
    email: null,
    institutionalEmail: null,
    username: participant.username,
    locale: null,
    avatar: participant.avatar,
    avatarSettings: null,
    isActive: true,
    isProfilePublic: true,
    xp: null,
    level: levelFromXp(0),
    levelData: toLevelData(levelData),
  }
}

export function toPublicParticipantProfile(
  participant: PublicParticipantProfileSource,
  { levelData }: { levelData: LevelSource | null }
) {
  return {
    id: participant.id,
    username: participant.username,
    avatar: participant.avatar,
    avatarSettings: toAvatarSettings(participant.avatarSettings),
    isProfilePublic: participant.isProfilePublic,
    isSelf: participant.isSelf ?? null,
    level: levelFromXp(participant.xp ?? 0),
    levelData: toLevelData(levelData),
    xp: participant.xp,
    achievements:
      participant.achievements?.map((instance) => ({
        id: instance.id,
        achievedAt: instance.achievedAt,
        achievedCount: instance.achievedCount,
        achievement: {
          id: instance.achievement.id,
          nameDE: instance.achievement.nameDE,
          nameEN: instance.achievement.nameEN,
          descriptionDE: instance.achievement.descriptionDE,
          descriptionEN: instance.achievement.descriptionEN,
          icon: instance.achievement.icon,
          iconColor: instance.achievement.iconColor,
        },
      })) ?? [],
  }
}

export function toParticipantCourse(course: ParticipantCourseSource) {
  return {
    id: course.id,
    isArchived: course.isArchived,
    displayName: course.displayName,
    description: course.description,
  }
}

export function toPracticeCourse(course: PracticeCourseSource) {
  return {
    id: course.id,
    displayName: course.displayName,
  }
}

export function toParticipantParticipation(
  participation: ParticipantParticipationSource
) {
  return {
    id: participation.id,
    completedMicroLearnings: participation.completedMicroLearnings,
    subscriptions: participation.subscriptions.map((subscription) => ({
      id: subscription.id,
      endpoint: subscription.endpoint,
    })),
    course: {
      id: participation.course.id,
      displayName: participation.course.displayName,
      startDate: participation.course.startDate,
      endDate: participation.course.endDate,
      description: participation.course.description,
      isGamificationEnabled: participation.course.isGamificationEnabled,
      microLearnings: participation.course.microLearnings.map(
        (microLearning) => ({
          id: microLearning.id,
          displayName: microLearning.displayName,
          scheduledStartAt: microLearning.scheduledStartAt,
          scheduledEndAt: microLearning.scheduledEndAt,
        })
      ),
      liveQuizzes: participation.course.liveQuizzes.map((liveQuiz) => ({
        id: liveQuiz.id,
        displayName: liveQuiz.displayName,
      })),
    },
  }
}

function toCourseAward(award: CourseAwardSource) {
  return {
    id: award.id,
    order: award.order,
    type: award.type,
    displayName: award.displayName,
    description: award.description,
    participant: award.participant
      ? {
          id: award.participant.id,
          username: award.participant.username,
          avatar: award.participant.avatar,
        }
      : null,
    participantGroup: award.participantGroup
      ? {
          id: award.participantGroup.id,
          name: award.participantGroup.name,
        }
      : null,
  }
}

function toCourseOverviewCourse(course: CourseOverviewCourseSource) {
  return {
    id: course.id,
    displayName: course.displayName,
    color: course.color,
    description: course.description,
    isGamificationEnabled: course.isGamificationEnabled,
    isAssessmentEnabled: course.isAssessmentEnabled,
    groupDeadlineDate: course.groupDeadlineDate,
    isGroupDeadlinePassed: Date.now() > course.groupDeadlineDate.getTime(),
    isGroupCreationEnabled: course.isGroupCreationEnabled,
    maxGroupSize: course.maxGroupSize,
    preferredGroupSize: course.preferredGroupSize,
    awards: course.awards?.map(toCourseAward) ?? null,
  }
}

function toCourseOverviewParticipant(
  participant: CourseOverviewParticipantSource | null
) {
  if (!participant) return null

  return {
    id: participant.id,
    avatar: participant.avatar,
    username: participant.username,
    xp: participant.xp,
    level: levelFromXp(participant.xp),
    participantGroups:
      participant.participantGroups?.map((group) => ({ id: group.id })) ?? [],
  }
}

export function toCourseOverview(overview: CourseOverviewSource | null) {
  if (!overview) return null

  return {
    id: overview.id,
    inRandomGroupPool: overview.inRandomGroupPool ?? null,
    participant: toCourseOverviewParticipant(overview.participant),
    participation: overview.participation
      ? {
          id: overview.participation.id,
          isActive: overview.participation.isActive,
        }
      : null,
    course: toCourseOverviewCourse(overview.course),
    groupLeaderboard:
      overview.groupLeaderboard?.map((group) => ({
        id: group.id,
        name: group.name,
        score: group.score,
        rank: group.rank,
        isMember: group.isMember ?? false,
      })) ?? null,
    groupLeaderboardStatistics: overview.groupLeaderboardStatistics ?? null,
  }
}

export function toParticipantGroup(group: ParticipantGroupSource) {
  return {
    id: group.id,
    name: group.name,
    code: group.code,
    averageMemberScore: group.averageMemberScore,
    groupActivityScore: group.groupActivityScore,
    score: group.score,
    messages:
      group.messages?.map((message) => ({
        id: message.id,
        content: message.content,
        createdAt: message.createdAt,
        updatedAt: message.updatedAt,
        participant: {
          id: message.participant.id,
          username: message.participant.username,
          avatar: message.participant.avatar,
        },
      })) ?? [],
    participants:
      group.participants?.map((participant) => ({
        id: participant.id,
        username: participant.username,
        avatar: participant.avatar,
        score: participant.score,
        isSelf: participant.isSelf,
        level: levelFromXp(participant.xp),
        rank: participant.rank,
      })) ?? [],
  }
}

export function toCourseLeaderboard(leaderboard: CourseLeaderboardSource) {
  return {
    leaderboard: leaderboard.leaderboard.map((entry) => ({
      id: entry.id,
      participantId: entry.participantId,
      username: entry.username,
      avatar: entry.avatar,
      score: entry.score,
      isSelf: entry.isSelf,
      rank: entry.rank,
      level: entry.level,
    })),
    leaderboardStatistics: leaderboard.leaderboardStatistics,
  }
}

export function toCourseGroupActivity(activity: CourseGroupActivitySource) {
  return {
    id: activity.id,
    displayName: activity.displayName,
    status: activity.status,
    description: activity.description,
    scheduledStartAt: activity.scheduledStartAt,
    scheduledEndAt: activity.scheduledEndAt,
  }
}

export function toGroupActivityInstance(instance: GroupActivityInstanceSource) {
  return {
    id: instance.id,
    decisionsSubmittedAt: instance.decisionsSubmittedAt,
    resultsComputedAt: instance.resultsComputedAt,
    results: instance.results,
    groupActivityId: instance.groupActivityId,
  }
}
