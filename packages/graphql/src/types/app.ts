import {
  Element,
  ElementDisplayMode,
  ElementType,
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

interface BaseElementOptions {
  hasSampleSolution: boolean
  hasAnswerFeedbacks: boolean
}

export interface ElementOptionsChoices extends BaseElementOptions {
  choices: Choice[]
  displayMode: ElementDisplayMode
}

export interface ElementOptionsNumerical extends BaseElementOptions {
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

export interface ElementOptionsFreeText extends BaseElementOptions {
  solutions?: string[]
  restrictions?: {
    maxLength?: number | null
  }
}

export type ElementOptions =
  | ElementOptionsChoices
  | ElementOptionsNumerical
  | ElementOptionsFreeText

export interface BaseElementData {
  type: ElementType

  id: number
  name: string
  content: string
  pointsMultiplier: number
  explanation?: string | null

  options: object

  // TODO: these legacy props have been moved to options
  // displayMode: ElementDisplayMode
  // hasSampleSolution: boolean
  // hasAnswerFeedbacks: boolean
}

export type BaseElementDataKeys = (keyof BaseElementData)[]

interface IElementData<Type extends ElementType, Options extends ElementOptions>
  extends Element {
  type: Type
  options: Options
}

export type ChoicesElementData = IElementData<
  'SC' | 'MC' | 'KPRIM',
  ElementOptionsChoices
>
export type FreeTextElementData = IElementData<
  'FREE_TEXT',
  ElementOptionsFreeText
>
export type NumericalElementData = IElementData<
  'NUMERICAL',
  ElementOptionsNumerical
>

export type AllElementTypeData =
  | ChoicesElementData
  | FreeTextElementData
  | NumericalElementData

export interface IQuestionInstanceWithResults<
  Type extends ElementType,
  Results extends QuestionResults
> extends QuestionInstance {
  elementType?: Type
  questionData: AllElementTypeData
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
    type PrismaElementOptions = ElementOptions
    type PrismaQuestionResults = QuestionResults
    type PrismaElementData = AllElementTypeData
  }
}
