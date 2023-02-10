import builder from '../builder'

export const Course = builder.prismaObject('Course', {
  fields: (t) => ({
    id: t.exposeID('id', { nullable: false }),
    name: t.exposeString('name'),
    displayName: t.exposeString('displayName'),

    pinCode: t.exposeInt('pinCode', { nullable: true }),

    color: t.exposeString('color', { nullable: true }),
    description: t.exposeString('description', { nullable: true }),

    isArchived: t.exposeBoolean('isArchived', { nullable: true }),

    createdAt: t.expose('createdAt', { type: 'Date' }),
    updatedAt: t.expose('updatedAt', { type: 'Date' }),

    sessions: t.relation('sessions'),
  }),
})

export const LeaderboardEntry = builder.prismaObject('LeaderboardEntry', {
  fields: (t) => ({
    id: t.exposeInt('id'),
  }),
})

export const AwardEntry = builder.prismaObject('AwardEntry', {
  fields: (t) => ({
    id: t.exposeInt('id'),
  }),
})
