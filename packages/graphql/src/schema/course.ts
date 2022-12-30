import builder from '../builder'

export const Course = builder.prismaObject('Course', {
  fields: (t) => ({
    id: t.exposeID('id'),
  }),
})

export const LeaderboardEntry = builder.prismaObject('LeaderboardEntry', {
  fields: (t) => ({
    id: t.exposeID('id'),
  }),
})

export const AwardEntry = builder.prismaObject('AwardEntry', {
  fields: (t) => ({
    id: t.exposeID('id'),
  }),
})
