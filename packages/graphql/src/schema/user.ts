import * as DB from '@klicker-uzh/prisma/client'
import builder from '../builder.js'

export const LocaleType = builder.enumType('LocaleType', {
  values: Object.values(DB.Locale),
})

export const UserLoginScope = builder.enumType('UserLoginScope', {
  values: Object.values(DB.UserLoginScope),
})

export const UserRole = builder.enumType('UserRole', {
  values: Object.values(DB.UserRole),
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
    sendProjectUpdates: t.exposeBoolean('sendProjectUpdates'),

    shortname: t.exposeString('shortname'),
    locale: t.expose('locale', { type: LocaleType }),
    role: t.expose('role', { type: UserRole }),

    catalyst: t.boolean({
      resolve: (user) => user.catalystInstitutional || user.catalystIndividual,
    }),
    catalystTier: t.exposeString('catalystTier', { nullable: true }),

    publicPreview: t.exposeBoolean('publicPreview'),
    privatePreview: t.exposeBoolean('privatePreview'),

    aiFeaturesEnabled: t.exposeBoolean('aiFeaturesEnabled'),

    numChatbots: t.int({
      resolve: async (user, _, ctx) => {
        return await ctx.prisma.chatbot.count({
          where: { ownerId: user.id },
        })
      },
    }),

    mediaFiles: t.expose('mediaFiles', {
      type: [MediaFileRef],
      nullable: true,
    }),

    firstLogin: t.exposeBoolean('firstLogin'),
  }),
})

export interface IUserInfo {
  id?: string | null
  shortname: string
  email: string
  isSelf?: boolean
}
export const UserInfoRef = builder.objectRef<IUserInfo>('UserInfo')
export const UserInfo = UserInfoRef.implement({
  fields: (t) => ({
    id: t.exposeString('id', { nullable: true }),
    shortname: t.exposeString('shortname'),
    email: t.exposeString('email'),
    isSelf: t.exposeBoolean('isSelf', { nullable: true }),
  }),
})

export interface IUserLogin extends DB.UserLogin {
  user?: IUser
}
export const UserLoginRef = builder.objectRef<IUserLogin>('UserLogin')
export const UserLogin = UserLoginRef.implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
    user: t.expose('user', { type: UserRef, nullable: true }),
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
