import { z } from 'zod'

export const controlCourseInput = z.object({
  courseId: z.string(),
})

export const basicCourseInformationInput = z.object({
  courseId: z.string(),
})

export const courseSummaryInput = z.object({
  courseId: z.string(),
})
