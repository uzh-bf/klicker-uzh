import builder from '../builder'

export const Participant = builder.prismaObject('Participant', {
  fields: (t) => ({
    id: t.exposeID('id'),
    username: t.exposeString('username'),
    avatar: t.exposeString('avatar', { nullable: true }),
    participantGroups: t.relation('participantGroups'),
  }),
})

export const ParticipantGroup = builder.prismaObject('ParticipantGroup', {
  fields: (t) => ({
    id: t.exposeID('id'),
  }),
})

export const Participation = builder.prismaObject('Participation', {
  fields: (t) => ({
    id: t.exposeID('id'),
  }),
})

export const PushSubscription = builder.prismaObject('PushSubscription', {
  fields: (t) => ({
    id: t.exposeID('id'),
  }),
})
