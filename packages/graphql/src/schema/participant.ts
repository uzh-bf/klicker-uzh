import * as DB from '@klicker-uzh/prisma/client'
import {
  type AvatarSettingsInput as AvatarSettingsInputType,
  type AvatarSettings as AvatarSettingsType,
  type SubscriptionKeysInput as SubscriptionKeysInputType,
  type SubscriptionObjectInput as SubscriptionObjectInputType,
} from '@klicker-uzh/types'
import { levelFromXp } from '@klicker-uzh/util'
import builder from '../builder.js'
import {
  getStudyStreakResponsesToday,
  QUALIFIED_RESPONSES_PER_DAY,
  zurichDate,
} from '../services/studyStreak.js'
import {
  type IAchievement,
  type IParticipantAchievementInstance,
  AchievementRef,
  ParticipantAchievementInstanceRef,
} from './achievement.js'
import {
  type ICourse,
  type IGroupLeaderboardEntry,
  type ILeaderboardEntry,
  type ILeaderboardStatistics,
  CourseRef,
  GroupLeaderboardEntry,
  LeaderboardEntryRef,
  LeaderboardStatistics,
} from './course.js'
import {
  type IGroupActivityInstance,
  GroupActivityInstanceRef,
} from './groupActivity.js'
import { LocaleType, UserRole } from './user.js'

export const AvatarSettingsInputRef = builder.inputRef<AvatarSettingsInputType>(
  'AvatarSettingsInput'
)
export const AvatarSettingsInput = AvatarSettingsInputRef.implement({
  fields: (t) => ({
    skinTone: t.string({ required: true }),
    eyes: t.string({ required: true }),
    mouth: t.string({ required: true }),
    hair: t.string({ required: true }),
    accessory: t.string({ required: true }),
    hairColor: t.string({ required: true }),
    clothing: t.string({ required: true }),
    clothingColor: t.string({ required: true }),
    facialHair: t.string({ required: true }),
  }),
})

export const SubscriptionKeysInputRef =
  builder.inputRef<SubscriptionKeysInputType>('SubscriptionKeysInput')
export const SubscriptionKeysInput = SubscriptionKeysInputRef.implement({
  fields: (t) => ({
    p256dh: t.string({ required: true }),
    auth: t.string({ required: true }),
  }),
})

export const SubscriptionObjectInputRef =
  builder.inputRef<SubscriptionObjectInputType>('SubscriptionObjectInput')
export const SubscriptionObjectInput = SubscriptionObjectInputRef.implement({
  fields: (t) => ({
    endpoint: t.string({ required: true }),
    expirationTime: t.int({ required: false }),
    keys: t.field({
      type: SubscriptionKeysInput,
      required: true,
    }),
  }),
})

export interface ILevel extends DB.Level {
  nextLevel?: ILevel | null
}
export const LevelRef = builder.objectRef<ILevel>('Level')
export const Level = LevelRef.implement({
  fields: (t) => ({
    id: t.exposeInt('id'),
    index: t.exposeInt('index'),
    requiredXp: t.exposeInt('requiredXp'),
    name: t.exposeString('name', { nullable: true }),
    avatar: t.exposeString('avatar', { nullable: true }),
    nextLevel: t.expose('nextLevel', {
      type: LevelRef,
      nullable: true,
    }),
  }),
})

export const AvatarSettingsRef =
  builder.objectRef<AvatarSettingsType>('AvatarSettings')
export const AvatarSettings = AvatarSettingsRef.implement({
  fields: (t) => ({
    skinTone: t.exposeString('skinTone'),
    eyes: t.exposeString('eyes'),
    mouth: t.exposeString('mouth'),
    hair: t.exposeString('hair'),
    facialHair: t.exposeString('facialHair'),
    accessory: t.exposeString('accessory'),
    hairColor: t.exposeString('hairColor'),
    clothing: t.exposeString('clothing'),
    clothingColor: t.exposeString('clothingColor'),
  }),
})

