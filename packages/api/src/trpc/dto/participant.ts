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
