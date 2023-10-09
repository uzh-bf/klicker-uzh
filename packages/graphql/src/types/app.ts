import {
  Element,
  ElementType,
  QuestionDisplayMode,
  QuestionInstance,
} from '@klicker-uzh/prisma'

export type AvatarSettings = {
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

export type QuestionResponseChoices = {
  choices: number[]
}

export type QuestionResponseValue = {
  value: string
}

export type QuestionResponse = QuestionResponseChoices | QuestionResponseValue

export type QuestionResultsChoices = {
  choices: Record<string, number>
}

export type QuestionResultsOpen = {
  [x: string]: {
    count: number
    value: string
    correct?: boolean
  }
}

export type QuestionResults = QuestionResultsChoices | QuestionResultsOpen

export type Choice = {
  ix: number
  value: string
  correct?: boolean
  feedback?: string
}

export type QuestionOptionsChoices = {
  choices: Choice[]
}

export type QuestionOptionsNumerical = {
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

export type QuestionOptionsFreeText = {
  solutions?: string[]
  restrictions?: {
    maxLength?: number | null
  }
}

export type QuestionOptions =
  | QuestionOptionsChoices
  | QuestionOptionsNumerical
  | QuestionOptionsFreeText

export interface BaseQuestionData {
  id: number
  name: string
  type: ElementType
  displayMode: QuestionDisplayMode
  content: string
  pointsMultiplier: number
  explanation: string | null
  hasSampleSolution: boolean
  hasAnswerFeedbacks: boolean
  options: object
}

export type BaseQuestionDataKeys = (keyof BaseQuestionData)[]

interface IQuestionData<
  Type extends ElementType,
  Options extends QuestionOptions
> extends Element {
  type: Type
  options: Options
}

export type ChoicesQuestionData = IQuestionData<
  'SC' | 'MC' | 'KPRIM',
  QuestionOptionsChoices
>
export type FreeTextQuestionData = IQuestionData<
  'FREE_TEXT',
  QuestionOptionsFreeText
>
export type NumericalQuestionData = IQuestionData<
  'NUMERICAL',
  QuestionOptionsNumerical
>

export type AllQuestionTypeData =
  | ChoicesQuestionData
  | FreeTextQuestionData
  | NumericalQuestionData

export interface IQuestionInstanceWithResults<
  Type extends ElementType,
  Results extends QuestionResults
> extends QuestionInstance {
  elementType?: Type
  questionData: AllQuestionTypeData
  results: Results
  statistics?: {
    max?: number
    mean?: number
    median?: number
    min?: number
    q1?: number
    q3?: number
    sd?: number[]
  }
}

export type ChoicesQuestionInstanceData = IQuestionInstanceWithResults<
  'SC' | 'MC' | 'KPRIM',
  QuestionResultsChoices
>
export type OpenQuestionInstanceData = IQuestionInstanceWithResults<
  'FREE_TEXT' | 'NUMERICAL',
  QuestionResultsOpen
>

export type AllQuestionInstanceTypeData =
  | ChoicesQuestionInstanceData
  | OpenQuestionInstanceData

declare global {
  namespace PrismaJson {
    type PrismaAvatarSettings = AvatarSettings
    type PrismaQuestionResponse = QuestionResponse
    type PrismaQuestionOptions = QuestionOptions
    type PrismaQuestionResults = QuestionResults
    type PrismaQuestionData = AllQuestionTypeData
  }
}