export interface IParticipant
  extends Omit<DB.Participant, 'password' | 'xp' | 'locale'> {
  role?: DB.UserRole
  scopeQuizId?: string | null // live quiz id for which the temporary participant is scoped -> null for regular participants
  isCourseParticipant?: boolean | null // if a live quiz id is provided, flag if the user is participant of the course
  isCourseParticipationActive?: boolean | null // if a live quiz id is provided, flag if the user is active in the course (on course leaderboard)
  institutionalEmail?: string | null // UZH email (if available)
  xp?: number | null
  locale?: DB.Locale | null
  rank?: number
  score?: number
  isSelf?: boolean
  achievements?: IParticipantAchievementInstance[]
  participantGroups?: IParticipantGroup[]
  level?: number
  levelData?: ILevel
}
export const ParticipantRef = builder.objectRef<IParticipant>('Participant')
export const Participant = ParticipantRef.implement({
  fields: (t) => ({
    id: t.exposeID('id'),

    role: t.expose('role', { type: UserRole, nullable: true }),
    scopeQuizId: t.exposeString('scopeQuizId', { nullable: true }),
    isCourseParticipant: t.exposeBoolean('isCourseParticipant', {
      nullable: true,
    }),
    isCourseParticipationActive: t.exposeBoolean(
      'isCourseParticipationActive',
      {
        nullable: true,
      }
    ),

    locale: t.expose('locale', { type: LocaleType, nullable: true }),
    email: t.exposeString('email', { nullable: true }),
    institutionalEmail: t.exposeString('institutionalEmail', {
      nullable: true,
    }),
    username: t.exposeString('username', { nullable: false }),
    isActive: t.exposeBoolean('isActive', { nullable: false }),
    isProfilePublic: t.exposeBoolean('isProfilePublic', { nullable: true }),
    avatar: t.exposeString('avatar', { nullable: true }),
    avatarSettings: t.expose('avatarSettings', {
      type: AvatarSettings,
      nullable: true,
    }),

    xp: t.exposeInt('xp', { nullable: true }),
    level: t.int({
      nullable: true,
      resolve: (participant) => levelFromXp(participant.xp ?? 0),
    }),
    levelData: t.field({
      type: LevelRef,
      nullable: true,
      resolve: (participant, _, ctx) => {
        return ctx.prisma.level.findUnique({
          where: {
            index: levelFromXp(participant.xp ?? 0),
          },
          include: {
            nextLevel: true,
          },
        })
      },
    }),

    participantGroups: t.expose('participantGroups', {
      type: [ParticipantGroupRef],
      nullable: true,
    }),
    achievements: t.expose('achievements', {
      type: [ParticipantAchievementInstanceRef],
      nullable: true,
    }),

    lastLoginAt: t.expose('lastLoginAt', { type: 'Date', nullable: true }),

    rank: t.exposeInt('rank', { nullable: true }),
    score: t.exposeFloat('score', { nullable: true }),
    isSelf: t.exposeBoolean('isSelf', { nullable: true }),
  }),
})

export interface IParticipantGroup extends DB.ParticipantGroup {
  score?: number
  participants?: IParticipant[]
  messages?: IGroupMessage[] | null
}
export const ParticipantGroupRef =
  builder.objectRef<IParticipantGroup>('ParticipantGroup')
export const ParticipantGroup = ParticipantGroupRef.implement({
  fields: (t) => ({
    id: t.exposeID('id'),

    participants: t.expose('participants', {
      type: [ParticipantRef],
      nullable: true,
    }),

    messages: t.expose('messages', {
      type: [GroupMessageRef],
      nullable: true,
    }),

    name: t.exposeString('name'),
    code: t.exposeInt('code'),

    averageMemberScore: t.exposeInt('averageMemberScore'),
    groupActivityScore: t.exposeInt('groupActivityScore'),
    score: t.exposeFloat('score', { nullable: true }),
  }),
})

