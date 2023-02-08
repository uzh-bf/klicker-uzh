import builder from '../builder'

export const Participant = builder.prismaObject('Participant', {
  fields: (t) => ({
    id: t.exposeID('id'),

    username: t.exposeString('username'),
    avatar: t.exposeString('avatar', { nullable: true }),
    avatarSettings: t.expose('avatarSettings', { type: 'Json' }),

    participantGroups: t.relation('participantGroups'),
    achievements: t.relation('achievements'),
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
  }),
})

export const PushSubscription = builder.prismaObject('PushSubscription', {
  fields: (t) => ({
    id: t.exposeInt('id'),
  }),
})
