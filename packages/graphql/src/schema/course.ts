import * as DB from '@klicker-uzh/prisma/client'
import dayjs from 'dayjs'
import builder from '../builder.js'
import {
  ActivityInfo,
  IActivityInfo,
  IReducedActivityInfo,
  ReducedActivityInfo,
} from './activities.js'
import { GroupActivity, IGroupActivity } from './groupActivity.js'
import { ILiveQuiz, LiveQuiz } from './liveQuiz.js'
import { IMicroLearning, MicroLearning } from './microLearning.js'
import {
  type IGroupAssignmentPoolEntryRef,
  type IParticipant,
  type IParticipantGroup,
  type IParticipation,
  GroupAssignmentPoolEntryRef,
  ParticipantGroupRef,
  ParticipantRef,
  ParticipationRef,
} from './participant.js'
import { IPracticeQuiz, PracticeQuiz } from './practiceQuiz.js'
import { PermissionLevel } from './sharing.js'
import { type IUser, LocaleType, UserRef } from './user.js'

export interface ICourse extends DB.Course {
  numOfParticipants?: number
  numOfParticipantGroups?: number
  averageScore?: number
  isGroupDeadlinePassed?: boolean
  liveQuizzes?: ILiveQuiz[] | null
  liveQuizzesInfo?: IActivityInfo[] | null
  practiceQuizzes?: IPracticeQuiz[] | null
  practiceQuizzesInfo?: IActivityInfo[] | null
  microLearnings?: IMicroLearning[] | null
  microLearningsInfo?: IActivityInfo[] | null
  participantGroups?: IParticipantGroup[]
  groupAssignmentPoolEntries?: IGroupAssignmentPoolEntryRef[]
  groupActivities?: IGroupActivity[] | null
  groupActivitiesInfo?: IActivityInfo[] | null
  awards?: IAwardEntry[]
  owner?: IUser

  permissionLevel?: DB.PermissionLevel
  derivedAccess?: boolean // = derived from other object => removal disabled
  numSharedUsers?: number
  isOwner?: boolean // = OWNER
  isManager?: boolean // = OWNER / ADMIN
  isEditor?: boolean // = OWNER / ADMIN / WRITE
  isShared?: boolean // flag to signal whether the object is owned or shared
  isRemovable?: boolean // = derived from other object / direct user group permission => removal disabled
}
export const CourseRef = builder.objectRef<ICourse>('Course')
export const Course = builder.objectType(CourseRef, {
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
    displayName: t.exposeString('displayName'),

    pinCode: t.exposeInt('pinCode', { nullable: true }),

    language: t.expose('language', { type: LocaleType }),
    color: t.exposeString('color'),
    description: t.exposeString('description', { nullable: true }),
    isArchived: t.exposeBoolean('isArchived'),
    isGamificationEnabled: t.exposeBoolean('isGamificationEnabled'),
    isAssessmentEnabled: t.exposeBoolean('isAssessmentEnabled'),
    isLearningAnalyticsEnabled: t.exposeBoolean('isLearningAnalyticsEnabled'),

    numOfParticipants: t.exposeInt('numOfParticipants', {
      nullable: true,
    }),
    numOfParticipantGroups: t.exposeInt('numOfParticipantGroups', {
      nullable: true,
    }),

    averageScore: t.exposeFloat('averageScore', {
      nullable: true,
    }),

    startDate: t.expose('startDate', { type: 'Date' }),
    endDate: t.expose('endDate', { type: 'Date' }),

    isGroupCreationEnabled: t.exposeBoolean('isGroupCreationEnabled'),
    groupDeadlineDate: t.expose('groupDeadlineDate', {
      type: 'Date',
      nullable: true,
    }),
    maxGroupSize: t.exposeInt('maxGroupSize'),
    preferredGroupSize: t.exposeInt('preferredGroupSize'),
    randomAssignmentFinalized: t.exposeBoolean('randomAssignmentFinalized'),

    notificationEmail: t.exposeString('notificationEmail', {
      nullable: true,
    }),

    isGroupDeadlinePassed: t.boolean({
      resolve(course: ICourse) {
        if (typeof course.groupDeadlineDate === 'undefined') return null
        return dayjs().isAfter(course.groupDeadlineDate)
      },
      nullable: true,
    }),

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
    isShared: t.exposeBoolean('isShared', { nullable: true }),
    isRemovable: t.exposeBoolean('isRemovable', { nullable: true }),

    // liveQuizzes: t.expose('liveQuizzes', {
    //   type: [ActivityInfoRef],
    //   nullable: true,
    // }),
    // practiceQuizzes: t.expose('practiceQuizzes', {
    //   type: [ActivityInfoRef],
    //   nullable: true,
    // }),
    // microLearnings: t.expose('microLearnings', {
    //   type: [ActivityInfoRef],
    //   nullable: true,
    // }),
    liveQuizzes: t.expose('liveQuizzes', {
      type: [LiveQuiz],
      nullable: true,
    }),
    liveQuizzesInfo: t.expose('liveQuizzesInfo', {
      type: [ActivityInfo],
      nullable: true,
    }),
    practiceQuizzes: t.expose('practiceQuizzes', {
      type: [PracticeQuiz],
      nullable: true,
    }),
    practiceQuizzesInfo: t.expose('practiceQuizzesInfo', {
      type: [ActivityInfo],
      nullable: true,
    }),
    microLearnings: t.expose('microLearnings', {
      type: [MicroLearning],
      nullable: true,
    }),
    microLearningsInfo: t.expose('microLearningsInfo', {
      type: [ActivityInfo],
      nullable: true,
    }),
    participantGroups: t.expose('participantGroups', {
      type: [ParticipantGroupRef],
      nullable: true,
    }),
    groupAssignmentPoolEntries: t.expose('groupAssignmentPoolEntries', {
      type: [GroupAssignmentPoolEntryRef],
      nullable: true,
    }),

    groupActivities: t.expose('groupActivities', {
      type: [GroupActivity],
      nullable: true,
    }),
    groupActivitiesInfo: t.expose('groupActivitiesInfo', {
      type: [ActivityInfo],
      nullable: true,
    }),
    awards: t.expose('awards', {
      type: [AwardEntryRef],
      nullable: true,
    }),
    owner: t.expose('owner', {
      type: UserRef,
      nullable: true,
    }),
  }),
})

