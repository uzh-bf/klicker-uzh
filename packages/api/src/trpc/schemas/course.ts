import { Locale } from '@klicker-uzh/prisma/client'
import { ActivityType } from '@klicker-uzh/types'
import { z } from 'zod'

export const controlCourseInput = z.object({
  courseId: z.string(),
})

export const basicCourseInformationInput = z.object({
  courseId: z.string(),
})

export const activeUserCoursesInput = z
  .object({
    activityId: z.string().nullish(),
    activityType: z.nativeEnum(ActivityType).nullish(),
  })
  .nullish()

export const courseActivityIdsInput = z.object({
  courseId: z.string().nullish(),
})

export const courseActivitiesInput = z.object({
  courseId: z.string(),
})

export const courseSummaryInput = z.object({
  courseId: z.string(),
})

export const courseGroupsInput = z.object({
  courseId: z.string(),
})

export const createCourseInput = z.object({
  name: z.string(),
  displayName: z.string(),
  description: z.string().nullish(),
  color: z.string().nullish(),
  startDate: z.date(),
  endDate: z.date(),
  isGroupCreationEnabled: z.boolean(),
  groupDeadlineDate: z.date(),
  maxGroupSize: z.number().int(),
  preferredGroupSize: z.number().int(),
  language: z.nativeEnum(Locale),
  notificationEmail: z.string().email().nullish(),
  isGamificationEnabled: z.boolean(),
})

export const toggleArchiveCourseInput = z.object({
  id: z.string(),
  isArchived: z.boolean(),
})

export const deleteCourseInput = z.object({
  id: z.string(),
})

export const updateCourseSettingsInput = z.object({
  id: z.string(),
  name: z.string().nullish(),
  displayName: z.string().nullish(),
  description: z.string().nullish(),
  color: z.string().nullish(),
  startDate: z.date().nullish(),
  endDate: z.date().nullish(),
  isGroupCreationEnabled: z.boolean().nullish(),
  groupDeadlineDate: z.date().nullish(),
  language: z.nativeEnum(Locale),
  notificationEmail: z.string().nullish(),
  isGamificationEnabled: z.boolean().nullish(),
  isAssessmentEnabled: z.boolean().nullish(),
})

export type UpdateCourseSettingsInput = z.infer<
  typeof updateCourseSettingsInput
>
