import * as DB from '@klicker-uzh/prisma'
import {
  AccessType as AccessTypeEnum,
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

export const AccessType = builder.enumType('AccessType', {
  values: Object.values(AccessTypeEnum),
})

// ----- ANSWER COLLECTIONS -----
// #region
interface IAnswerCollectionEntry extends DB.AnswerCollectionEntry {
  numSolutionUsages?: number
}

export const AnswerCollectionEntryRef =
  builder.objectRef<IAnswerCollectionEntry>('AnswerCollectionEntry')
export const AnswerCollectionEntry = AnswerCollectionEntryRef.implement({
  fields: (t) => ({
    id: t.exposeInt('id'),
    value: t.exposeString('value'),
    numSolutionUsages: t.exposeInt('numSolutionUsages', { nullable: true }),
  }),
})

interface IAnswerCollection extends DB.AnswerCollection {
  accessType: AccessTypeEnum
  entries?: DB.AnswerCollectionEntry[]
  sharingStatus?: DB.PermissionStatus
  sharingLevel?: DB.AccessLevel
  ownerShortname?: string
  numSharedUsers?: number
  isOwner?: boolean
  isEditable?: boolean
  isImported?: boolean
  isAccessGranted?: boolean
  isRemovable?: boolean
}

export const AnswerCollectionRef =
  builder.objectRef<IAnswerCollection>('AnswerCollection')
export const AnswerCollection = AnswerCollectionRef.implement({
  fields: (t) => ({
    id: t.exposeInt('id'),
    name: t.exposeString('name'),
    access: t.expose('access', { type: ObjectAccess }),
    accessType: t.expose('accessType', { type: AccessType }),
    description: t.exposeString('description'),
    entries: t.expose('entries', {
      type: [AnswerCollectionEntryRef],
      nullable: true,
    }),
    sharingStatus: t.expose('sharingStatus', {
      type: PermissionStatus,
      nullable: true,
    }),
    sharingLevel: t.expose('sharingLevel', {
      type: AccessLevel,
      nullable: true,
    }),
    ownerShortname: t.exposeString('ownerShortname', { nullable: true }),
    numSharedUsers: t.exposeInt('numSharedUsers', { nullable: true }),
    isOwner: t.exposeBoolean('isOwner', { nullable: true }),
    isEditable: t.exposeBoolean('isEditable', { nullable: true }),
    isImported: t.exposeBoolean('isImported', { nullable: true }),
    isAccessGranted: t.exposeBoolean('isAccessGranted', { nullable: true }),
    isRemovable: t.exposeBoolean('isRemovable', { nullable: true }),
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

// ----- CATALOG OBJECTS -----
// #region

export const CatalogObjectRef =
  builder.objectRef<CatalogObjectInterface>('CatalogObject')
export const CatalogObject = CatalogObjectRef.implement({
  fields: (t) => ({
    id: t.exposeInt('id', { nullable: true }),
    uuid: t.exposeString('uuid', { nullable: true }),
    name: t.exposeString('name'),
    objectType: t.expose('objectType', { type: CatalogObjectType }),
    access: t.expose('access', { type: ObjectAccess }),
    ownerShortname: t.exposeString('ownerShortname', { nullable: true }),
    isRequested: t.exposeBoolean('isRequested'),
    isShared: t.exposeBoolean('isShared'),
    isOwner: t.exposeBoolean('isOwner'),
  }),
})

// #endregion