export interface ICourseListEntry {
  id: string
  name: string
}
export const CourseListEntryRef =
  builder.objectRef<ICourseListEntry>('CourseListEntry')
export const CourseListEntry = builder.objectType(CourseListEntryRef, {
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
  }),
})

export interface ICourseOverview extends DB.Course {
  liveQuizzes?: IReducedActivityInfo[] | null
  practiceQuizzes?: IReducedActivityInfo[] | null
  microLearnings?: IReducedActivityInfo[] | null
  groupActivities?: IReducedActivityInfo[] | null
}

export const CourseOverviewRef =
  builder.objectRef<ICourseOverview>('CourseOverview')
export const CourseOverview = builder.objectType(CourseOverviewRef, {
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name', { nullable: true }),
    displayName: t.exposeString('displayName'),
    color: t.exposeString('color', { nullable: true }),
    description: t.exposeString('description', { nullable: true }),

    liveQuizzes: t.expose('liveQuizzes', {
      type: [ReducedActivityInfo],
      nullable: true,
    }),
    practiceQuizzes: t.expose('practiceQuizzes', {
      type: [ReducedActivityInfo],
      nullable: true,
    }),
    microLearnings: t.expose('microLearnings', {
      type: [ReducedActivityInfo],
      nullable: true,
    }),
    groupActivities: t.expose('groupActivities', {
      type: [ReducedActivityInfo],
      nullable: true,
    }),
  }),
})

export interface CourseLeaderboard {
  leaderboard: ILeaderboardEntry[]
  numOfActiveParticipants: number
  averageActiveScore: number
  computedAt?: Date
}
export const CourseLeaderboardRef =
  builder.objectRef<CourseLeaderboard>('CourseLeaderboard')
export const CourseLeaderboard = CourseLeaderboardRef.implement({
  fields: (t) => ({
    leaderboard: t.expose('leaderboard', {
      type: [LeaderboardEntryRef],
    }),
    numOfActiveParticipants: t.exposeInt('numOfActiveParticipants'),
    averageActiveScore: t.exposeFloat('averageActiveScore'),
    computedAt: t.expose('computedAt', { type: 'Date', nullable: true }),
  }),
})

