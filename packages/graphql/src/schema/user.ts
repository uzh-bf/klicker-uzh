import builder from '../builder'

export const User = builder.prismaObject('User', {
  fields: (t) => ({
    id: t.exposeID('id'),

    loginToken: t.exposeString('loginToken', { nullable: true }),
    loginTokenExpiresAt: t.expose('loginTokenExpiresAt', {
      type: 'Date',
      nullable: true,
    }),
  }),
})
