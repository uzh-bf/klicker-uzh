import * as DB from '@klicker-uzh/prisma'
import { ActivityType as ActivityTypeEnum } from '@klicker-uzh/types'
import builder from '../builder.js'
import { ElementType } from './elementData.js'

export const ActivityLevel = builder.enumType('ActivityLevel', {
  values: Object.values(DB.ActivityLevel),
})

export const ActivityType = builder.enumType('ActivityType', {
  values: Object.values(ActivityTypeEnum),
})

// ------ Activity Analytics ------
// #region
export const ElementFeedbackRef =
  builder.objectRef<DB.ElementFeedback>('ElementFeedback')
export const ElementFeedback = builder.objectType(ElementFeedbackRef, {
  fields: (t) => ({
    id: t.exposeInt('id'),
    upvote: t.exposeBoolean('upvote'),
    downvote: t.exposeBoolean('downvote'),
    feedback: t.exposeString('feedback', { nullable: true }),
    elementInstanceId: t.exposeInt('elementInstanceId'),
  }),
})

interface IParticipantActivityTimestamp {
  date: Date
  activeParticipants: number
}
export const ParticipantActivityTimestampRef =
  builder.objectRef<IParticipantActivityTimestamp>(
    'ParticipantActivityTimestamp'
  )
export const ParticipantActivityTimestamp = builder.objectType(
  ParticipantActivityTimestampRef,
  {
    fields: (t) => ({
      date: t.expose('date', { type: 'Date' }),
      activeParticipants: t.exposeInt('activeParticipants'),
    }),
  }
)

interface IWeekdayActivityAnalytics {
  monday: number
  tuesday: number
  wednesday: number
  thursday: number
  friday: number
  saturday: number
  sunday: number
}
export const WeekdayActivityAnalyticsRef =
  builder.objectRef<IWeekdayActivityAnalytics>('WeekdayActivityAnalytics')
export const WeekdayActivityAnalytics = builder.objectType(
  WeekdayActivityAnalyticsRef,
  {
    fields: (t) => ({
      monday: t.exposeFloat('monday'),
      tuesday: t.exposeFloat('tuesday'),
      wednesday: t.exposeFloat('wednesday'),
      thursday: t.exposeFloat('thursday'),
      friday: t.exposeFloat('friday'),
      saturday: t.exposeFloat('saturday'),
      sunday: t.exposeFloat('sunday'),
    }),
  }
)

interface IParticipantCourseActivity {
  activeWeeks: number
  activeDaysPerWeek: number
  meanElementsPerDay: number
  activityLevel: DB.ActivityLevel
}

export const ParticipantCourseActivityRef =
  builder.objectRef<IParticipantCourseActivity>('ParticipantCourseActivity')
export const ParticipantCourseActivity = builder.objectType(
  ParticipantCourseActivityRef,
  {
    fields: (t) => ({
      activeWeeks: t.exposeInt('activeWeeks'),
      activeDaysPerWeek: t.exposeFloat('activeDaysPerWeek'),
      meanElementsPerDay: t.exposeFloat('meanElementsPerDay'),
      activityLevel: t.expose('activityLevel', { type: ActivityLevel }),
    }),
  }
)

interface ICourseActivityAnalytics {
  name: string
  courseWeeks: number
  totalParticipants: number
  dailyActivity: IParticipantActivityTimestamp[]
  weeklyActivity: IParticipantActivityTimestamp[]
  activeDays: IWeekdayActivityAnalytics
  participantCourseAnalytics: IParticipantCourseActivity[]
}
export const CourseActivityAnalyticsRef =
  builder.objectRef<ICourseActivityAnalytics>('CourseActivityAnalytics')
export const CourseActivityAnalytics = builder.objectType(
  CourseActivityAnalyticsRef,
  {
    fields: (t) => ({
      name: t.exposeString('name'),
      courseWeeks: t.exposeInt('courseWeeks'),
      totalParticipants: t.exposeInt('totalParticipants'),
      dailyActivity: t.expose('dailyActivity', {
        type: [ParticipantActivityTimestamp],
      }),
      weeklyActivity: t.expose('weeklyActivity', {
        type: [ParticipantActivityTimestamp],
      }),
      activeDays: t.expose('activeDays', { type: WeekdayActivityAnalytics }),
      participantCourseAnalytics: t.expose('participantCourseAnalytics', {
        type: [ParticipantCourseActivity],
      }),
    }),
  }
)

