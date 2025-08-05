import * as DB from '@klicker-uzh/prisma'
import {
  ActivityType as ActivityTypeEnum,
  SharingType as SharingTypeEnum,
} from '@klicker-uzh/types'
import builder from '../builder.js'
import { ActivityType } from './analytics.js'
import { Course, ICourse } from './course.js'
import { PublicationStatus } from './practiceQuiz.js'
import { ElementInstance, IElementInstance } from './question.js'
import { PermissionLevel, SharingType } from './sharing.js'
import { LocaleType } from './user.js'

interface IActivityInfoElement {
  basePoints?: number | null
  correctnessPoints?: number | null
  bonusPoints?: number | null
  totalPoints: number
  hasSampleSolution: boolean
  instance: IElementInstance
}

export const ActivityInfoElementRef = builder.objectRef<IActivityInfoElement>(
  'ActivityInfoElement'
)
export const ActivityInfoElement = builder.objectType(ActivityInfoElementRef, {
  name: 'ActivityInfoElement',
  fields: (t) => ({
    basePoints: t.exposeInt('basePoints', { nullable: true }),
    correctnessPoints: t.exposeInt('correctnessPoints', { nullable: true }),
    bonusPoints: t.exposeInt('bonusPoints', { nullable: true }),
    totalPoints: t.exposeInt('totalPoints'),
    hasSampleSolution: t.exposeBoolean('hasSampleSolution'),
    instance: t.expose('instance', {
      type: ElementInstance,
    }),
  }),
})

interface IActivityInfoStack {
  id: number
  numOfParticipants?: number | null
  timeLimit?: number | null
  stackPoints?: number | null
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
    stackPoints: t.exposeInt('stackPoints', { nullable: true }),
    elements: t.expose('elements', { type: [ActivityInfoElement] }),
  }),
})

export interface IUserActivityList {
  numOfActivities: number
  activities: IActivityInfo[]
}

export const UserActivityListRef =
  builder.objectRef<IUserActivityList>('UserActivityList')
export const UserActivityList = builder.objectType(UserActivityListRef, {
  name: 'UserActivityList',
  fields: (t) => ({
    numOfActivities: t.exposeInt('numOfActivities'),
    activities: t.expose('activities', { type: [ActivityInfo] }),
  }),
})

export interface IActivityInfo {
  id: string
  templateId?: string | null

  name: string
  displayName: string
  type: ActivityTypeEnum
  status: DB.PublicationStatus

  courseId?: string | null
  courseName?: string | null
  courseStartDate?: Date | null
  courseLanguage?: DB.Locale | null
  numOfStacks: number
  numOfElements: number
  automaticPublicationAt?: Date | null
  scheduledStartAt?: Date | null
  scheduledEndAt?: Date | null
  groupDeadlineDate?: Date | null
  numOfParticipantGroups?: number | null

  permissionLevel: DB.PermissionLevel
  derivedAccess: boolean
  areInstancesOutdated: boolean
  isGamificationEnabled?: boolean
  isAssessmentEnabled?: boolean

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
    courseLanguage: t.expose('courseLanguage', {
      type: LocaleType,
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

    permissionLevel: t.expose('permissionLevel', { type: PermissionLevel }),
    derivedAccess: t.exposeBoolean('derivedAccess'),
    areInstancesOutdated: t.exposeBoolean('areInstancesOutdated'),
    isGamificationEnabled: t.exposeBoolean('isGamificationEnabled', {
      nullable: true,
    }),
    isAssessmentEnabled: t.exposeBoolean('isAssessmentEnabled', {
      nullable: true,
    }),

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

export interface IReducedActivityInfo {
  id: string
  name: string
  displayName: string
  status: DB.PublicationStatus

  course?: ICourse | null
  scheduledStartAt?: Date | null
  scheduledEndAt?: Date | null
  automaticPublicationAt?: Date | null
}

export const ReducedActivityInfoRef = builder.objectRef<IReducedActivityInfo>(
  'ReducedActivityInfo'
)
export const ReducedActivityInfo = builder.objectType(ReducedActivityInfoRef, {
  name: 'ReducedActivityInfo',
  fields: (t) => ({
    id: t.exposeString('id'),
    name: t.exposeString('name'),
    displayName: t.exposeString('displayName'),
    status: t.expose('status', { type: PublicationStatus }),

    course: t.expose('course', { type: Course, nullable: true }),
    scheduledStartAt: t.expose('scheduledStartAt', {
      type: 'Date',
      nullable: true,
    }),
    scheduledEndAt: t.expose('scheduledEndAt', {
      type: 'Date',
      nullable: true,
    }),
    automaticPublicationAt: t.expose('automaticPublicationAt', {
      type: 'Date',
      nullable: true,
    }),
  }),
})

export interface IActivityDetails {
  id: string
  name: string
  displayName: string
  arePointsAwarded: boolean
  pointsMultiplier: number
  totalBasePoints?: number | null
  totalCorrectnessPoints?: number | null
  totalBonusPoints?: number | null
  totalPoints: number
  stacks: IActivityInfoStack[]
}

export const ActivityDetailsRef =
  builder.objectRef<IActivityDetails>('ActivityDetails')
export const ActivityDetails = builder.objectType(ActivityDetailsRef, {
  name: 'ActivityDetails',
  fields: (t) => ({
    id: t.exposeString('id'),
    name: t.exposeString('name'),
    displayName: t.exposeString('displayName'),
    arePointsAwarded: t.exposeBoolean('arePointsAwarded'),
    pointsMultiplier: t.exposeInt('pointsMultiplier'),
    totalBasePoints: t.exposeInt('totalBasePoints', { nullable: true }),
    totalCorrectnessPoints: t.exposeInt('totalCorrectnessPoints', {
      nullable: true,
    }),
    totalBonusPoints: t.exposeInt('totalBonusPoints', { nullable: true }),
    totalPoints: t.exposeInt('totalPoints'),
    stacks: t.expose('stacks', { type: [ActivityInfoStack] }),
  }),
})
