import * as DB from '@klicker-uzh/prisma/client'
import builder from '../builder.js'
import { ElementStatus, ElementType } from './elementData.js'
import { PermissionLevel, SharingType } from './sharing.js'

export interface ITag
  extends Omit<DB.Tag, 'ownerId' | 'createdAt' | 'updatedAt'> {}
export const TagRef = builder.objectRef<ITag>('Tag')
export const Tag = TagRef.implement({
  fields: (t) => ({
    id: t.exposeInt('id'),
    name: t.exposeString('name'),
    order: t.exposeInt('order'),
  }),
})

export interface IBaseElementProps extends Omit<DB.Element, 'ownerId'> {
  tags?: ITag[] | null
  permissionLevel?: DB.PermissionLevel
  derivedAccess?: boolean
  numSharedUsers?: number
  isOwner?: boolean
  isManager?: boolean
  isEditor?: boolean
  isImported?: boolean
  isShared?: boolean
  isRemovable?: boolean
}

export const sharedElementProps = (t: any) => ({
  id: t.exposeInt('id'),

  version: t.exposeInt('version'),
  name: t.exposeString('name'),
  status: t.expose('status', { type: ElementStatus }),
  type: t.expose('type', { type: ElementType }),
  content: t.exposeString('content'),
  explanation: t.exposeString('explanation', { nullable: true }),
  basePoints: t.exposeBoolean('basePoints'),
  pointsMultiplier: t.exposeInt('pointsMultiplier'),

  isArchived: t.exposeBoolean('isArchived', { nullable: true }),
  isDeleted: t.exposeBoolean('isDeleted', { nullable: true }),

  createdAt: t.expose('createdAt', { type: 'Date', nullable: true }),
  updatedAt: t.expose('updatedAt', { type: 'Date', nullable: true }),

  permissionLevel: t.expose('permissionLevel', {
    type: PermissionLevel,
    nullable: true,
  }),
  derivedAccess: t.exposeBoolean('derivedAccess', { nullable: true }),
  numSharedUsers: t.exposeInt('numSharedUsers', { nullable: true }),
  isOwner: t.exposeBoolean('isOwner', { nullable: true }),
  isManager: t.exposeBoolean('isManager', { nullable: true }),
  isEditor: t.exposeBoolean('isEditor', { nullable: true }),
  isImported: t.exposeBoolean('isImported', { nullable: true }),
  isShared: t.exposeBoolean('isShared', { nullable: true }),
  isRemovable: t.exposeBoolean('isRemovable', { nullable: true }),
  sharingType: t.expose('sharingType', { type: SharingType, nullable: true }),

  tags: t.expose('tags', {
    type: [TagRef],
    nullable: true,
  }),
})
