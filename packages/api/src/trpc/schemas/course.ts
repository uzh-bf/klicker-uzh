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
