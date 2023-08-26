import * as DB from '@klicker-uzh/prisma'
import builder from '../builder'

export const LocaleType = builder.enumType('LocaleType', {
  values: Object.values(DB.Locale),
})

export const UserLoginScope = builder.enumType('UserLoginScope', {
  values: Object.values(DB.UserLoginScope),
})

export interface IUser extends DB.User {
  fullAccess?: boolean
}
export const UserRef = builder.objectRef<IUser>('User')
export const User = UserRef.implement({
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

    fullAccess: t.boolean({
      nullable: true,
      resolve: (user) => user.fullAccess,
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
