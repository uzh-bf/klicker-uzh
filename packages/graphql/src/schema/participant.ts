import builder from '../builder'
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

export const Participant = builder.prismaObject('Participant', {
  fields: (t) => ({
    id: t.exposeID('id'),

    username: t.exposeString('username', { nullable: false }),
    avatar: t.exposeString('avatar', { nullable: true }),
    avatarSettings: t.expose('avatarSettings', { type: 'Json' }),

    xp: t.exposeInt('xp'),
    level: t.exposeInt('level'),

    participantGroups: t.relation('participantGroups'),
    achievements: t.relation('achievements'),

    lastLoginAt: t.expose('lastLoginAt', { type: 'Date', nullable: true }),

    rank: t.int({
      resolve: (participant) => participant.rank,
    }),
    score: t.float({
      resolve: (participant) => participant.score,
    }),
    isSelf: t.boolean({
      resolve: (participant, args, ctx) => {
        return participant.id === ctx.user?.sub
      },
    }),
  }),
})

export const ParticipantGroup = builder.prismaObject('ParticipantGroup', {
  fields: (t) => ({
    id: t.exposeID('id'),

    participants: t.relation('participants'),

    name: t.exposeString('name'),
    code: t.exposeInt('code'),

    score: t.float({
      resolve: (group) => group.score,
    }),
  }),
})

export const Participation = builder.prismaObject('Participation', {
  fields: (t) => ({
    id: t.exposeInt('id'),

    isActive: t.exposeBoolean('isActive'),

    subscriptions: t.relation('subscriptions'),

    completedMicroSessions: t.exposeStringList('completedMicroSessions'),
  }),
})

export const PushSubscription = builder.prismaObject('PushSubscription', {
  fields: (t) => ({
    id: t.exposeInt('id'),

    endpoint: t.exposeString('endpoint', { nullable: false }),
  }),
})

interface ParticipantLearningData {
  id: string
  participantToken?: string
  participant?: any // FIXME
  participation?: any // FIXME
  course?: any // FIXME
  leaderboard?: any[] // FIXME
  leaderboardStatistics?: any // FIXME
  groupLeaderboard?: any[] // FIXME
  groupLeaderboardStatistics?: any // FIXME
}

export const ParticipantLearningData = builder
  .objectRef<ParticipantLearningData>('ParticipantLearningData')
  .implement({
    fields: (t) => ({
      id: t.exposeString('id'),

      participantToken: t.exposeString('participantToken', { nullable: true }),

      participant: t.field({
        type: Participant,
        resolve: (root, args, ctx) => {
          return root.participant
        },
        nullable: true,
      }),

      participation: t.field({
        type: Participation,
        resolve: (root, args, ctx) => {
          return root.participation
        },
        nullable: true,
      }),

      course: t.field({
        type: Course,
        resolve: (root, args, ctx) => {
          return root.course
        },
        nullable: true,
      }),

      leaderboard: t.field({
        type: [LeaderboardEntry],
        resolve: (root, args, ctx) => {
          return root.leaderboard
        },
        nullable: true,
      }),

      leaderboardStatistics: t.field({
        type: LeaderboardStatistics,
        resolve: (root, args, ctx) => {
          return root.leaderboardStatistics
        },
        nullable: true,
      }),

      groupLeaderboard: t.field({
        type: [GroupLeaderboardEntry],
        resolve: (root, args, ctx) => {
          return root.groupLeaderboard
        },
        nullable: true,
      }),

      groupLeaderboardStatistics: t.field({
        type: LeaderboardStatistics,
        resolve: (root, args, ctx) => {
          return root.groupLeaderboardStatistics
        },
        nullable: true,
      }),
    }),
  })

interface LeaveCourseParticipation {
  id: string
  participation: any // FIXME
}

export const LeaveCourseParticipation = builder
  .objectRef<LeaveCourseParticipation>('LeaveCourseParticipation')
  .implement({
    fields: (t) => ({
      id: t.exposeString('id'),

      participation: t.field({
        type: Participation,
        resolve: (root, args, ctx) => {
          return root.participation
        },
      }),
    }),
  })
