import * as DB from '@klicker-uzh/prisma'
import {
  AccessType as AccessTypeEnum,
  AnswerCollectionSharingRequest as AnswerCollectionSharingRequestType,
} from '@klicker-uzh/types'
import builder from '../builder.js'

export const CollectionAccess = builder.enumType('CollectionAccess', {
  values: Object.values(DB.CollectionAccess),
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
  isRemovable?: boolean
}

export const AnswerCollectionRef =
  builder.objectRef<IAnswerCollection>('AnswerCollection')
export const AnswerCollection = AnswerCollectionRef.implement({
  fields: (t) => ({
    id: t.exposeInt('id'),
    name: t.exposeString('name'),
    access: t.expose('access', { type: CollectionAccess }),
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
    isRemovable: t.exposeBoolean('isRemovable', { nullable: true }),
  }),
})

export const AnswerCollectionSharingRequestRef =
  builder.objectRef<AnswerCollectionSharingRequestType>(
    'AnswerCollectionSharingRequest'
  )
export const AnswerCollectionSharingRequest =
  AnswerCollectionSharingRequestRef.implement({
    fields: (t) => ({
      collectionId: t.exposeInt('collectionId'),
      collectionName: t.exposeString('collectionName'),
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
