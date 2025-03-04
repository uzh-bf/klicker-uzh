import * as DB from '@klicker-uzh/prisma'
import { AccessType as AccessTypeEnum } from '@klicker-uzh/types'
import builder from '../builder.js'
import { AccessLevel, ObjectAccess, PermissionStatus } from './sharing.js'

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
  numOfEntries?: number
  sharingStatus?: DB.PermissionStatus
  sharingLevel?: DB.AccessLevel
  ownerShortname?: string
  numSharedUsers?: number
  isOwner?: boolean // flag to signal ownership
  isImported?: boolean // imported flag for UI icon
  isEditable?: boolean // flag for contend editing permissions
  isShareable?: boolean // flag for sharing permissions (incl. catalog assignment, access removal, etc.)
  isRemovable?: boolean // flag if the collection can be removed from the own account
  isDeletionAllowed?: boolean // flag if the user has permissions to delete the collection
}

export const AnswerCollectionRef =
  builder.objectRef<IAnswerCollection>('AnswerCollection')
export const AnswerCollection = AnswerCollectionRef.implement({
  fields: (t) => ({
    id: t.exposeInt('id'),
    name: t.exposeString('name'),
    accessType: t.expose('accessType', { type: AccessType }),
    description: t.exposeString('description'),
    entries: t.expose('entries', {
      type: [AnswerCollectionEntryRef],
      nullable: true,
    }),
    numOfEntries: t.exposeInt('numOfEntries', { nullable: true }),

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
    isImported: t.exposeBoolean('isImported', { nullable: true }),
    isEditable: t.exposeBoolean('isEditable', { nullable: true }),
    isShareable: t.exposeBoolean('isShareable', { nullable: true }),
    isRemovable: t.exposeBoolean('isRemovable', { nullable: true }),
    isDeletionAllowed: t.exposeBoolean('isDeletionAllowed', { nullable: true }),
  }),
})

interface ICatalogAnswerCollection extends DB.AnswerCollection {
  objectAccess: DB.ObjectAccess
  ownerShortname?: string
  entries?: DB.AnswerCollectionEntry[]
}
export const CatalogAnswerCollectionRef =
  builder.objectRef<ICatalogAnswerCollection>('CatalogAnswerCollection')
export const CatalogAnswerCollection = CatalogAnswerCollectionRef.implement({
  fields: (t) => ({
    id: t.exposeInt('id'),
    name: t.exposeString('name'),
    description: t.exposeString('description'),
    objectAccess: t.expose('objectAccess', { type: ObjectAccess }),
    ownerShortname: t.exposeString('ownerShortname', { nullable: true }),
    entries: t.expose('entries', {
      type: [AnswerCollectionEntryRef],
      nullable: true,
    }),
  }),
})

// #endregion
