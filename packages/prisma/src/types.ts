export enum QuestionType {
  SC = 'SC',
  MC = 'MC',
  KPRIM = 'KPRIM',
  NUMERICAL = 'NUMERICAL',
  FREE_TEXT = 'FREE_TEXT',
}

export type QuestionDisplayMode = 'LIST' | 'GRID'

export type ChoicePrisma = {
  ix: number
  value: string
  correct?: boolean
  feedback?: string
}

export type AvatarSettingsPrisma = {
  skinTone: string
  eyes: string
  mouth: string
  hair: string
  accessory: string
  hairColor: string
  clothing: string
  clothingColor: string
  facialHair: string
}

export type QuestionResponseChoicesPrisma = {
  choices: number[]
}

export type QuestionResponseValuePrisma = {
  value: string
}

export type QuestionResponsePrisma =
  | QuestionResponseChoicesPrisma
  | QuestionResponseValuePrisma

export type QuestionResultsChoicesPrisma = {
  choices: Record<string, number>
}

export type QuestionResultsNumericalPrisma = {
  [x: string]: number
}

export type QuestionResultsFreeTextPrisma = {
  [x: string]: number
}

export type QuestionResultsPrisma =
  | QuestionResultsChoicesPrisma
  | QuestionResultsNumericalPrisma
  | QuestionResultsFreeTextPrisma

export type QuestionOptionsChoicesPrisma = {
  choices: {
    ix: number
    value: string
    correct?: boolean
    feedback?: string
  }[]
}

export type QuestionOptionsNumericalPrisma = {
  unit?: string | null
  accuracy?: number
  placeholder?: string
  restrictions?: {
    min?: number
    max?: number
  }
  solutionRanges?: {
    min?: number | null
    max?: number | null
  }[]
}

export type QuestionOptionsFreeTextPrisma = {
  solutions?: string[]
  restrictions?: {
    maxLength?: number | null
  }
}

export type QuestionOptionsPrisma =
  | QuestionOptionsChoicesPrisma
  | QuestionOptionsNumericalPrisma
  | QuestionOptionsFreeTextPrisma

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

type ChoicesQuestionData = QuestionData<
  QuestionType.SC | QuestionType.MC | QuestionType.KPRIM,
  QuestionOptionsChoicesPrisma
>
type FreeTextQuestionData = QuestionData<
  QuestionType.FREE_TEXT,
  QuestionOptionsFreeTextPrisma
>
type NumericalQuestionData = QuestionData<
  QuestionType.NUMERICAL,
  QuestionOptionsNumericalPrisma
>

export type QuestionDataPrisma =
  | ChoicesQuestionData
  | FreeTextQuestionData
  | NumericalQuestionData

declare global {
  namespace PrismaJson {
    type AvatarSettings = AvatarSettingsPrisma
    type QuestionResponse = QuestionResponsePrisma
    type QuestionOptions = QuestionOptionsPrisma
    type QuestionResults = QuestionResultsPrisma
    type QuestionData = QuestionDataPrisma
  }
}
