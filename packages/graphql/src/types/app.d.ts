import { QuestionType } from '@klicker-uzh/prisma'

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
  ix: number
  value: string
  correct?: boolean
  feedback?: string
}

type ChoicesQuestionData = QuestionData<
  QuestionType.SC | QuestionType.MC | QuestionType.KPRIM,
  {
    choices: Choice[]
  }
>
type FreeTextQuestionData = QuestionData<
  QuestionType.FREE_TEXT,
  {
    restrictions?: {
      maxLength?: number
    }
    solutions?: string[]
  }
>
type NumericalQuestionData = QuestionData<
  QuestionType.NUMERICAL,
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

interface NumericalQuestionResults {
  [x: string]: number
}

interface FreeTextQuestionResults {
  [x: string]: number
}

type AllQuestionResults =
  | ChoicesQuestionResults
  | FreeTextQuestionResults
  | NumericalQuestionResults
