declare module '@klicker-uzh/prisma/dist/util'

interface QuestionData<Type, Options> {
  id: number
  name: string
  type: Type
  displayMode: QuestionDisplayMode
  content: string
  ownerId: string
  isDeleted: boolean
  isArchived: boolean
  createdAt: string | Date
  updatedAt: string | Date
  pointsMultiplier: number
  explanation?: string

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
      minLength?: number
      pattern?: string
    }
    solutions?: string[]
    feedback?: string
  }
>
type NumericalQuestionData = QuestionData<
  QuestionType.NUMERICAL,
  {
    accuracy?: number
    restrictions?: {
      min?: number
      max?: number
    }
    solutionRanges?: {
      min: number
      max?: number
    }[]
    feedback?: string
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
