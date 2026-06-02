import { z } from 'zod'

export const controlCourseInput = z.object({
  courseId: z.string(),
})
