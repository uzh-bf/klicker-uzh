import * as DB from '@klicker-uzh/prisma'
import {
  CatalogObject as CatalogObjectInterface,
  CatalogObjectType as CatalogObjectTypeEnum,
  ObjectSharingRequest as ObjectSharingRequestType,
} from '@klicker-uzh/types'
import builder from '../builder.js'

export const ObjectAccess = builder.enumType('ObjectAccess', {
  values: Object.values(DB.ObjectAccess),
})

export const CatalogObjectType = builder.enumType('CatalogObjectType', {
  values: Object.values(CatalogObjectTypeEnum),
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
    id: t.exposeInt('id', { nullable: true }),
    uuid: t.exposeString('uuid', { nullable: true }),
    name: t.exposeString('name'),
    objectType: t.expose('objectType', { type: CatalogObjectType }),
    assignmentId: t.exposeInt('assignmentId'),
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
    objectType: t.expose('objectType', { type: CatalogObjectType }),
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
// #endregion
