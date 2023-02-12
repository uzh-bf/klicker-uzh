import * as DB from '@klicker-uzh/prisma'
import builder from '../builder'
import { Achievement } from './achievement'
import type {
  ICourse,
  IGroupLeaderboardEntry,
  ILeaderboardEntry,
  ILeaderboardStatistics,
} from './course'
import {
  Course,
  GroupLeaderboardEntry,
  LeaderboardEntry,
  LeaderboardStatistics,
} from './course'

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

export interface IParticipant extends DB.Participant {
  rank?: number
  score?: number
  isSelf?: boolean
  achievements?: DB.Achievement[]
  participantGroups?: IParticipantGroup[]
}
export const Participant = builder.objectRef<IParticipant>('Participant')
Participant.implement({
  fields: (t) => ({
    id: t.exposeID('id'),

    username: t.exposeString('username', { nullable: false }),
    avatar: t.exposeString('avatar', { nullable: true }),
    avatarSettings: t.expose('avatarSettings', { type: 'Json' }),

    xp: t.exposeInt('xp'),
    level: t.exposeInt('level'),

    participantGroups: t.expose('participantGroups', {
      type: [ParticipantGroup],
      nullable: true,
    }),
    achievements: t.expose('achievements', {
      type: [Achievement],
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
export const ParticipantGroup =
  builder.objectRef<IParticipantGroup>('ParticipantGroup')
ParticipantGroup.implement({
  fields: (t) => ({
    id: t.exposeID('id'),

    participants: t.expose('participants', {
      type: [Participant],
    }),

    name: t.exposeString('name'),
    code: t.exposeInt('code'),

    averageMemberScore: t.exposeFloat('averageMemberScore'),
    groupActivityScore: t.exposeFloat('groupActivityScore'),
    score: t.exposeFloat('score', { nullable: true }),
  }),
})

export const Participation = builder.prismaObject('Participation', {
  fields: (t) => ({
    id: t.exposeInt('id'),

    isActive: t.exposeBoolean('isActive'),

    subscriptions: t.relation('subscriptions'),

    completedMicroSessions: t.exposeStringList('completedMicroSessions'),

    course: t.relation('course'),

    participant: t.relation('participant'),
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
  participation?: DB.Participation | null
  course?: ICourse | null
  leaderboard?: ILeaderboardEntry[]
  leaderboardStatistics?: ILeaderboardStatistics
  groupLeaderboard?: IGroupLeaderboardEntry[]
  groupLeaderboardStatistics?: ILeaderboardStatistics
}
export const ParticipantLearningData =
  builder.objectRef<IParticipantLearningData>('ParticipantLearningData')
ParticipantLearningData.implement({
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
      type: Course,
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
  participation: DB.Participation
}
export const LeaveCourseParticipation =
  builder.objectRef<ILeaveCourseParticipation>('LeaveCourseParticipation')
LeaveCourseParticipation.implement({
  fields: (t) => ({
    id: t.exposeString('id'),

    participation: t.expose('participation', {
      type: Participation,
    }),
  }),
})
