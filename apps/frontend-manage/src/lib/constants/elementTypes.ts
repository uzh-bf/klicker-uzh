import type { RouterOutputs } from '../trpc'
import type {
  ActivityType as ActivityTypeValue,
  LiveQuiz as AuthoringLiveQuiz,
  ElementType as ElementTypeValue,
  GroupActivity,
  MicroLearning,
  PracticeQuiz,
  SortByType as SortByTypeValue,
} from './activityEnums'
import {
  ActivityType as ActivityTypeConst,
  ElementType as ElementTypeConst,
  SortByType as SortByTypeConst,
} from './activityEnums'

export const ActivityType = ActivityTypeConst
export type ActivityType = ActivityTypeValue

export const ElementType = ElementTypeConst
export type ElementType = ElementTypeValue

export const SortByType = SortByTypeConst
export type SortByType = SortByTypeValue

export type {
  GroupActivity,
  MicroLearning,
  PracticeQuiz,
} from './activityEnums'

export const ElementDisplayMode = {
  Grid: 'GRID',
  List: 'LIST',
} as const

export type ElementDisplayMode =
  (typeof ElementDisplayMode)[keyof typeof ElementDisplayMode]

export const ElementStatus = {
  Draft: 'DRAFT',
  Ready: 'READY',
  Review: 'REVIEW',
} as const

export type ElementStatus = (typeof ElementStatus)[keyof typeof ElementStatus]

export const ElementInstanceType = {
  LiveQuiz: 'LIVE_QUIZ',
  PracticeQuiz: 'PRACTICE_QUIZ',
  MicroLearning: 'MICROLEARNING',
  GroupActivity: 'GROUP_ACTIVITY',
} as const

export type ElementInstanceType =
  (typeof ElementInstanceType)[keyof typeof ElementInstanceType]

export type Tag = {
  id: number
  name: string
  order?: number | null
}

export type Element = RouterOutputs['element']['list']['elements'][number]

export type EditableElement = NonNullable<
  RouterOutputs['element']['single']['element']
>

export type AnswerCollectionEntry = {
  id: number
  value: string
  numSolutionUsages?: number | null
}

export type AnswerCollection = {
  id: number
  name: string
  description?: string | null
  entries?: AnswerCollectionEntry[] | null
  isEditor?: boolean | null
  isManager?: boolean | null
  isOwner?: boolean | null
}

type ElementOptionChoice = {
  ix: number
  value?: string | null
  correct?: boolean | null
  feedback?: string | null
}

type ElementOptionCriterion = {
  id: string
  name: string
  min: number
  max: number
  step: number
  unit?: string | null
  labels?: {
    min: string
    mid?: string | null
    max: string
  } | null
}

type ElementOptionCase = {
  id: string
  title: string
  description: string
  solutions?:
    | {
        itemId: number
        criteriaSolutions: {
          criterionId: string
          min: number
          max: number
        }[]
      }[]
    | null
}

type ElementDataOptions = {
  hasSampleSolution?: boolean | null
  hasAnswerFeedbacks?: boolean | null
  displayMode?: ElementDisplayMode
  choices?: ElementOptionChoice[]
  exactSolutions?: number[] | null
  solutionRanges?: { min?: number | null; max?: number | null }[] | null
  accuracy?: number | null
  unit?: string | null
  restrictions?: {
    min?: number | null
    max?: number | null
    maxLength?: number | null
  } | null
  solutions?: string[] | null
  numberOfInputs?: number | null
  answerCollection?: { id: number } | null
  answerCollectionId?: number | null
  answerCollectionSolutionIds?: number[] | null
  items?: { id: number; value: string }[] | null
  criteria?: ElementOptionCriterion[]
  cases?: ElementOptionCase[]
}

type BaseElementData = {
  __typename?: string
  id: string
  elementId?: number
  name: string
  type: ElementTypeValue
  content?: string | null
  explanation?: string | null
  basePoints?: boolean
  pointsMultiplier?: number
  options?: ElementDataOptions | null
}

export type ChoicesElementData = BaseElementData & {
  __typename?: 'ChoicesElementData'
  options: ElementDataOptions & {
    displayMode: ElementDisplayMode
    choices: ElementOptionChoice[]
  }
}

export type NumericalElementData = BaseElementData & {
  __typename?: 'NumericalElementData'
  options: ElementDataOptions
}

export type FreeTextElementData = BaseElementData & {
  __typename?: 'FreeTextElementData'
  options: ElementDataOptions
}

export type SelectionElementData = BaseElementData & {
  __typename?: 'SelectionElementData'
  options: ElementDataOptions
}

export type CaseStudyElementData = BaseElementData & {
  __typename?: 'CaseStudyElementData'
  options: ElementDataOptions & {
    criteria?: ElementOptionCriterion[]
    cases?: ElementOptionCase[]
  }
}

export type FlashcardElementData = BaseElementData & {
  __typename?: 'FlashcardElementData'
}

export type ContentElementData = BaseElementData & {
  __typename?: 'ContentElementData'
}

export type ElementData =
  | CaseStudyElementData
  | ChoicesElementData
  | ContentElementData
  | FlashcardElementData
  | FreeTextElementData
  | NumericalElementData
  | SelectionElementData

export type ElementInstance = {
  id: number
  elementData: ElementData
  elementType: ElementTypeValue
  type?: ElementInstanceType
  options?: unknown
}

type TemplateLiveQuiz = Omit<AuthoringLiveQuiz, 'blocks'> & {
  blocks?:
    | {
        timeLimit?: number | null
        elements?: ElementInstance[] | null
      }[]
    | null
}

export type LiveQuiz = TemplateLiveQuiz

export type ActivityTemplate = {
  id: string
  activityType: ActivityTypeValue
  description: string
  instructions: string
  answerCollections?: AnswerCollection[] | null
  liveQuiz?: TemplateLiveQuiz | null
  practiceQuiz?: PracticeQuiz | null
  microLearning?: MicroLearning | null
  groupActivity?: GroupActivity | null
}
