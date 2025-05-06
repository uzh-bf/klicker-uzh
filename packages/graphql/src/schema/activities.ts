import * as DB from '@klicker-uzh/prisma'
import { ActivityType as ActivityTypeEnum } from '@klicker-uzh/types'
import builder from '../builder.js'
import { ActivityType } from './analytics.js'
import { ElementType } from './elementData.js'
import { PublicationStatus } from './practiceQuiz.js'
import { PermissionLevel } from './sharing.js'

interface IActivityInfoElement {
  id: number
  name: string
  type: DB.ElementType
}

export const ActivityInfoElementRef = builder.objectRef<IActivityInfoElement>(
  'ActivityInfoElement'
)
export const ActivityInfoElement = builder.objectType(ActivityInfoElementRef, {
  name: 'ActivityInfoElement',
  fields: (t) => ({
    id: t.exposeInt('id'),
    name: t.exposeString('name'),
    type: t.expose('type', { type: ElementType }),
  }),
})

interface IActivityInfoStack {
  id: number
  numOfParticipants?: number | null
  elements: IActivityInfoElement[]
}

export const ActivityInfoStackRef =
  builder.objectRef<IActivityInfoStack>('ActivityInfoStack')
export const ActivityInfoStack = builder.objectType(ActivityInfoStackRef, {
  name: 'ActivityInfoStack',
  fields: (t) => ({
    id: t.exposeInt('id'),
    numOfParticipants: t.exposeInt('numOfParticipants', { nullable: true }),
    elements: t.expose('elements', { type: [ActivityInfoElement] }),
  }),
})

interface IActivityInfo {
  id: string
  templateId: string | null

  name: string
  displayName: string
  type: ActivityTypeEnum
  status: DB.PublicationStatus

  course?: string | null
  numOfStacks: number
  numOfElements: number
  stacks: IActivityInfoStack[]

  permissionLevel: DB.PermissionLevel
  derivedAccess: boolean
  isOwner: boolean
  isManager: boolean
  isEditor: boolean
  isShared: boolean
  isExecutor: boolean
  isRemovable: boolean
  updatedAt: Date
}

export const ActivityInfoRef = builder.objectRef<IActivityInfo>('ActivityInfo')
export const ActivityInfo = builder.objectType(ActivityInfoRef, {
  name: 'ActivityInfo',
  fields: (t) => ({
    id: t.exposeString('id'),
    templateId: t.exposeString('templateId', { nullable: true }),

    name: t.exposeString('name'),
    displayName: t.exposeString('displayName'),
    type: t.expose('type', { type: ActivityType }),
    status: t.expose('status', { type: PublicationStatus }),

    course: t.exposeString('course', { nullable: true }),
    numOfStacks: t.exposeInt('numOfStacks'),
    numOfElements: t.exposeInt('numOfElements'),
    stacks: t.expose('stacks', { type: [ActivityInfoStack] }),

    permissionLevel: t.expose('permissionLevel', { type: PermissionLevel }),
    derivedAccess: t.exposeBoolean('derivedAccess'),
    isOwner: t.exposeBoolean('isOwner'),
    isManager: t.exposeBoolean('isManager'),
    isEditor: t.exposeBoolean('isEditor'),
    isExecutor: t.exposeBoolean('isExecutor'),
    isShared: t.exposeBoolean('isShared'),
    isRemovable: t.exposeBoolean('isRemovable'),
    updatedAt: t.expose('updatedAt', { type: 'Date' }),
  }),
})
