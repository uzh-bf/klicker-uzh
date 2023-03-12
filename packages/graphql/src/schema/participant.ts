import * as DB from '@klicker-uzh/prisma'
import builder from '../builder'
import { levelFromXp } from '../util'
import { Achievement, ParticipantAchievementInstance } from './achievement'
import type {
  ICourse,
  IGroupLeaderboardEntry,
  ILeaderboardEntry,
  ILeaderboardStatistics,
} from './course'
import {
  CourseRef,
  GroupLeaderboardEntry,
  LeaderboardEntry,
  LeaderboardStatistics,
} from './course'
import { IQuestionStack, QuestionStackRef } from './learningElements'

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
  achievements?: DB.ParticipantAchievementInstance[]
  participantGroups?: IParticipantGroup[]
  level?: number
  levelData?: ILevel
}
export const ParticipantRef = builder.objectRef<IParticipant>('Participant')
export const Participant = ParticipantRef.implement({
  fields: (t) => ({
    id: t.exposeID('id'),

    username: t.exposeString('username', { nullable: false }),
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
      resolve: (participant, _, ctx) =>
        ctx.prisma.level.findUnique({
          where: {
            index: levelFromXp(participant.xp),
          },
          include: {
            nextLevel: true,
          },
        }),
    }),

    participantGroups: t.expose('participantGroups', {
      type: [ParticipantGroupRef],
      nullable: true,
    }),
    achievements: t.expose('achievements', {
      type: [ParticipantAchievementInstance],
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
  participants: IParticipant[]
}
export const ParticipantGroupRef =
  builder.objectRef<IParticipantGroup>('ParticipantGroup')
export const ParticipantGroup = ParticipantGroupRef.implement({
  fields: (t) => ({
    id: t.exposeID('id'),

    participants: t.expose('participants', {
      type: [ParticipantRef],
    }),

    name: t.exposeString('name'),
    code: t.exposeInt('code'),

    averageMemberScore: t.exposeFloat('averageMemberScore'),
    groupActivityScore: t.exposeFloat('groupActivityScore'),
    score: t.exposeFloat('score', { nullable: true }),
  }),
})

export interface IParticipation extends DB.Participation {
  subscriptions?: DB.PushSubscription[]
  course?: ICourse
  participant?: IParticipant
  bookmarkedStacks?: IQuestionStack[]
}
export const ParticipationRef =
  builder.objectRef<IParticipation>('Participation')
export const Participation = ParticipationRef.implement({
  fields: (t) => ({
    id: t.exposeInt('id'),

    isActive: t.exposeBoolean('isActive'),

    subscriptions: t.expose('subscriptions', {
      type: [PushSubscription],
      nullable: true,
    }),

    completedMicroSessions: t.exposeStringList('completedMicroSessions'),

    course: t.expose('course', {
      type: CourseRef,
      nullable: true,
    }),

    participant: t.expose('participant', {
      type: ParticipantRef,
      nullable: true,
    }),

    bookmarkedStacks: t.expose('bookmarkedStacks', {
      type: [QuestionStackRef],
      nullable: true,
    }),
  }),
})

export const PushSubscription = builder.prismaObject('PushSubscription', {
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
}
export const ParticipantLearningDataRef =
  builder.objectRef<IParticipantLearningData>('ParticipantLearningData')
export const ParticipantLearningData = ParticipantLearningDataRef.implement({
  fields: (t) => ({
    id: t.exposeString('id'),

    participantToken: t.exposeString('participantToken', { nullable: true }),

    participant: t.expose('participant', {
      type: Participant,
      nullable: true,
    }),

    participation: t.expose('participation', {
      type: Participation,
      nullable: true,
    }),

    course: t.expose('course', {
      type: CourseRef,
      nullable: true,
    }),

    leaderboard: t.expose('leaderboard', {
      type: [LeaderboardEntry],
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
      type: Participation,
    }),
  }),
})

export interface IParticipantWithAchievements {
  participant: IParticipant
  achievements: DB.Achievement[]
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
        type: [Achievement],
      }),
    }),
  })
