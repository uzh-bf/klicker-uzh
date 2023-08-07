import builder from '../builder'

export const User = builder.prismaObject('User', {
  fields: (t) => ({
    id: t.exposeID('id'),
    email: t.exposeString('email'),
    shortname: t.exposeString('shortname'),
    locale: t.exposeString('locale'),

    isActive: t.exposeBoolean('isActive'),

    loginToken: t.exposeString('loginToken', { nullable: true }),
    loginTokenExpiresAt: t.expose('loginTokenExpiresAt', {
      type: 'Date',
      nullable: true,
    }),
  }),
})