export interface ICourseSummary {
  numOfParticipations: number
  numOfLiveQuizzes: number
  numOfPracticeQuizzes: number
  numOfMicroLearnings: number
  numOfGroupActivities: number
  numOfLeaderboardEntries: number
  numOfParticipantGroups: number
}
export const CourseSummaryRef =
  builder.objectRef<ICourseSummary>('CourseSummary')
export const CourseSummary = CourseSummaryRef.implement({
  fields: (t) => ({
    numOfParticipations: t.exposeInt('numOfParticipations'),
    numOfLiveQuizzes: t.exposeInt('numOfLiveQuizzes'),
    numOfPracticeQuizzes: t.exposeInt('numOfPracticeQuizzes'),
    numOfMicroLearnings: t.exposeInt('numOfMicroLearnings'),
    numOfGroupActivities: t.exposeInt('numOfGroupActivities'),
    numOfLeaderboardEntries: t.exposeInt('numOfLeaderboardEntries'),
    numOfParticipantGroups: t.exposeInt('numOfParticipantGroups'),
  }),
})

export interface IStudentCourse extends DB.Course {
  owner: IUser
}
export const StudentCourseRef =
  builder.objectRef<IStudentCourse>('StudentCourse')
export const StudentCourse = builder.objectType(StudentCourseRef, {
  fields: (t) => ({
    id: t.exposeID('id'),
    displayName: t.exposeString('displayName'),
    pinCode: t.exposeInt('pinCode', { nullable: true }),
    color: t.exposeString('color'),
    description: t.exposeString('description', { nullable: true }),
    isLearningAnalyticsEnabled: t.exposeBoolean('isLearningAnalyticsEnabled'),

    owner: t.expose('owner', {
      type: UserRef,
    }),
  }),
})

export interface ICourseStudentTimeline {
  courseId: string
  courseName: string
  courseGamified: boolean
  courseStart: Date
  courseEnd: Date
  timelineEntries: {
    timestamp: Date
    collectedPoints?: number
    collectedXp: number
    totalPoints?: number
    totalXp: number
  }[]
}
export const CourseStudentTimelineEntryRef = builder.objectRef<
  ICourseStudentTimeline['timelineEntries'][0]
>('CourseStudentTimelineEntry')
export const CourseStudentTimelineEntry =
  CourseStudentTimelineEntryRef.implement({
    fields: (t) => ({
      timestamp: t.expose('timestamp', { type: 'Date' }),
      collectedPoints: t.exposeFloat('collectedPoints', { nullable: true }),
      collectedXp: t.exposeFloat('collectedXp'),
      totalPoints: t.exposeFloat('totalPoints', { nullable: true }),
      totalXp: t.exposeFloat('totalXp'),
    }),
  })

export const CourseStudentTimelineRef =
  builder.objectRef<ICourseStudentTimeline>('CourseStudentTimeline')
export const CourseStudentTimeline = CourseStudentTimelineRef.implement({
  fields: (t) => ({
    courseId: t.exposeID('courseId'),
    courseName: t.exposeString('courseName'),
    courseGamified: t.exposeBoolean('courseGamified'),
    courseStart: t.expose('courseStart', { type: 'Date' }),
    courseEnd: t.expose('courseEnd', { type: 'Date' }),
    timelineEntries: t.expose('timelineEntries', {
      type: [CourseStudentTimelineEntryRef],
    }),
  }),
})

export const LiveQuizSelectionItemRef = builder.objectRef<{
  id: string
  name: string
  displayName: string
  instances: { id: string; name: string }[]
}>('LiveQuizSelectionItem')
export const LiveQuizSelectionItem = builder.objectType(
  LiveQuizSelectionItemRef,
  {
    fields: (t) => ({
      id: t.exposeString('id'),
      name: t.exposeString('name'),
      displayName: t.exposeString('displayName'),
      instances: t.expose('instances', {
        type: [ElementInstanceSelectionItemRef],
      }),
    }),
  }
)

