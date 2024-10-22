import * as DB from '@klicker-uzh/prisma'
import dayjs from 'dayjs'
import builder from '../builder.js'
import { type IGroupActivity, GroupActivityRef } from './groupActivity.js'
import { type IMicroLearning, MicroLearningRef } from './microLearning.js'
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
import { type IPracticeQuiz, PracticeQuizRef } from './practiceQuizzes.js'
import { type ISession, SessionRef } from './session.js'
import { type IUser, UserRef } from './user.js'

export interface ICourse extends DB.Course {
  numOfParticipants?: number
  numOfActiveParticipants?: number
  numOfParticipantGroups?: number
  averageScore?: number
  averageActiveScore?: number
  isGroupDeadlinePassed?: boolean
  sessions?: ISession[]
  practiceQuizzes?: IPracticeQuiz[]
  microLearnings?: IMicroLearning[]
  participantGroups?: IParticipantGroup[]
  groupAssignmentPoolEntries?: IGroupAssignmentPoolEntryRef[]
  groupActivities?: IGroupActivity[]
  leaderboard?: ILeaderboardEntry[]
  awards?: IAwardEntry[]
  owner?: IUser
}
export const CourseRef = builder.objectRef<ICourse>('Course')
export const Course = builder.objectType(CourseRef, {
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
    displayName: t.exposeString('displayName'),

    pinCode: t.exposeInt('pinCode', { nullable: true }),

    color: t.exposeString('color'),
    description: t.exposeString('description', { nullable: true }),
    isArchived: t.exposeBoolean('isArchived'),
    isGamificationEnabled: t.exposeBoolean('isGamificationEnabled'),

    numOfParticipants: t.exposeInt('numOfParticipants', {
      nullable: true,
    }),
    numOfActiveParticipants: t.exposeInt('numOfActiveParticipants', {
      nullable: true,
    }),
    numOfParticipantGroups: t.exposeInt('numOfParticipantGroups', {
      nullable: true,
    }),

    averageScore: t.exposeFloat('averageScore', {
      nullable: true,
    }),

    averageActiveScore: t.exposeFloat('averageActiveScore', {
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

    sessions: t.expose('sessions', {
      type: [SessionRef],
      nullable: true,
    }),
    practiceQuizzes: t.expose('practiceQuizzes', {
      type: [PracticeQuizRef],
      nullable: true,
    }),
    microLearnings: t.expose('microLearnings', {
      type: [MicroLearningRef],
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
      type: [GroupActivityRef],
      nullable: true,
    }),
    leaderboard: t.expose('leaderboard', {
      type: [LeaderboardEntryRef],
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

    owner: t.expose('owner', {
      type: UserRef,
    }),
  }),
})

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
  level: number
  participant?: IParticipant
  participation?: IParticipation
  courseId?: string | null
  sessionId?: string | null
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
    level: t.exposeInt('level'),

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
