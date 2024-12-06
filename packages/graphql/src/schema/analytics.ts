import * as DB from '@klicker-uzh/prisma'
import builder from '../builder.js'

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
  activityMonday: number
  activityTuesday: number
  activityWednesday: number
  activityThursday: number
  activityFriday: number
  activitySaturday: number
  activitySunday: number
}
export const WeekdayActivityAnalyticsRef =
  builder.objectRef<IWeekdayActivityAnalytics>('WeekdayActivityAnalytics')
export const WeekdayActivityAnalytics = builder.objectType(
  WeekdayActivityAnalyticsRef,
  {
    fields: (t) => ({
      activityMonday: t.exposeInt('activityMonday'),
      activityTuesday: t.exposeInt('activityTuesday'),
      activityWednesday: t.exposeInt('activityWednesday'),
      activityThursday: t.exposeInt('activityThursday'),
      activityFriday: t.exposeInt('activityFriday'),
      activitySaturday: t.exposeInt('activitySaturday'),
      activitySunday: t.exposeInt('activitySunday'),
    }),
  }
)

interface ICourseActivityAnalytics {
  name: string
  totalParticipants: number
  dailyActivity: IParticipantActivityTimestamp[]
  weeklyActivity: IParticipantActivityTimestamp[]
  activeDays: IWeekdayActivityAnalytics
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
    }),
  }
)
