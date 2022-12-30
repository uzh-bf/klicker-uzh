import builder from '../builder'

export const GroupActivity = builder.prismaObject('GroupActivity', {
  fields: (t) => ({
    id: t.exposeID('id'),
  }),
})

export const GroupActivityInstance = builder.prismaObject(
  'GroupActivityInstance',
  {
    fields: (t) => ({
      id: t.exposeInt('id'),
    }),
  }
)

export const GroupActivityClue = builder.prismaObject('GroupActivityClue', {
  fields: (t) => ({
    id: t.exposeInt('id'),
  }),
})

export const GroupActivityClueInstance = builder.prismaObject(
  'GroupActivityClueInstance',
  {
    fields: (t) => ({
      id: t.exposeInt('id'),
    }),
  }
)

export const GroupActivityClueAssignment = builder.prismaObject(
  'GroupActivityClueAssignment',
  {
    fields: (t) => ({
      id: t.exposeInt('id'),
    }),
  }
)

export const GroupActivityParameter = builder.prismaObject(
  'GroupActivityParameter',
  {
    fields: (t) => ({
      id: t.exposeInt('id'),
    }),
  }
)
