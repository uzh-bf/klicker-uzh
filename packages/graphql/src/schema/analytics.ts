import * as DB from '@klicker-uzh/prisma'
import {
  ActivityPerformance as ActivityPerformanceType,
  ActivityType as ActivityTypeEnum,
  InstancePerformance as InstancePerformanceType,
  ParticipantPerformance as ParticipantPerformanceType,
  PerformanceRates as PerformanceRatesType,
} from '@klicker-uzh/types'
import builder from '../builder.js'
import { ElementType } from './elementData.js'

export const ActivityLevel = builder.enumType('ActivityLevel', {
  values: Object.values(DB.ActivityLevel),
})

export const ActivityType = builder.enumType('ActivityType', {
  values: Object.values(ActivityTypeEnum),
})

export const PerformanceLevel = builder.enumType('PerformanceLevel', {
  values: Object.values(DB.PerformanceLevel),
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

export const PerformanceRatesRef =
  builder.objectRef<PerformanceRatesType>('PerformanceRates')
export const PerformanceRates = builder.objectType(PerformanceRatesRef, {
  fields: (t) => ({
    firstErrorRate: t.exposeFloat('firstErrorRate'),
    lastErrorRate: t.exposeFloat('lastErrorRate'),
    errorRate: t.exposeFloat('errorRate'),
    firstPartialRate: t.exposeFloat('firstPartialRate'),
    lastPartialRate: t.exposeFloat('lastPartialRate'),
    partialRate: t.exposeFloat('partialRate'),
    firstCorrectRate: t.exposeFloat('firstCorrectRate'),
    lastCorrectRate: t.exposeFloat('lastCorrectRate'),
    correctRate: t.exposeFloat('correctRate'),
  }),
})

export const ActivityPerformanceRef =
  builder.objectRef<ActivityPerformanceType>('ActivityPerformance')
export const ActivityPerformance = builder.objectType(ActivityPerformanceRef, {
  fields: (t) => ({
    id: t.exposeInt('id'),
    activityName: t.exposeString('activityName'),
    activityType: t.expose('activityType', { type: ActivityType }),
    rates: t.expose('rates', { type: PerformanceRates }),
  }),
})

export const InstancePerformanceRef =
  builder.objectRef<InstancePerformanceType>('InstancePerformance')
export const InstancePerformance = builder.objectType(InstancePerformanceRef, {
  fields: (t) => ({
    id: t.exposeInt('id'),
    elementName: t.exposeString('elementName'),
    elementType: t.expose('elementType', { type: ElementType }),
    rates: t.expose('rates', { type: PerformanceRates }),
  }),
})

export const ParticipantPerformanceRef =
  builder.objectRef<ParticipantPerformanceType>('ParticipantPerformance')
export const ParticipantPerformance = builder.objectType(
  ParticipantPerformanceRef,
  {
    fields: (t) => ({
      id: t.exposeInt('id'),
      firstErrorRate: t.exposeFloat('firstErrorRate'),
      firstPerformance: t.expose('firstPerformance', {
        type: PerformanceLevel,
      }),
      lastErrorRate: t.exposeFloat('lastErrorRate'),
      lastPerformance: t.expose('lastPerformance', { type: PerformanceLevel }),
      totalErrorRate: t.exposeFloat('totalErrorRate'),
      totalPerformance: t.expose('totalPerformance', {
        type: PerformanceLevel,
      }),
    }),
  }
)

interface ICoursePerformanceAnalytics {
  name: string
  totalParticipants: number
  activityProgresses: IActivityProgress[]
  activityPerformances: ActivityPerformanceType[]
  instancePerformances: InstancePerformanceType[]
  participantPerformances: ParticipantPerformanceType[]
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
      activityPerformances: t.expose('activityPerformances', {
        type: [ActivityPerformance],
      }),
      instancePerformances: t.expose('instancePerformances', {
        type: [InstancePerformance],
      }),
      participantPerformances: t.expose('participantPerformances', {
        type: [ParticipantPerformance],
      }),
    }),
  }
)
// #endregion
