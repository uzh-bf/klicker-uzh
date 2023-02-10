import builder from '../builder'

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

    lastLoginAt: t.expose('lastLoginAt', { type: 'Date' }),
  }),
})

export const ParticipantGroup = builder.prismaObject('ParticipantGroup', {
  fields: (t) => ({
    id: t.exposeID('id'),

    participants: t.relation('participants'),

    name: t.exposeString('name'),
    code: t.exposeInt('code'),
  }),
})

export const Participation = builder.prismaObject('Participation', {
  fields: (t) => ({
    id: t.exposeInt('id'),

    isActive: t.exposeBoolean('isActive'),

    subscriptions: t.relation('subscriptions'),
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
}

export const ParticipantLearningData = builder
  .objectRef<ParticipantLearningData>('ParticipantLearningData')
  .implement({
    fields: (t) => ({
      id: t.exposeString('id'),
    }),
  })

interface LeaveCourseParticipation {
  id: string
  participation: any
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
