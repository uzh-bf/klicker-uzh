import builder from '../builder'

export const User = builder.prismaObject('User', {
  fields: (t) => ({
    id: t.exposeID('id'),
  }),
})