export const ElementInstanceSelectionItemRef = builder.objectRef<{
  id: string // stringified version of instance id for compatibility with select fields
  name: string
}>('ElementInstanceSelectionItem')
export const ElementInstanceSelectionItem = builder.objectType(
  ElementInstanceSelectionItemRef,
  {
    fields: (t) => ({
      id: t.exposeString('id'),
      name: t.exposeString('name'),
    }),
  }
)

export const AssessmentParticipantRef = builder.objectRef<{
  id: string
  email: string
}>('AssessmentParticipant')
export const AssessmentParticipant = builder.objectType(
  AssessmentParticipantRef,
  {
    fields: (t) => ({
      id: t.exposeString('id'),
      email: t.exposeString('email'),
    }),
  }
)

// ! GAMIFICATION
// #region
export interface ILeaderboardEntry
  extends Omit<
    DB.LeaderboardEntry,
    'courseId' | 'sessionId' | 'liveQuizId' | 'type' | 'sessionParticipationId'
  > {
  username: string
  email?: string | null
  avatar?: string | null
  rank: number
  lastBlockOrder?: number
  isSelf?: boolean
  isTemporary?: boolean // true for temporary participants, false for regular participants
  level?: number
  participant?: IParticipant
  participation?: IParticipation
  courseId?: string | null
  liveQuizId?: string | null
  sessionParticipationId?: string | null
  type?: string | null // TODO: specify custom leaderboard type enum here
}
export const LeaderboardEntryRef =
  builder.objectRef<ILeaderboardEntry>('LeaderboardEntry')
export const LeaderboardEntry = LeaderboardEntryRef.implement({
  fields: (t) => ({
    id: t.exposeInt('id'),

    score: t.exposeFloat('score'),
    username: t.exposeString('username'),
    email: t.exposeString('email', { nullable: true }),
    avatar: t.exposeString('avatar', { nullable: true }),
    rank: t.exposeInt('rank'),
    lastBlockOrder: t.exposeInt('lastBlockOrder', { nullable: true }),
    isSelf: t.exposeBoolean('isSelf', {
      nullable: true,
    }),
    isTemporary: t.exposeBoolean('isTemporary', {
      nullable: true,
    }),
    level: t.exposeInt('level', { nullable: true }),

    participant: t.expose('participant', {
      type: ParticipantRef,
      nullable: true,
    }),
    participantId: t.exposeString('participantId'),
    participation: t.expose('participation', {
      type: ParticipationRef,
      nullable: true,
    }),
  }),
})

export interface ILeaderboardStatistics {
  participantCount: number
  averageScore: number
}
export const LeaderboardStatistics = builder
  .objectRef<ILeaderboardStatistics>('LeaderboardStatistics')
  .implement({
    fields: (t) => ({
      participantCount: t.exposeInt('participantCount'),
      averageScore: t.exposeFloat('averageScore'),
    }),
  })

export interface IGroupLeaderboardEntry {
  id: string
  name: string
  score: number
  rank: number
  isMember?: boolean
}
export const GroupLeaderboardEntry = builder
  .objectRef<IGroupLeaderboardEntry>('GroupLeaderboardEntry')
  .implement({
    fields: (t) => ({
      id: t.exposeID('id'),
      name: t.exposeString('name'),
      score: t.exposeFloat('score'),
      rank: t.exposeInt('rank'),
      isMember: t.exposeBoolean('isMember', { nullable: true }),
    }),
  })

export interface IAwardEntry extends DB.AwardEntry {
  participant?: IParticipant | null
  participantGroup?: IParticipantGroup | null
}
export const AwardEntryRef = builder.objectRef<IAwardEntry>('AwardEntry')
export const AwardEntry = AwardEntryRef.implement({
  fields: (t) => ({
    id: t.exposeInt('id'),

    order: t.exposeInt('order'),
    type: t.exposeString('type'),
    name: t.exposeString('name'),
    displayName: t.exposeString('displayName'),
    description: t.exposeString('description'),

    participant: t.expose('participant', {
      type: ParticipantRef,
      nullable: true,
    }),

    participantGroup: t.expose('participantGroup', {
      type: ParticipantGroupRef,
      nullable: true,
    }),
  }),
})
// #endregion
