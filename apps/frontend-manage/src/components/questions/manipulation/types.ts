import {
  ElementDisplayMode,
  ElementStatus,
  ElementType,
} from '@klicker-uzh/graphql/dist/ops'

interface SharedQuestionFormProps {
  name: string
  status: ElementStatus
  content: string
  pointsMultiplier: string
  tags?: string[] | null
}

interface ElementFormTypesChoice {
  id: string
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
  }
}

export interface ElementFormTypesSelection extends SharedQuestionFormProps {
  type: ElementType.Selection
  explanation?: string | null
  options: {
    hasSampleSolution: boolean
    numberOfInputs: string
    answerCollection: string
    correctAnswers?: number[] | null
  }
}

export interface ElementFormTypesCaseStudy extends SharedQuestionFormProps {
  type: ElementType.CaseStudy
  explanation?: string | null
  options: {
    hasSampleSolution: boolean
    answerCollection: string
    selectedItems: number[] // items that should be evaluated with respect to the defined criteria
    cases: {
      title: string
      description: string
      // key of top level record is `itemId-${item.id}`, key of nested record is criterion id
      solutions?: Record<string, Record<string, { min: string; max: string }>>
    }[]
    criteria: {
      id: string // short id
      name: string
      min: string
      max: string
      step: string
      unit?: string | null
    }[]
  }
}

export interface ElementFormTypesFlashcard extends SharedQuestionFormProps {
  type: ElementType.Flashcard
  explanation: string
}

export interface ElementFormTypesContent extends SharedQuestionFormProps {
  type: ElementType.Content
}

export type ElementFormTypes =
  | ElementFormTypesChoices
  | ElementFormTypesNumerical
  | ElementFormTypesFreeText
  | ElementFormTypesFlashcard
  | ElementFormTypesContent
  | ElementFormTypesSelection
  | ElementFormTypesCaseStudy
