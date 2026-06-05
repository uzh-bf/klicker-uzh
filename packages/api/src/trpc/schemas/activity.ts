import {
  ElementType,
  PublicationStatus,
  ReviewStatus,
} from '@klicker-uzh/prisma/client'
import { ActivityType, SortByType } from '@klicker-uzh/types'
import { z } from 'zod'
import {
  caseStudyOptionsInput,
  choicesOptionsInput,
  elementManipulationBaseInput,
  freeTextOptionsInput,
  numericalOptionsInput,
  selectionOptionsInput,
} from './element.js'

export const userActivitiesInput = z.object({
  statusFilter: z.array(z.nativeEnum(PublicationStatus)).nullish(),
  activityTypeFilter: z.nativeEnum(ActivityType).nullish(),
  courseId: z.string().nullish(),
  withoutCourse: z.boolean().nullish(),
  searchString: z.string().nullish(),
  showOwned: z.boolean().nullish(),
  showShared: z.boolean().nullish(),
  showDependencies: z.boolean().nullish(),
  multiplier: z.number().int().nullish(),
  reviewStatus: z.nativeEnum(ReviewStatus).nullish(),
  isGamificationEnabled: z.boolean().nullish(),
  isAssessmentEnabled: z.boolean().nullish(),
  isPinProtected: z.boolean().nullish(),
  sortByType: z.nativeEnum(SortByType),
  sortByAsc: z.boolean(),
  numEntries: z.number().int().nullish(),
  offset: z.number().int().nullish(),
})

export const activityDetailsInput = z.object({
  activityId: z.string(),
  activityType: z.nativeEnum(ActivityType),
})

export const templateInformationInput = activityDetailsInput

export const editActivityTemplateInput = activityDetailsInput.extend({
  templateId: z.string(),
  name: z.string(),
  description: z.string(),
  instructions: z.string(),
})

const templateElementManipulationInput = elementManipulationBaseInput.extend({
  type: z.nativeEnum(ElementType),
  choicesOptions: choicesOptionsInput.nullish(),
  numericalOptions: numericalOptionsInput.nullish(),
  freeTextOptions: freeTextOptionsInput.nullish(),
  selectionOptions: selectionOptionsInput.nullish(),
  caseStudyOptions: caseStudyOptionsInput.nullish(),
})

const templateBlockElementInput = z.object({
  order: z.number().int(),
  useExistingElement: z.boolean(),
  existingElementId: z.number().int().nullish(),
  useNewElement: z.boolean(),
  newElement: templateElementManipulationInput.nullish(),
})

export const createLiveQuizFromTemplateInput = z.object({
  templateId: z.string(),
  name: z.string(),
  displayName: z.string(),
  description: z.string().nullish(),
  courseId: z.string().nullish(),
  isGamificationEnabled: z.boolean(),
  blocks: z.array(
    z.object({
      timeLimit: z.number().int().nullish(),
      order: z.number().int(),
      elements: z.array(templateBlockElementInput),
    })
  ),
})

export const activityTemplateInput = z.object({
  templateId: z.string(),
})

export const activityReviewStatusInput = z.object({
  activityId: z.string(),
  activityType: z.nativeEnum(ActivityType),
  isReviewed: z.boolean(),
})

export const applyActivityBatchOperationsInput = z.object({
  activityIds: z.array(z.string()),
  multiplier: z.number().int().nullish(),
  courseId: z.string().nullish(),
  basePoints: z.number().int().nullish(),
  correctnessPoints: z.number().int().nullish(),
  bonusPoints: z.number().int().nullish(),
  timeToZeroBonus: z.number().int().nullish(),
})

export const checkTemplateElementExistsInput = z.object({
  name: z.string(),
})

export const matchingUserElementsTemplateInput = z.object({
  elementType: z.nativeEnum(ElementType),
  hasSampleSolution: z.boolean().nullish(),
  hasAnswerFeedbacks: z.boolean().nullish(),
})

export const templatePreviewAnswerCollectionEntriesInput = z.object({
  templateId: z.string(),
  answerCollectionId: z.number().int(),
})

export const outdatedElementInstancesInput = z.object({
  instanceIds: z.array(z.number().int()),
})
