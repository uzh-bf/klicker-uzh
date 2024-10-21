import {
  ElementDisplayMode,
  ElementStatus,
  ElementType,
} from '@klicker-uzh/graphql/dist/ops'

interface SharedQuestionFormProps {
  id?: number | null
  name: string
  status: ElementStatus
  content: string
  pointsMultiplier: number
  tags?: string[] | null
}

interface QuestionFormTypeChoices extends SharedQuestionFormProps {
  type: ElementType.Sc | ElementType.Mc | ElementType.Kprim
  explanation?: string | null
  options: {
    choices: {
      content: string
      ix?: number | null
      correct?: boolean | null
      feedback?: string | null
    }[]
    displayMode: ElementDisplayMode
    hasAnswerFeedbacks: boolean
    hasSampleSolution: boolean
  }
}

interface QuestionFormTypesNumerical extends SharedQuestionFormProps {
  type: ElementType.Numerical
  explanation?: string | null
  options: {
    hasSampleSolution: boolean
    accuracy?: number | null
    unit?: string | null
    restrictions?: {
      min?: number | null
      max?: number | null
    }
    solutionRanges?: {
      min?: number | null
      max?: number | null
    }[]
  }
}

interface QuestionFormTypesFreeText extends SharedQuestionFormProps {
  type: ElementType.FreeText
  explanation?: string | null
  options: {
    hasSampleSolution: boolean
    restrictions: {
      maxLength?: number | null
    }
    solutions: string[] | null
  }
}

interface QuestionFormTypesFlashcard extends SharedQuestionFormProps {
  type: ElementType.Flashcard
  explanation: string
}

interface QuestionFormTypesContent extends SharedQuestionFormProps {
  type: ElementType.Content
}

export type QuestionFormTypes =
  | QuestionFormTypeChoices
  | QuestionFormTypesNumerical
  | QuestionFormTypesFreeText
  | QuestionFormTypesFlashcard
  | QuestionFormTypesContent
