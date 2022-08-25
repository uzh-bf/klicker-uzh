interface QuestionData<Type, Options> {
  id: string
  name: string
  type: Type
  content: string
  contentPlain: string
  ownerId: string
  isDeleted: boolean
  isArchived: boolean
  createdAt: string
  updatedAt: string

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
  }
>
type NumericalQuestionData = QuestionData<
  'NUMERICAL',
  {
    restrictions?: {
      min?: number
      max?: number
    }
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
