import { ActivityType as ApiActivityType } from '@klicker-uzh/types'

export const ActivityType = {
  LiveQuiz: ApiActivityType.LIVE_QUIZ,
  PracticeQuiz: ApiActivityType.PRACTICE_QUIZ,
  MicroLearning: ApiActivityType.MICRO_LEARNING,
  GroupActivity: ApiActivityType.GROUP_ACTIVITY,
} as const

export type ActivityType = ApiActivityType

export type ActivityInfo = {
  id: string
  name: string
  templateId?: string | null
  courseId?: string | null
  courseLanguage?: string | null
}

export const PublicationStatus = {
  Draft: 'DRAFT',
  Scheduled: 'SCHEDULED',
  Published: 'PUBLISHED',
  Ended: 'ENDED',
  Graded: 'GRADED',
  Template: 'TEMPLATE',
} as const

export type PublicationStatus =
  (typeof PublicationStatus)[keyof typeof PublicationStatus]
