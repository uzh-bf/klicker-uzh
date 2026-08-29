import type {
  ElementDisplayMode,
  ElementStatus,
  ElementType,
} from '@klicker-uzh/graphql/dist/ops'
import type { SemanticFreeTextConfig } from '@klicker-uzh/types'

interface SharedQuestionFormProps {
  name: string
  status: ElementStatus
  content: string
  basePoints: boolean
  pointsMultiplier: string
  tags?: string[] | null
}

interface ElementFormTypesChoice {
  id: string
  ix?: number
  value?: string | null
  correct?: boolean | null
  feedback?: string | null
}

export interface ElementFormTypesChoices extends SharedQuestionFormProps {
  type: ElementType.Sc | ElementType.Mc | ElementType.Kprim
  explanation?: string | null
  options: {
    choices: ElementFormTypesChoice[]
    displayMode: ElementDisplayMode
    hasAnswerFeedbacks: boolean
    hasSampleSolution: boolean
  }
}

export interface ElementFormTypesNumerical extends SharedQuestionFormProps {
  type: ElementType.Numerical
  explanation?: string | null
  options: {
    hasSampleSolution: boolean
    accuracy?: number | null
    unit?: string | null
    restrictions?: {
      min?: number | string | null
      max?: number | string | null
    } | null
    solutionType?: 'range' | 'exact'
    solutionRanges?:
      | {
          min?: number | string | null
          max?: number | string | null
        }[]
      | null
    exactSolutions?: (number | string)[] | null
  }
}

export interface ElementFormTypesFreeText extends SharedQuestionFormProps {
  type: ElementType.FreeText
  explanation?: string | null
  options: {
    hasSampleSolution: boolean
    restrictions?: {
      maxLength?: number | string | null
    } | null
    solutions?: string[] | null
    semanticEvaluation?: SemanticFreeTextConfig | null
    semanticEvaluationLoadError?: boolean
    preservedSemanticEvaluation?: unknown
  }
}

export interface ElementFormTypesSelection extends SharedQuestionFormProps {
  type: ElementType.Selection
  explanation?: string | null
  options: {
    itemSelectionMode?: 'existing' | 'new'
    hasSampleSolution: boolean
    numberOfInputs: string
    answerCollection?: string
    manuallyCreatedItems?: { id: number; value: string }[] // new implicit AC: items that should be evaluated with respect to the defined criteria
    correctAnswers?: number[]
  }
}

// key of top level record is `itemId-${item.id}`, key of nested record is criterion id
export type ElementFormTypesCaseStudySolution = Record<
  string, // criterion id
  { min: string; max: string }
>
export type ElementFormTypesCaseStudySolutions = Record<
  string, // `itemId-${item.id}`
  ElementFormTypesCaseStudySolution
>

export type ElementFormTypesCaseStudyCriterion = {
  id: string // short id
  mode: 'range' | 'steps'
  name: string
  min?: number
  max?: number
  step: string
  unit?: string | null
  labels?: {
    min: string
    mid?: string | null
    max: string
  } | null
}

export interface ElementFormTypesCaseStudy extends SharedQuestionFormProps {
  type: ElementType.CaseStudy
  explanation?: string | null
  options: {
    itemSelectionMode?: 'existing' | 'new'
    hasSampleSolution: boolean
    answerCollection?: string
    selectedItems?: number[] // from AC: items that should be evaluated with respect to the defined criteria
    manuallyCreatedItems?: { id: number; value: string }[] // new implicit AC: items that should be evaluated with respect to the defined criteria
    cases: {
      id: string // short id
      title: string
      description: string
      solutions?: ElementFormTypesCaseStudySolutions
    }[]
    criteria: ElementFormTypesCaseStudyCriterion[]
  }
}

export interface ElementFormTypesFlashcard extends SharedQuestionFormProps {
  type: ElementType.Flashcard
  explanation: string
}

export interface ElementFormTypesContent extends SharedQuestionFormProps {
  type: ElementType.Content
}

export type ElementBatchOperationActions = {
  archive: boolean
  unarchive: boolean
  status?: ElementStatus
  multiplier?: string
  basePoints?: boolean
  updateInstances: boolean
  updateTemplateInstances: boolean
}

export const INITIAL_ELEMENT_BATCH_OPERATIONS: ElementBatchOperationActions = {
  archive: false,
  unarchive: false,
  status: undefined,
  multiplier: undefined,
  basePoints: undefined,
  updateInstances: true,
  updateTemplateInstances: false,
}

export type ElementFormTypes =
  | ElementFormTypesChoices
  | ElementFormTypesNumerical
  | ElementFormTypesFreeText
  | ElementFormTypesFlashcard
  | ElementFormTypesContent
  | ElementFormTypesSelection
  | ElementFormTypesCaseStudy
