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
