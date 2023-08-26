import * as DB from '@klicker-uzh/prisma'
import builder from '../builder'

export const LocaleType = builder.enumType('LocaleType', {
  values: Object.values(DB.Locale),
})

export const UserLoginScope = builder.enumType('UserLoginScope', {
  values: Object.values(DB.UserLoginScope),
})

export interface IUser extends DB.User {
  catalystInstitutional: boolean
  catalystIndividual: boolean
  catalystTier: string | null
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

    catalyst: t.boolean({
      resolve: (user) => user.catalystInstitutional || user.catalystIndividual,
    }),
    catalystTier: t.exposeString('catalystTier', { nullable: true }),
  }),
})

export interface IUserLogin extends DB.UserLogin {
  user: IUser
}
export const UserLoginRef = builder.objectRef<IUserLogin>('UserLogin')
export const UserLogin = UserLoginRef.implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
    user: t.expose('user', { type: UserRef }),
    scope: t.expose('scope', { type: UserLoginScope }),
    lastLoginAt: t.expose('lastLoginAt', { type: 'Date', nullable: true }),
  }),
})
