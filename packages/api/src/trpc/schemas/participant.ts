import { z } from 'zod'

export const participantSelfInput = z
  .object({
    liveQuizId: z.string().nullish(),
  })
  .optional()

export const participantParticipationsInput = z
  .object({
    endpoint: z.string().nullish(),
    assessmentOnly: z.boolean().nullish(),
  })
  .optional()

export const participantCourseInput = z.object({
  courseId: z.string(),
})

export const participantCourseLeaderboardInput = z.object({
  courseId: z.string(),
  mode: z.enum(['course', 'biweekly']),
})

export const participantGroupActivityInstancesInput = z.object({
  courseId: z.string(),
  groupId: z.string(),
})
