import * as DB from '@klicker-uzh/prisma'
import builder from '../builder.js'

export const ActivityLevel = builder.enumType('ActivityLevel', {
  values: Object.values(DB.ActivityLevel),
})

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
