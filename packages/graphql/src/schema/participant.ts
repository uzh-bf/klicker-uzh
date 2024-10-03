import * as DB from '@klicker-uzh/prisma'
import { levelFromXp } from '@klicker-uzh/util/dist/pure.js'
import builder from '../builder.js'
import {
  AchievementRef,
  IAchievement,
  IParticipantAchievementInstance,
  ParticipantAchievementInstanceRef,
} from './achievement.js'
import type {
  ICourse,
  IGroupLeaderboardEntry,
  ILeaderboardEntry,
  ILeaderboardStatistics,
} from './course.js'
import {
  CourseRef,
  GroupLeaderboardEntry,
  LeaderboardEntryRef,
  LeaderboardStatistics,
} from './course.js'
import type { IGroupActivityInstance } from './groupActivity.js'
import { GroupActivityInstanceRef } from './groupActivity.js'
import { LocaleType } from './user.js'

export const AvatarSettingsInput = builder.inputType('AvatarSettingsInput', {
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

export const SubscriptionKeysInput = builder.inputType(
  'SubscriptionKeysInput',
  {
    fields: (t) => ({
      p256dh: t.string({ required: true }),
      auth: t.string({ required: true }),
    }),
  }
)

export const SubscriptionObjectInput = builder.inputType(
  'SubscriptionObjectInput',
  {
    fields: (t) => ({
      endpoint: t.string({ required: true }),
      expirationTime: t.int({ required: false }),
      keys: t.field({
        type: SubscriptionKeysInput,
        required: true,
      }),
    }),
  }
)

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

export interface IParticipant extends DB.Participant {
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

    locale: t.expose('locale', { type: LocaleType }),

    email: t.exposeString('email', { nullable: true }),
    username: t.exposeString('username', { nullable: false }),
    isActive: t.exposeBoolean('isActive', { nullable: false }),
    isProfilePublic: t.exposeBoolean('isProfilePublic', { nullable: true }),
    avatar: t.exposeString('avatar', { nullable: true }),
    avatarSettings: t.expose('avatarSettings', {
      type: 'Json',
      nullable: true,
    }),

    xp: t.exposeInt('xp'),
    level: t.int({
      nullable: true,
      resolve: (participant) => levelFromXp(participant.xp),
    }),
    levelData: t.field({
      type: LevelRef,
      nullable: true,
      resolve: (participant, _, ctx) => {
        return ctx.prisma.level.findUnique({
          where: {
            index: levelFromXp(participant.xp),
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
  participant?: IParticipant
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
      nullable: true,
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
}
export const ParticipationRef =
  builder.objectRef<IParticipation>('Participation')
export const Participation = ParticipationRef.implement({
  fields: (t) => ({
    id: t.exposeInt('id'),

    isActive: t.exposeBoolean('isActive'),

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
  participant?: IParticipant
  participation?: IParticipation | null
  course?: ICourse | null
  leaderboard?: ILeaderboardEntry[]
  leaderboardStatistics?: ILeaderboardStatistics
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

    leaderboard: t.expose('leaderboard', {
      type: [LeaderboardEntryRef],
      nullable: true,
    }),

    leaderboardStatistics: t.expose('leaderboardStatistics', {
      type: LeaderboardStatistics,
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
