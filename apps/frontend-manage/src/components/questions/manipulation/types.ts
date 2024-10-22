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

export interface QuestionFormTypesChoices extends SharedQuestionFormProps {
  type: ElementType.Sc | ElementType.Mc | ElementType.Kprim
  explanation?: string | null
  options: {
    choices: {
      ix: number
      value?: string | null
      correct?: boolean | null
      feedback?: string | null
    }[]
    displayMode: ElementDisplayMode
    hasAnswerFeedbacks: boolean
    hasSampleSolution: boolean
  }
}

export interface QuestionFormTypesNumerical extends SharedQuestionFormProps {
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
    solutionRanges?:
      | {
          min?: number | string | null
          max?: number | string | null
        }[]
      | null
  }
}

export interface QuestionFormTypesFreeText extends SharedQuestionFormProps {
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

export interface QuestionFormTypesFlashcard extends SharedQuestionFormProps {
  type: ElementType.Flashcard
  explanation: string
}

export interface QuestionFormTypesContent extends SharedQuestionFormProps {
  type: ElementType.Content
}

export type QuestionFormTypes =
  | QuestionFormTypesChoices
  | QuestionFormTypesNumerical
  | QuestionFormTypesFreeText
  | QuestionFormTypesFlashcard
  | QuestionFormTypesContent