export interface IGroupMessage extends DB.GroupMessage {
  group?: IParticipantGroup
  participant: IParticipant
}
export const GroupMessageRef = builder.objectRef<IGroupMessage>('GroupMessage')
export const GroupMessage = GroupMessageRef.implement({
  fields: (t) => ({
    id: t.exposeInt('id'),
    content: t.exposeString('content'),
    group: t.expose('group', {
      type: ParticipantGroupRef,
      nullable: true,
    }),
    participant: t.expose('participant', {
      type: ParticipantRef,
    }),
    createdAt: t.expose('createdAt', { type: 'Date' }),
    updatedAt: t.expose('updatedAt', { type: 'Date' }),
  }),
})

export interface IGroupAssignmentPoolEntryRef
  extends DB.GroupAssignmentPoolEntry {
  participant?: IParticipant
}
export const GroupAssignmentPoolEntryRef =
  builder.objectRef<IGroupAssignmentPoolEntryRef>('GroupAssignmentPoolEntry')
export const GroupAssignmentPoolEntry = GroupAssignmentPoolEntryRef.implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    participantId: t.exposeID('participantId'),
    courseId: t.exposeID('courseId'),

    participant: t.expose('participant', {
      type: ParticipantRef,
      nullable: true,
    }),
  }),
})

export interface IParticipation extends DB.Participation {
  subscriptions?: DB.PushSubscription[]
  course?: ICourse
  participant?: IParticipant
  studyStreakResponsesRemainingToday?: number | null
}

function canViewStudyStreak(
  participation: IParticipation,
  user?: { role: DB.UserRole; sub: string }
): boolean {
  return (
    user?.role === DB.UserRole.PARTICIPANT &&
    user.sub === participation.participantId
  )
}

export const ParticipationRef =
  builder.objectRef<IParticipation>('Participation')
export const Participation = ParticipationRef.implement({
  fields: (t) => ({
    id: t.exposeInt('id'),

    isActive: t.exposeBoolean('isActive'),

    // self-only private Study streak status (Europe/Zurich weekdays,
    // PracticeQuiz and MicroLearning; see gamification ADR)
    studyStreakCurrent: t.int({
      nullable: true,
      resolve: (parent, _, ctx) =>
        canViewStudyStreak(parent, ctx.user)
          ? parent.studyStreakCurrent
          : null,
    }),
    studyStreakLongest: t.int({
      nullable: true,
      resolve: (parent, _, ctx) =>
        canViewStudyStreak(parent, ctx.user)
          ? parent.studyStreakLongest
          : null,
    }),
    studyStreakFreezeBalance: t.int({
      nullable: true,
      resolve: (parent, _, ctx) =>
        canViewStudyStreak(parent, ctx.user)
          ? parent.studyStreakFreezeBalance
          : null,
    }),
    studyStreakResponsesRemainingToday: t.int({
      nullable: true,
      resolve: async (parent, _, ctx) => {
        if (!canViewStudyStreak(parent, ctx.user)) return null

        if (parent.studyStreakResponsesRemainingToday !== undefined) {
          return parent.studyStreakResponsesRemainingToday
        }

        const responsesToday = await getStudyStreakResponsesToday(
          { prisma: ctx.prisma },
          {
            courseId: parent.courseId,
            participantId: parent.participantId,
          }
        )

        return responsesToday === null
          ? null
          : Math.max(0, QUALIFIED_RESPONSES_PER_DAY - responsesToday)
      },
    }),
    studyStreakQualifiedToday: t.boolean({
      nullable: true,
      resolve: (parent, _, ctx) => {
        if (!canViewStudyStreak(parent, ctx.user)) return null
        if (!parent.studyStreakLastQualifiedDate) return false
        return (
          zurichDate(parent.studyStreakLastQualifiedDate) ===
          zurichDate(new Date())
        )
      },
    }),

    subscriptions: t.expose('subscriptions', {
      type: [PushSubscriptionRef],
      nullable: true,
    }),

    completedMicroLearnings: t.exposeStringList('completedMicroLearnings'),

    course: t.expose('course', {
      type: CourseRef,
      nullable: true,
    }),

    participant: t.expose('participant', {
      type: ParticipantRef,
      nullable: true,
    }),
  }),
})

