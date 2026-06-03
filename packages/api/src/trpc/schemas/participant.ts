import { Locale } from '@klicker-uzh/prisma/client'
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

export const participantActivateAccountInput = z.object({
  token: z.string(),
})

export const participantChangeLocaleInput = z.object({
  locale: z.nativeEnum(Locale),
})

export const participantLoginInput = z.object({
  usernameOrEmail: z.string(),
  password: z.string(),
})

export const participantLoginWithMagicLinkInput = z.object({
  token: z.string(),
})

export const participantLoginTemporaryInput = z.object({
  liveQuizId: z.string(),
  pseudonym: z.string(),
  avatar: z.string().nullish(),
})

export const participantLogoutTemporaryInput = z.object({
  liveQuizId: z.string(),
})

export const participantSendMagicLinkInput = z.object({
  usernameOrEmail: z.string(),
})

export const participantCourseLeaderboardInput = z.object({
  courseId: z.string(),
  mode: z.enum(['course', 'biweekly']),
})

export const participantGroupActivityInstancesInput = z.object({
  courseId: z.string(),
  groupId: z.string(),
})

export const participantSubscribeToPushInput = z.object({
  courseId: z.string(),
  subscriptionObject: z.object({
    endpoint: z.string(),
    expirationTime: z.number().int().nullish(),
    keys: z.object({
      auth: z.string(),
      p256dh: z.string(),
    }),
  }),
})

export const participantUnsubscribeFromPushInput = z.object({
  courseId: z.string(),
  endpoint: z.string(),
})
