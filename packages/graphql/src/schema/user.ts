import * as DB from '@klicker-uzh/prisma'
import builder from '../builder'

export const LocaleType = builder.enumType('LocaleType', {
  values: Object.values(DB.Locale),
})

export const UserLoginScope = builder.enumType('UserLoginScope', {
  values: Object.values(DB.UserLoginScope),
})

export const User = builder.prismaObject('User', {
  fields: (t) => ({
    id: t.exposeID('id'),
    email: t.exposeString('email'),
    shortname: t.exposeString('shortname'),
    locale: t.expose('locale', { type: LocaleType }),

    loginToken: t.exposeString('loginToken', { nullable: true }),
    loginTokenExpiresAt: t.expose('loginTokenExpiresAt', {
      type: 'Date',
      nullable: true,
    }),
  }),
})

export const UserLogin = builder.prismaObject('UserLogin', {
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
    user: t.expose('user', { type: User }),
    scope: t.expose('scope', { type: UserLoginScope }),
    lastLoginAt: t.expose('lastLoginAt', { type: 'Date', nullable: true }),
  }),
})
