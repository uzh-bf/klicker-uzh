import builder from '../builder'

export const Achievement = builder.prismaObject('Achievement', {
  fields: (t) => ({
    id: t.exposeID('id'),
  }),
})

export const ParticipantAchievementInstance = builder.prismaObject(
  'ParticipantAchievementInstance',
  {
    fields: (t) => ({
      id: t.exposeID('id'),
    }),
  }
)

export const GroupAchievementInstance = builder.prismaObject(
  'GroupAchievementInstance',
  {
    fields: (t) => ({
      id: t.exposeID('id'),
    }),
  }
)

export const ClassAchievementInstance = builder.prismaObject(
  'ClassAchievementInstance',
  {
    fields: (t) => ({
      id: t.exposeID('id'),
    }),
  }
)

export const Title = builder.prismaObject('Title', {
  fields: (t) => ({
    id: t.exposeID('id'),
  }),
})