interface IWeeklyCourseActivities {
  totalParticipants: number
  weeklyActivity: IParticipantActivityTimestamp[]
}
export const WeeklyCourseActivitiesRef =
  builder.objectRef<IWeeklyCourseActivities>('WeeklyCourseActivities')
export const WeeklyCourseActivities = builder.objectType(
  WeeklyCourseActivitiesRef,
  {
    fields: (t) => ({
      totalParticipants: t.exposeInt('totalParticipants'),
      weeklyActivity: t.expose('weeklyActivity', {
        type: [ParticipantActivityTimestamp],
      }),
    }),
  }
)
// #endregion

// ------ Performance & Progress Analytics ------
// #region
interface IActivityProgress {
  activityName: string
  activityType: ActivityTypeEnum
  startedCount: number
  completedCount: number
  repeatedCount?: number | null
}
export const ActivityProgressRef =
  builder.objectRef<IActivityProgress>('ActivityProgress')
export const ActivityProgress = builder.objectType(ActivityProgressRef, {
  fields: (t) => ({
    activityName: t.exposeString('activityName'),
    activityType: t.expose('activityType', { type: ActivityType }),
    startedCount: t.exposeInt('startedCount'),
    completedCount: t.exposeInt('completedCount'),
    repeatedCount: t.exposeInt('repeatedCount', { nullable: true }),
  }),
})

interface IActivityErrorRate {
  activityName: string
  activityType: ActivityTypeEnum
  errorRate: number
  partialRate: number
  correctRate: number
}
export const ActivityErrorRateRef =
  builder.objectRef<IActivityErrorRate>('ActivityErrorRate')
export const ActivityErrorRate = builder.objectType(ActivityErrorRateRef, {
  fields: (t) => ({
    activityName: t.exposeString('activityName'),
    activityType: t.expose('activityType', { type: ActivityType }),
    errorRate: t.exposeFloat('errorRate'),
    partialRate: t.exposeFloat('partialRate'),
    correctRate: t.exposeFloat('correctRate'),
  }),
})

interface IInstanceErrorRate {
  elementName: string
  elementType: DB.ElementType
  errorRate: number
  partialRate: number
  correctRate: number
}
export const InstanceErrorRateRef =
  builder.objectRef<IInstanceErrorRate>('InstanceErrorRate')
export const InstanceErrorRate = builder.objectType(InstanceErrorRateRef, {
  fields: (t) => ({
    elementName: t.exposeString('elementName'),
    elementType: t.expose('elementType', { type: ElementType }),
    errorRate: t.exposeFloat('errorRate'),
    partialRate: t.exposeFloat('partialRate'),
    correctRate: t.exposeFloat('correctRate'),
  }),
})

interface ICoursePerformanceAnalytics {
  name: string
  totalParticipants: number
  activityProgresses: IActivityProgress[]
  activityErrorRates: IActivityErrorRate[]
  instanceErrorRates: IInstanceErrorRate[]
}
export const CoursePerformanceAnalyticsRef =
  builder.objectRef<ICoursePerformanceAnalytics>('CoursePerformanceAnalytics')
export const CoursePerformanceAnalytics = builder.objectType(
  CoursePerformanceAnalyticsRef,
  {
    fields: (t) => ({
      name: t.exposeString('name'),
      totalParticipants: t.exposeInt('totalParticipants'),
      activityProgresses: t.expose('activityProgresses', {
        type: [ActivityProgress],
      }),
      activityErrorRates: t.expose('activityErrorRates', {
        type: [ActivityErrorRate],
      }),
      instanceErrorRates: t.expose('instanceErrorRates', {
        type: [InstanceErrorRate],
      }),
    }),
  }
)
// #endregion
