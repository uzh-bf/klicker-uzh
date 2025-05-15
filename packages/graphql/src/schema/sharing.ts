import * as DB from '@klicker-uzh/prisma'
import {
  CatalogObject as CatalogObjectInterface,
  ObjectSharingRequest as ObjectSharingRequestType,
  SharingObjectType as SharingObjectTypeEnum,
  SharingType as SharingTypeEnum,
} from '@klicker-uzh/types'
import builder from '../builder.js'
import { IUserInfo, UserInfo } from './user.js'

export const ObjectAccess = builder.enumType('ObjectAccess', {
  values: Object.values(DB.ObjectAccess),
})

export const SharingObjectType = builder.enumType('SharingObjectType', {
  values: Object.values(SharingObjectTypeEnum),
})

export const ObjectType = builder.enumType('ObjectType', {
  values: Object.values(DB.ObjectType),
})

export const SharingType = builder.enumType('SharingType', {
  values: Object.values(SharingTypeEnum),
})

export const PermissionLevel = builder.enumType('PermissionLevel', {
  values: Object.values(DB.PermissionLevel),
})

// ----- CATALOG OBJECTS -----
// #region
interface ICatalogCollection extends DB.CatalogCollection {
  ownerShortname?: string
  isRequested: boolean // pending permission request
  isShared: boolean // granted permission
  isOwner?: boolean // OWNER permissions
  isManager: boolean // ADMIN / OWNER permissions
  isEditor?: boolean // WRITE / ADMIN / OWNER permissions
}
export const CatalogCollectionRef =
  builder.objectRef<ICatalogCollection>('CatalogCollection')
export const CatalogCollection = CatalogCollectionRef.implement({
  fields: (t) => ({
    id: t.exposeString('id'),
    name: t.exposeString('name'),
    access: t.expose('access', { type: ObjectAccess }),
    ownerShortname: t.exposeString('ownerShortname', { nullable: true }),
    isOwner: t.exposeBoolean('isOwner', { nullable: true }),
    isManager: t.exposeBoolean('isManager'),
    isEditor: t.exposeBoolean('isEditor', { nullable: true }),
    isRequested: t.exposeBoolean('isRequested'),
    isShared: t.exposeBoolean('isShared'),
  }),
})

export const CatalogObjectRef =
  builder.objectRef<CatalogObjectInterface>('CatalogObject')
export const CatalogObject = CatalogObjectRef.implement({
  fields: (t) => ({
    id: t.exposeInt('id'), // assignment id
    objectId: t.exposeInt('objectId', { nullable: true }), // object id
    objectUuid: t.exposeString('objectUuid', { nullable: true }), // object uuid
    name: t.exposeString('name'),
    objectType: t.expose('objectType', { type: SharingObjectType }),
    templateId: t.exposeString('templateId', { nullable: true }),
    access: t.expose('access', { type: ObjectAccess }),
    ownerShortname: t.exposeString('ownerShortname', { nullable: true }),
    isOwner: t.exposeBoolean('isOwner'),
    isManager: t.exposeBoolean('isManager'),
    isRequested: t.exposeBoolean('isRequested'),
    isShared: t.exposeBoolean('isShared'),
  }),
})

interface ICatalogSelectionObject {
  id: string
  name: string
}
export const CatalogSelectionObjectRef =
  builder.objectRef<ICatalogSelectionObject>('CatalogSelectionObject')
export const CatalogSelectionObject = CatalogSelectionObjectRef.implement({
  fields: (t) => ({
    id: t.exposeString('id'),
    name: t.exposeString('name'),
  }),
})

export const ObjectSharingRequestRef =
  builder.objectRef<ObjectSharingRequestType>('ObjectSharingRequest')
export const ObjectSharingRequest = ObjectSharingRequestRef.implement({
  fields: (t) => ({
    requestId: t.exposeInt('requestId'),
    objectName: t.exposeString('objectName'),
    objectType: t.expose('objectType', { type: SharingObjectType }),
    userId: t.exposeString('userId'),
    userShortname: t.exposeString('userShortname'),
    userEmail: t.exposeString('userEmail'),
  }),
})

interface ISharingRequestResponse {
  collectionId: number
  userId: string
}
export const SharingRequestResponseRef =
  builder.objectRef<ISharingRequestResponse>('SharingRequestResponse')
export const SharingRequestResponse = SharingRequestResponseRef.implement({
  fields: (t) => ({
    collectionId: t.exposeInt('collectionId'),
    userId: t.exposeString('userId'),
  }),
})
// #endregion

