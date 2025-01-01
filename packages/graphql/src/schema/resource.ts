import * as DB from '@klicker-uzh/prisma'
import builder from '../builder.js'

export const CollectionAccess = builder.enumType('CollectionAccess', {
  values: Object.values(DB.CollectionAccess),
})

// ----- ANSWER COLLECTIONS -----
// #region
export const AnswerCollectionEntryRef =
  builder.objectRef<DB.AnswerCollectionEntry>('AnswerCollectionEntry')
export const AnswerCollectionEntry = AnswerCollectionEntryRef.implement({
  fields: (t) => ({
    id: t.exposeInt('id'),
    value: t.exposeString('value'),
  }),
})

interface IAnswerCollection extends DB.AnswerCollection {
  entries?: DB.AnswerCollectionEntry[]
  ownerShortname?: string
  numSharedUsers?: number
}

export const AnswerCollectionRef =
  builder.objectRef<IAnswerCollection>('AnswerCollection')
export const AnswerCollection = AnswerCollectionRef.implement({
  fields: (t) => ({
    id: t.exposeInt('id'),
    name: t.exposeString('name'),
    access: t.expose('access', { type: CollectionAccess }),
    description: t.exposeString('description'),
    entries: t.expose('entries', {
      type: [AnswerCollectionEntryRef],
      nullable: true,
    }),
    ownerShortname: t.exposeString('ownerShortname', { nullable: true }),
    numSharedUsers: t.exposeInt('numSharedUsers', { nullable: true }),
  }),
})

interface IUserAnswerCollections {
  answerCollections: IAnswerCollection[]
  sharedCollections: IAnswerCollection[]
  requestedCollections: IAnswerCollection[]
}
export const UserAnswerCollectionsRef =
  builder.objectRef<IUserAnswerCollections>('UserAnswerCollections')
export const UserAnswerCollections = UserAnswerCollectionsRef.implement({
  fields: (t) => ({
    answerCollections: t.expose('answerCollections', {
      type: [AnswerCollectionRef],
    }),
    sharedCollections: t.expose('sharedCollections', {
      type: [AnswerCollectionRef],
    }),
    requestedCollections: t.expose('requestedCollections', {
      type: [AnswerCollectionRef],
    }),
  }),
})
// #endregion