export const PushSubscriptionRef =
  builder.objectRef<DB.PushSubscription>('PushSubscription')
export const PushSubscription = PushSubscriptionRef.implement({
  fields: (t) => ({
    id: t.exposeInt('id'),

    endpoint: t.exposeString('endpoint', { nullable: false }),
  }),
})

export interface IParticipantLearningData {
  id: string
  participantToken?: string
  participant?: IParticipant | null
  participation?: IParticipation | null
  course?: ICourse | null
  groupLeaderboard?: IGroupLeaderboardEntry[]
  groupLeaderboardStatistics?: ILeaderboardStatistics
  groupActivityInstances?: IGroupActivityInstance[]
  inRandomGroupPool?: boolean
}
export const ParticipantLearningDataRef =
  builder.objectRef<IParticipantLearningData>('ParticipantLearningData')
export const ParticipantLearningData = ParticipantLearningDataRef.implement({
  fields: (t) => ({
    id: t.exposeString('id'),

    participantToken: t.exposeString('participantToken', { nullable: true }),

    participant: t.expose('participant', {
      type: ParticipantRef,
      nullable: true,
    }),

    participation: t.expose('participation', {
      type: ParticipationRef,
      nullable: true,
    }),

    course: t.expose('course', {
      type: CourseRef,
      nullable: true,
    }),

    groupLeaderboard: t.expose('groupLeaderboard', {
      type: [GroupLeaderboardEntry],
      nullable: true,
    }),

    groupLeaderboardStatistics: t.expose('groupLeaderboardStatistics', {
      type: LeaderboardStatistics,
      nullable: true,
    }),

    groupActivityInstances: t.expose('groupActivityInstances', {
      type: [GroupActivityInstanceRef],
      nullable: true,
    }),

    inRandomGroupPool: t.exposeBoolean('inRandomGroupPool', { nullable: true }),
  }),
})

export interface IStudentCourseLeaderboard {
  leaderboard: ILeaderboardEntry[]
  leaderboardStatistics: ILeaderboardStatistics
}
export const StudentCourseLeaderboardRef =
  builder.objectRef<IStudentCourseLeaderboard>('StudentCourseLeaderboard')
export const StudentCourseLeaderboard = StudentCourseLeaderboardRef.implement({
  fields: (t) => ({
    leaderboard: t.expose('leaderboard', {
      type: [LeaderboardEntryRef],
    }),

    leaderboardStatistics: t.expose('leaderboardStatistics', {
      type: LeaderboardStatistics,
    }),
  }),
})

export interface ILeaveCourseParticipation {
  id: string
  participation: IParticipation
}
export const LeaveCourseParticipationRef =
  builder.objectRef<ILeaveCourseParticipation>('LeaveCourseParticipation')
export const LeaveCourseParticipation = LeaveCourseParticipationRef.implement({
  fields: (t) => ({
    id: t.exposeString('id'),

    participation: t.expose('participation', {
      type: ParticipationRef,
    }),
  }),
})

export interface IParticipantWithAchievements {
  participant: IParticipant
  achievements: IAchievement[]
}
export const ParticipantWithAchievementsRef =
  builder.objectRef<IParticipantWithAchievements>('ParticipantWithAchievements')
export const ParticipantWithAchievements =
  ParticipantWithAchievementsRef.implement({
    fields: (t) => ({
      participant: t.expose('participant', {
        type: ParticipantRef,
      }),
      achievements: t.expose('achievements', {
        type: [AchievementRef],
      }),
    }),
  })

export interface IParticipantTokenData {
  participantToken?: string
  participant?: IParticipant
}

export const ParticipantTokenDataRef = builder.objectRef<IParticipantTokenData>(
  'ParticipantTokenData'
)
export const ParticipantTokenData = ParticipantTokenDataRef.implement({
  fields: (t) => ({
    participantToken: t.exposeString('participantToken', { nullable: true }),
    participant: t.field({
      type: ParticipantRef,
      resolve: (data) => data.participant,
      nullable: true,
    }),
  }),
})
