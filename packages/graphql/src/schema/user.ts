import * as DB from '@klicker-uzh/prisma'
import builder from '../builder'

export const LocaleType = builder.enumType('LocaleType', {
  values: Object.values(DB.Locale),
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