// ----- PERMISSIONS -----
// #region
interface IPermissionInfo {
  permissionId: number
  userId?: string
  username?: string
  userEmail?: string
  userGroupName?: string
  permissionLevel: DB.PermissionLevel
  propagation?: boolean
  isOwn?: boolean
}
export const PermissionInfoRef =
  builder.objectRef<IPermissionInfo>('PermissionInfo')
export const PermissionInfo = PermissionInfoRef.implement({
  fields: (t) => ({
    permissionId: t.exposeInt('permissionId'),
    userId: t.exposeString('userId', { nullable: true }),
    username: t.exposeString('username', { nullable: true }),
    userEmail: t.exposeString('userEmail', { nullable: true }),
    userGroupName: t.exposeString('userGroupName', { nullable: true }),
    permissionLevel: t.expose('permissionLevel', { type: PermissionLevel }),
    propagation: t.exposeBoolean('propagation', { nullable: true }),
    isOwn: t.exposeBoolean('isOwn', { nullable: true }),
  }),
})

interface IDerivedPermissionInfo {
  permissionId: number
  permissionLevel: DB.PermissionLevel
  userId: string
  username: string
  userEmail: string
  isOwn: boolean
}
export const DerivedPermissionInfoRef =
  builder.objectRef<IDerivedPermissionInfo>('DerivedPermissionInfo')
export const DerivedPermissionInfo = DerivedPermissionInfoRef.implement({
  fields: (t) => ({
    permissionId: t.exposeInt('permissionId'),
    permissionLevel: t.expose('permissionLevel', { type: PermissionLevel }),
    userId: t.exposeString('userId'),
    username: t.exposeString('username'),
    userEmail: t.exposeString('userEmail'),
    isOwn: t.exposeBoolean('isOwn'),
  }),
})

interface IDerivedPermissionOriginInformation {
  permissionUser: string
  parentObjectType?: DB.ObjectType
  parentObjectName?: string
  parentObjectOwner?: string
  parentTargetUser?: string
  parentTargetUserGroup?: string
  parentPermissionLevel?: DB.PermissionLevel
}

export const DerivedPermissionOriginInformationRef =
  builder.objectRef<IDerivedPermissionOriginInformation>(
    'DerivedPermissionOriginInformation'
  )
export const DerivedPermissionOriginInformation =
  DerivedPermissionOriginInformationRef.implement({
    fields: (t) => ({
      permissionUser: t.exposeString('permissionUser'),
      parentObjectType: t.expose('parentObjectType', {
        type: ObjectType,
        nullable: true,
      }),
      parentObjectName: t.exposeString('parentObjectName', {
        nullable: true,
      }),
      parentObjectOwner: t.exposeString('parentObjectOwner', {
        nullable: true,
      }),
      parentTargetUser: t.exposeString('parentTargetUser', {
        nullable: true,
      }),
      parentTargetUserGroup: t.exposeString('parentTargetUserGroup', {
        nullable: true,
      }),
      parentPermissionLevel: t.expose('parentPermissionLevel', {
        type: PermissionLevel,
        nullable: true,
      }),
    }),
  })
// #endregion

// ----- USER GROUPS -----
// #region
export const UserGroupMembersInput = builder.inputType(
  'UserGroupMembersInput',
  {
    fields: (t) => ({
      shortnameOrEmail: t.string({ required: true }),
      isAdmin: t.boolean(),
    }),
  }
)

interface IUserGroup extends DB.UserGroup {
  numOfMembers?: number
  members?: IUserInfo[]
  admins?: IUserInfo[]
  owner?: IUserInfo
  isMember?: boolean
  isAdmin?: boolean
  isOwner?: boolean
}
export const UserGroupRef = builder.objectRef<IUserGroup>('UserGroup')
export const UserGroup = UserGroupRef.implement({
  fields: (t) => ({
    id: t.exposeInt('id'),
    name: t.exposeString('name'),
    members: t.expose('members', {
      type: [UserInfo],
      nullable: true,
    }),
    admins: t.expose('admins', {
      type: [UserInfo],
      nullable: true,
    }),
    owner: t.expose('owner', {
      type: UserInfo,
      nullable: true,
    }),
    numOfMembers: t.exposeInt('numOfMembers', { nullable: true }),
    isMember: t.exposeBoolean('isMember', { nullable: true }),
    isAdmin: t.exposeBoolean('isAdmin', { nullable: true }),
    isOwner: t.exposeBoolean('isOwner', { nullable: true }),
  }),
})

// #endregion
