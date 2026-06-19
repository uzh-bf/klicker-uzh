import type { RouterOutputs } from '../trpc'
import type { PermissionLevel, SharingType } from './sharingEnums'

export const ActivityType = {
  LiveQuiz: 'LIVE_QUIZ',
  PracticeQuiz: 'PRACTICE_QUIZ',
  MicroLearning: 'MICRO_LEARNING',
  GroupActivity: 'GROUP_ACTIVITY',
} as const

export type ActivityType = (typeof ActivityType)[keyof typeof ActivityType]

export const ElementType = {
  CaseStudy: 'CASE_STUDY',
  Content: 'CONTENT',
  Flashcard: 'FLASHCARD',
  FreeText: 'FREE_TEXT',
  Kprim: 'KPRIM',
  Mc: 'MC',
  Numerical: 'NUMERICAL',
  Sc: 'SC',
  Selection: 'SELECTION',
} as const

export type ElementType = (typeof ElementType)[keyof typeof ElementType]

export const ElementOrderType = {
  Sequential: 'SEQUENTIAL',
  SpacedRepetition: 'SPACED_REPETITION',
} as const

export type ElementOrderType =
  (typeof ElementOrderType)[keyof typeof ElementOrderType]

export const ParameterType = {
  Number: 'NUMBER',
  String: 'STRING',
} as const

export type ParameterType = (typeof ParameterType)[keyof typeof ParameterType]

export type Element = {
  id: number
  name: string
  type: ElementType
  options?: {
    hasSampleSolution?: boolean | null
  } | null
  hasSampleSolution?: boolean | null
}

export type ActivityElementData = {
  id: string
  name: string
  type: ElementType
  options?: {
    hasSampleSolution?: boolean | null
  } | null
}

export type ActivityAuthoringElementInstance = {
  id: number
  elementData: ActivityElementData
}

export type ActivityAuthoringStack = {
  id?: number
  displayName?: string | null
  description?: string | null
  elements?: ActivityAuthoringElementInstance[] | null
}

export type ActivityAuthoringBlock = {
  id?: number
  timeLimit?: number | null
  elements?: ActivityAuthoringElementInstance[] | null
}

type ActivityAuthoringCourse = {
  id: string
}

type BaseAuthoringActivity = {
  id?: string
  name: string
  displayName: string
  description?: string | null
  pointsMultiplier: number
  course?: ActivityAuthoringCourse | null
  status?: PublicationStatus
}

export type PracticeQuiz = BaseAuthoringActivity & {
  stacks?: ActivityAuthoringStack[] | null
  orderType?: string
  resetTimeDays?: number
}

export type MicroLearning = BaseAuthoringActivity & {
  stacks?: ActivityAuthoringStack[] | null
  scheduledStartAt?: Date | string | null
  scheduledEndAt?: Date | string | null
}

export type GroupActivity = BaseAuthoringActivity & {
  stacks?: ActivityAuthoringStack[] | null
  scheduledStartAt?: Date | string | null
  scheduledEndAt?: Date | string | null
  clues?:
    | {
        id?: number
        name: string
        displayName: string
        type: ParameterType
        value: string
        unit?: string | null
      }[]
    | null
}

export type LiveQuiz = BaseAuthoringActivity & {
  blocks?: ActivityAuthoringBlock[] | null
  isAssessmentEnabled: boolean
  isConfusionFeedbackEnabled: boolean
  isGamificationEnabled: boolean
  isLiveQAEnabled: boolean
  isModerationEnabled: boolean
  isPinProtected?: boolean | null
  pinCode?: string | null
  defaultCorrectPoints: number
  defaultPoints: number
  maxBonusPoints?: number | null
  timeToZeroBonus?: number | null
}

export type ActivityInfo = {
  id: string
  templateId?: string | null
  type: ActivityType
  status: PublicationStatus
  courseId?: string | null
  courseName?: string | null
  courseStartDate?: Date | string | null
  courseLanguage?: string | null
  numOfStacks: number
  numOfElements: number
  reviewStatus: ReviewStatus
  automaticPublicationAt?: Date | string | null
  scheduledStartAt?: Date | string | null
  scheduledEndAt?: Date | string | null
  groupDeadlineDate?: Date | string | null
  numOfParticipantGroups?: number | null
  name: string
  displayName: string
  permissionLevel: PermissionLevel
  derivedAccess?: boolean
  areInstancesOutdated?: boolean
  isGamificationEnabled?: boolean | null
  isAssessmentEnabled?: boolean | null
  pinCode?: string | null
  numSharedUsers?: number | null
  isOwner: boolean
  isManager: boolean
  isEditor: boolean
  isExecutor: boolean
  isShared: boolean
  isRemovable: boolean
  isActivityReviewer?: boolean
  sharingType?: SharingType
  updatedAt?: Date | string
}

type RouterActivityDetails = NonNullable<
  RouterOutputs['activity']['details']['activityDetails']
>

type RouterActivityDetailsStack = RouterActivityDetails['stacks'][number]

type RouterActivityDetailsElement =
  RouterActivityDetailsStack['elements'][number]

export type ActivityDetailsElement = RouterActivityDetailsElement & {
  basePoints?: number | null
  correctnessPoints?: number | null
  bonusPoints?: number | null
}

export type ActivityDetailsStack = Omit<
  RouterActivityDetailsStack,
  'elements'
> & {
  timeLimit?: number | null
  stackTitle?: string | null
  stackDescription?: string | null
  elements: ActivityDetailsElement[]
}

export type ActivityElementInstance = ActivityDetailsElement['instance']

export type ElementInstanceVersionInfo =
  RouterOutputs['activity']['outdatedElementInstances']['outdatedElementInstances'][number]

export type ActivityDetails = Omit<RouterActivityDetails, 'stacks'> & {
  totalBasePoints?: number | null
  totalCorrectnessPoints?: number | null
  totalBonusPoints?: number | null
  stacks: ActivityDetailsStack[]
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

export const ReviewStatus = {
  Incomplete: 'INCOMPLETE',
  ModifiedAfterReview: 'MODIFIED_AFTER_REVIEW',
  Reviewed: 'REVIEWED',
} as const

export type ReviewStatus = (typeof ReviewStatus)[keyof typeof ReviewStatus]

export const SortByType = {
  Title: 'TITLE',
  Type: 'TYPE',
  Status: 'STATUS',
  Created: 'CREATED',
  Modified: 'MODIFIED',
} as const

export type SortByType = (typeof SortByType)[keyof typeof SortByType]
