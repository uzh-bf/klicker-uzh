import type { ElementType } from '@klicker-uzh/prisma/client'
import type { RouterOutputs } from './trpc'

type CourseActivityAnalytics = NonNullable<
  RouterOutputs['analytics']['courseActivity']['courseActivityAnalytics']
>
type CoursePerformanceAnalytics = NonNullable<
  RouterOutputs['analytics']['coursePerformance']['coursePerformanceAnalytics']
>

export type ParticipantActivityTimestamp =
  CourseActivityAnalytics['dailyActivity'][number]
export type WeekdayActivityAnalytics = CourseActivityAnalytics['activeDays']
export type ParticipantCourseActivity =
  CourseActivityAnalytics['participantCourseAnalytics'][number]

export type ActivityProgress =
  CoursePerformanceAnalytics['activityProgresses'][number]
export type ActivityPerformance =
  CoursePerformanceAnalytics['activityPerformances'][number]
export type InstancePerformance =
  CoursePerformanceAnalytics['instancePerformances'][number]
export type ParticipantPerformance =
  CoursePerformanceAnalytics['participantPerformances'][number]
export type ParticipantActivityPerformances =
  CoursePerformanceAnalytics['participantActivityPerformances'][number]
export type InstanceFeedback =
  CoursePerformanceAnalytics['instanceFeedbacks'][number]
export type ActivityFeedback =
  CoursePerformanceAnalytics['activityFeedbacks'][number]

export const analyticsElementTypes = [
  'SC',
  'MC',
  'KPRIM',
  'NUMERICAL',
  'FREE_TEXT',
  'SELECTION',
  'CASE_STUDY',
  'CONTENT',
  'FLASHCARD',
] satisfies ElementType[]
