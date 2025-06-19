import * as DB from '@klicker-uzh/prisma'
import {
  ActivityType as ActivityTypeEnum,
  SharingType as SharingTypeEnum,
} from '@klicker-uzh/types'
import builder from '../builder.js'
import { ActivityType } from './analytics.js'
import { ElementType } from './elementData.js'
import { PublicationStatus } from './practiceQuiz.js'
import { PermissionLevel, SharingType } from './sharing.js'

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
  timeLimit?: number | null
  elements: IActivityInfoElement[]
}

export const ActivityInfoStackRef =
  builder.objectRef<IActivityInfoStack>('ActivityInfoStack')
export const ActivityInfoStack = builder.objectType(ActivityInfoStackRef, {
  name: 'ActivityInfoStack',
  fields: (t) => ({
    id: t.exposeInt('id'),
    numOfParticipants: t.exposeInt('numOfParticipants', { nullable: true }),
    timeLimit: t.exposeInt('timeLimit', { nullable: true }),
    elements: t.expose('elements', { type: [ActivityInfoElement] }),
  }),
})

export interface IActivityInfo {
  id: string
  templateId: string | null

  name: string
  displayName: string
  type: ActivityTypeEnum
  status: DB.PublicationStatus

  courseId?: string | null
  courseName?: string | null
  courseStartDate?: Date | null
  numOfStacks: number
  numOfElements: number
  automaticPublicationAt?: Date | null
  scheduledStartAt?: Date | null
  scheduledEndAt?: Date | null
  groupDeadlineDate?: Date | null
  numOfParticipantGroups?: number | null

  stacks: IActivityInfoStack[]

  permissionLevel: DB.PermissionLevel
  derivedAccess: boolean
  numSharedUsers?: number
  isOwner: boolean
  isManager: boolean
  isEditor: boolean
  isShared: boolean
  isExecutor: boolean
  isRemovable: boolean
  sharingType: SharingTypeEnum

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

    courseId: t.exposeString('courseId', { nullable: true }),
    courseName: t.exposeString('courseName', { nullable: true }),
    courseStartDate: t.expose('courseStartDate', {
      type: 'Date',
      nullable: true,
    }),

    numOfStacks: t.exposeInt('numOfStacks'),
    numOfElements: t.exposeInt('numOfElements'),
    automaticPublicationAt: t.expose('automaticPublicationAt', {
      type: 'Date',
      nullable: true,
    }),
    scheduledStartAt: t.expose('scheduledStartAt', {
      type: 'Date',
      nullable: true,
    }),
    scheduledEndAt: t.expose('scheduledEndAt', {
      type: 'Date',
      nullable: true,
    }),
    groupDeadlineDate: t.expose('groupDeadlineDate', {
      type: 'Date',
      nullable: true,
    }),
    numOfParticipantGroups: t.exposeInt('numOfParticipantGroups', {
      nullable: true,
    }),

    stacks: t.expose('stacks', { type: [ActivityInfoStack] }),

    permissionLevel: t.expose('permissionLevel', { type: PermissionLevel }),
    derivedAccess: t.exposeBoolean('derivedAccess'),
    numSharedUsers: t.exposeInt('numSharedUsers', { nullable: true }),
    isOwner: t.exposeBoolean('isOwner'),
    isManager: t.exposeBoolean('isManager'),
    isEditor: t.exposeBoolean('isEditor'),
    isExecutor: t.exposeBoolean('isExecutor'),
    isShared: t.exposeBoolean('isShared'),
    isRemovable: t.exposeBoolean('isRemovable'),
    sharingType: t.expose('sharingType', { type: SharingType }),

    updatedAt: t.expose('updatedAt', { type: 'Date' }),
  }),
})
