interface QuestionData<Type, Options> {
  id: number
  name: string
  type: Type
  content: string
  contentPlain: string
  ownerId: string
  isDeleted: boolean
  isArchived: boolean
  createdAt: string | Date
  updatedAt: string | Date

  options: Options
}

interface Choice {
  value: string
  correct: boolean
  feedback?: string
}

type ChoicesQuestionData = QuestionData<
  'SC' | 'MC',
  {
    choices: Choice[]
  }
>
type FreeTextQuestionData = QuestionData<
  'FREE_TEXT',
  {
    restrictions?: {
      maxLength?: number
    }
    solutions?: string[]
  }
>
type NumericalQuestionData = QuestionData<
  'NUMERICAL',
  {
    restrictions?: {
      min?: number
      max?: number
    }
    solutionRanges?: {
      min: number
      max?: number
    }[]
  }
>

type AllQuestionTypeData =
  | ChoicesQuestionData
  | FreeTextQuestionData
  | NumericalQuestionData

interface ChoicesQuestionResults {
  choices: Record<string, number>
}

type AllQuestionResults = ChoicesQuestionResults
