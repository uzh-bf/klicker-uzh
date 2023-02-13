import builder from '../builder'

export const Achievement = builder.prismaObject('Achievement', {
  fields: (t) => ({
    id: t.exposeInt('id'),

    name: t.exposeString('name'),
    description: t.exposeString('description'),
    icon: t.exposeString('icon'),
    iconColor: t.exposeString('iconColor', { nullable: true }),
  }),
})

export const ParticipantAchievementInstance = builder.prismaObject(
  'ParticipantAchievementInstance',
  {
    fields: (t) => ({
      id: t.exposeInt('id'),

      achievedAt: t.expose('achievedAt', { type: 'Date' }),
      achievedCount: t.exposeInt('achievedCount'),

      achievement: t.relation('achievement'),
    }),
  }
)

export const GroupAchievementInstance = builder.prismaObject(
  'GroupAchievementInstance',
  {
    fields: (t) => ({
      id: t.exposeInt('id'),
    }),
  }
)

export const ClassAchievementInstance = builder.prismaObject(
  'ClassAchievementInstance',
  {
    fields: (t) => ({
      id: t.exposeInt('id'),
    }),
  }
)

export const Title = builder.prismaObject('Title', {
  fields: (t) => ({
    id: t.exposeInt('id'),
  }),
})
