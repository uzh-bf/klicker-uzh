import * as DB from '@klicker-uzh/prisma'
import builder from '../builder.js'

export const LocaleType: ReturnType<typeof builder.enumType> = builder.enumType(
  'LocaleType',
  {
    values: Object.values(DB.Locale),
  }
)

export const UserRole: ReturnType<typeof builder.enumType> = builder.enumType(
  'UserRole',
  {
    values: Object.values(DB.UserRole),
  }
)

export const UserLoginScope: ReturnType<typeof builder.enumType> =
  builder.enumType('UserLoginScope', {
    values: Object.values(DB.UserLoginScope),
  })

export interface IUser extends DB.User {
  catalystInstitutional: boolean
  catalystIndividual: boolean
  catalystTier: string | null
  mediaFiles?: IMediaFile[]
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

    mediaFiles: t.expose('mediaFiles', {
      type: [MediaFileRef],
      nullable: true,
    }),

    firstLogin: t.exposeBoolean('firstLogin'),
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

export interface IMediaFile extends DB.MediaFile {}
export const MediaFileRef = builder.objectRef<IMediaFile>('MediaFile')
export const MediaFile = MediaFileRef.implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
    href: t.exposeString('href'),
    type: t.exposeString('type'),
    createdAt: t.expose('createdAt', { type: 'Date' }),
  }),
})

export interface IFileUploadSAS {
  uploadSasURL: string
  uploadHref: string
  containerName: string
  fileName: string
}
export const FileUploadSASRef =
  builder.objectRef<IFileUploadSAS>('FileUploadSAS')
export const FileUploadSAS = FileUploadSASRef.implement({
  fields: (t) => ({
    uploadSasURL: t.exposeString('uploadSasURL'),
    uploadHref: t.exposeString('uploadHref'),
    containerName: t.exposeString('containerName'),
    fileName: t.exposeString('fileName'),
  }),
})
