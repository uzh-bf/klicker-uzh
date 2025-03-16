import * as DB from '@klicker-uzh/prisma'
import builder from '../builder.js'
import { PermissionLevel } from './sharing.js'

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

interface IAnswerCollectionPreviewEntry {
  id: number
  value: string
}

export const AnswerCollectionPreviewEntryRef =
  builder.objectRef<IAnswerCollectionPreviewEntry>(
    'AnswerCollectionPreviewEntry'
  )
export const AnswerCollectionPreviewEntry =
  AnswerCollectionPreviewEntryRef.implement({
    fields: (t) => ({
      id: t.exposeInt('id'),
      value: t.exposeString('value'),
    }),
  })

interface IAnswerCollection extends DB.AnswerCollection {
  entries?: DB.AnswerCollectionEntry[]
  numOfEntries?: number
  permissionLevel?: DB.PermissionLevel
  ownerShortname?: string
  numSharedUsers?: number
  isOwner?: boolean // = OWNER
  isManager?: boolean // = OWNER / ADMIN
  isEditor?: boolean // = OWNER / ADMIN / WRITE
  isImported?: boolean // imported flag for UI icon
  isShared?: boolean // flag to signal whether the object is owned or shared
  isRemovable?: boolean // flag to signal the existence of dependent objects
}

export const AnswerCollectionRef =
  builder.objectRef<IAnswerCollection>('AnswerCollection')
export const AnswerCollection = AnswerCollectionRef.implement({
  fields: (t) => ({
    id: t.exposeInt('id'),
    name: t.exposeString('name'),
    description: t.exposeString('description'),
    entries: t.expose('entries', {
      type: [AnswerCollectionEntryRef],
      nullable: true,
    }),
    numOfEntries: t.exposeInt('numOfEntries', { nullable: true }),

    permissionLevel: t.expose('permissionLevel', {
      type: PermissionLevel,
      nullable: true,
    }),
    ownerShortname: t.exposeString('ownerShortname', { nullable: true }),
    numSharedUsers: t.exposeInt('numSharedUsers', { nullable: true }),
    isOwner: t.exposeBoolean('isOwner', { nullable: true }),
    isManager: t.exposeBoolean('isManager', { nullable: true }),
    isEditor: t.exposeBoolean('isEditor', { nullable: true }),
    isImported: t.exposeBoolean('isImported', { nullable: true }),
    isShared: t.exposeBoolean('isShared', { nullable: true }),
    isRemovable: t.exposeBoolean('isRemovable', { nullable: true }),
  }),
})

// #endregion
