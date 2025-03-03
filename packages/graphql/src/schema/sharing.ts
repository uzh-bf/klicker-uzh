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

export const PermissionStatus = builder.enumType('PermissionStatus', {
  values: Object.values(DB.PermissionStatus),
})

export const AccessLevel = builder.enumType('AccessLevel', {
  values: Object.values(DB.AccessLevel),
})

// ----- CATALOG OBJECTS -----
// #region
interface ICatalogCollection extends DB.CatalogCollection {
  ownerShortname?: string
  isRequested: boolean // pending permission request
  isShared: boolean // granted permission
  isEditor?: boolean // WRITE / ADMIN / OWNER permissions
  isOwner?: boolean // OWNER permissions
  isOwnerOrAdmin: boolean // ADMIN / OWNER permissions
}
export const CatalogCollectionRef =
  builder.objectRef<ICatalogCollection>('CatalogCollection')
export const CatalogCollection = CatalogCollectionRef.implement({
  fields: (t) => ({
    id: t.exposeString('id'),
    name: t.exposeString('name'),
    access: t.expose('access', { type: ObjectAccess }),
    ownerShortname: t.exposeString('ownerShortname', { nullable: true }),
    isRequested: t.exposeBoolean('isRequested'),
    isShared: t.exposeBoolean('isShared'),
    isEditor: t.exposeBoolean('isEditor', { nullable: true }),
    isOwner: t.exposeBoolean('isOwner', { nullable: true }),
    isOwnerOrAdmin: t.exposeBoolean('isOwnerOrAdmin'),
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
    access: t.expose('access', { type: ObjectAccess }),
    ownerShortname: t.exposeString('ownerShortname', { nullable: true }),
    isRequested: t.exposeBoolean('isRequested'),
    isShared: t.exposeBoolean('isShared'),
    isOwner: t.exposeBoolean('isOwner'),
    isOwnerOrAdmin: t.exposeBoolean('isOwnerOrAdmin'),
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
    permissionId: t.exposeInt('permissionId'),
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
  accessLevel: DB.AccessLevel
  isRevokable?: boolean
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
    accessLevel: t.expose('accessLevel', { type: AccessLevel }),
    isRevokable: t.exposeBoolean('isRevokable', { nullable: true }),
    isOwn: t.exposeBoolean('isOwn', { nullable: true }),
  }),
})
// #endregion
