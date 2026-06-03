import { ElementType, Locale } from '@klicker-uzh/prisma/client'
import { FlashcardCorrectness } from '@klicker-uzh/types'
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

export const participantCreateGroupInput = z.object({
  courseId: z.string(),
  name: z.string(),
})

export const participantJoinGroupInput = z.object({
  courseId: z.string(),
  code: z.number().int(),
})

export const participantLeaveGroupInput = z.object({
  courseId: z.string(),
  groupId: z.string(),
})

export const participantRenameGroupInput = z.object({
  groupId: z.string(),
  name: z.string(),
})

export const participantGroupMessageInput = z.object({
  groupId: z.string(),
  content: z.string(),
})

export const participantPublicProfileInput = z.object({
  participantId: z.string(),
})

export const participantActivateAccountInput = z.object({
  token: z.string(),
})

export const participantChangeLocaleInput = z.object({
  locale: z.nativeEnum(Locale),
})

export const participantCoursePinInput = z.object({
  pin: z.number().int().min(0).max(999999999),
})

export const participantShortnameInput = z.object({
  shortname: z.string(),
})

export const participantCheckNameAvailableInput = z.object({
  username: z.string(),
})

export const participantUpdateProfileInput = z.object({
  username: z.string(),
  email: z.string(),
  password: z.string().nullish(),
  isProfilePublic: z.boolean().nullish(),
})

const participantAvatarSettingsInput = z.object({
  skinTone: z.string(),
  eyes: z.string(),
  mouth: z.string(),
  hair: z.string(),
  facialHair: z.string(),
  accessory: z.string(),
  hairColor: z.string(),
  clothing: z.string(),
  clothingColor: z.string(),
})

export const participantUpdateAvatarInput = z.object({
  avatar: z.string(),
  avatarSettings: participantAvatarSettingsInput,
})

export const participantCreateAccountInput = z.object({
  email: z.string(),
  username: z.string(),
  password: z.string(),
  isProfilePublic: z.boolean(),
  courseId: z.string().nullish(),
  signedLtiData: z.string().nullish(),
})

export const participantLoginInput = z.object({
  usernameOrEmail: z.string(),
  password: z.string(),
})

export const participantLoginWithLtiInput = z.object({
  signedLtiData: z.string(),
  courseId: z.string().nullish(),
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

export const participantPracticeQuizBookmarksInput = z.object({
  courseId: z.string(),
  quizId: z.string().nullish(),
})

export const participantPracticeQuizInput = z.object({
  id: z.string(),
})

export const participantMicroLearningInput = z.object({
  id: z.string(),
})

export const participantMarkMicroLearningCompletedInput = z.object({
  courseId: z.string(),
  id: z.string(),
})

export const participantPreviousStackEvaluationInput = z.object({
  stackId: z.number().int(),
})

const participantChoicesResponseInput = z.object({
  ix: z.number().int(),
  selected: z.boolean(),
})

const participantCaseStudyCriterionResponseInput = z.object({
  criterionId: z.string(),
  response: z.number(),
})

const participantCaseStudyItemResponseInput = z.object({
  itemId: z.number().int(),
  criterionResponses: z.array(participantCaseStudyCriterionResponseInput),
})

const participantCaseStudyCaseResponseInput = z.object({
  caseId: z.string(),
  itemResponses: z.array(participantCaseStudyItemResponseInput),
})

const participantStackResponseInput = z.object({
  instanceId: z.number().int(),
  type: z.nativeEnum(ElementType),
  flashcardResponse: z.nativeEnum(FlashcardCorrectness).nullish(),
  contentReponse: z.boolean().nullish(),
  choicesResponse: z.array(participantChoicesResponseInput).nullish(),
  numericalResponse: z.number().nullish(),
  freeTextResponse: z.string().nullish(),
  selectionResponse: z.array(z.number().int()).nullish(),
  caseStudyResponse: z.array(participantCaseStudyCaseResponseInput).nullish(),
})

export const participantRespondToElementStackInput = z.object({
  stackId: z.number().int(),
  courseId: z.string(),
  responses: z.array(participantStackResponseInput),
  stackAnswerTime: z.number().int(),
  isOwner: z.boolean().nullish(),
})

export const participantBookmarkElementStackInput = z.object({
  courseId: z.string(),
  stackId: z.number().int(),
  bookmarked: z.boolean(),
})

export const participantStackElementFeedbacksInput = z.object({
  instanceIds: z.array(z.number().int()),
})

export const participantFlagElementInput = z.object({
  elementInstanceId: z.number().int(),
  elementId: z.number().int(),
  content: z.string(),
})

export const participantRateElementInput = z.object({
  elementInstanceId: z.number().int(),
  elementId: z.number().int(),
  rating: z.number().int(),
})

export const participantGroupActivityInstancesInput = z.object({
  courseId: z.string(),
  groupId: z.string(),
})

export const participantGroupActivityDetailsInput = z.object({
  activityId: z.string(),
  groupId: z.string(),
})

export const participantStartGroupActivityInput = z.object({
  activityId: z.string(),
  groupId: z.string(),
})

export const participantSubmitGroupActivityDecisionsInput = z.object({
  activityId: z.number().int(),
  responses: z.array(participantStackResponseInput),
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
