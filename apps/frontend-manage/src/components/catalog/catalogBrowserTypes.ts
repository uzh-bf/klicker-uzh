import type { ObjectAccess, ObjectType } from '@lib/constants/catalogEnums'
import type { RouterOutputs } from '../../lib/trpc'

type SharingOutputs = RouterOutputs['sharing']

export type CatalogBrowserCollection = Omit<
  SharingOutputs['catalogCollections']['catalogCollections'][number],
  'access'
> & {
  access: ObjectAccess
}

export type CatalogBrowserObject = Omit<
  SharingOutputs['catalogObjects']['catalogObjects'][number],
  'access' | 'objectType'
> & {
  access: ObjectAccess
  objectType: ObjectType
}
