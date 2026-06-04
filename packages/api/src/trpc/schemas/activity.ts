import { PublicationStatus, ReviewStatus } from '@klicker-uzh/prisma/client'
import { ActivityType, SortByType } from '@klicker-uzh/types'
import { z } from 'zod'

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
