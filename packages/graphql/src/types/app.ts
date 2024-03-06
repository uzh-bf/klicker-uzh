import {
  Element,
  ElementStackType,
  ElementType,
  Prisma,
  PrismaClient,
  QuestionInstance,
  SessionBlockStatus,
} from '@klicker-uzh/prisma'

export enum DisplayMode {
  LIST = 'LIST',
  GRID = 'GRID',
}

export enum QuestionType {
  SC = 'SC',
  MC = 'MC',
  KPRIM = 'KPRIM',
  NUMERICAL = 'NUMERICAL',
  FREE_TEXT = 'FREE_TEXT',
}

export type StackInput = {
  displayName?: string | null
  description?: string | null
  order: number
  elements: {
    elementId: number
    order: number
  }[]
}

export type PrismaMigrationClient = Omit<
  PrismaClient<Prisma.PrismaClientOptions, never>,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>

// ----- AVATAR SETTINGS -----
// #region
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

declare global {
  namespace PrismaJson {
    type PrismaAvatarSettings = AvatarSettings
  }
}
// #endregion

// ----- ELEMENT DATA AND INSTANCES -----
// #region
export type QuestionResponseChoices = {
  choices: number[]
}

export type QuestionResponseValue = {
  value: string
}

export enum FlashcardCorrectness {
  INCORRECT = 'INCORRECT',
  PARTIAL = 'PARTIAL',
  CORRECT = 'CORRECT',
}

export enum StackFeedbackStatus {
  UNANSWERED = 'unanswered',
  MANUALLY_GRADED = 'manuallyGraded',
  CORRECT = 'correct',
  INCORRECT = 'incorrect',
  PARTIAL = 'partial',
}

export type QuestionResponseFlashcard = {
  correctness: FlashcardCorrectness
}

export type QuestionResponseContent = {
  viewed: boolean
}

export type QuestionResponse =
  | QuestionResponseChoices
  | QuestionResponseValue
  | QuestionResponseFlashcard
  | QuestionResponseContent

export type QuestionResultsChoices = {
  choices: Record<string, number>
  total: number
}

export type QuestionResultsOpen = {
  responses: {
    [x: string]: {
      count: number
      value: string
      correct?: boolean
    }
  }
  total: number
}

export type QuestionResults = QuestionResultsChoices | QuestionResultsOpen

export type Choice = {
  ix: number
  value: string
  correct?: boolean
  feedback?: string
}

export type ChoicesInputType = {
  type: QuestionType.SC | QuestionType.MC | QuestionType.KPRIM
  value: number[]
}

export type NumericalInputType = {
  type: QuestionType.NUMERICAL
  value: number
}

export type FreeTextInputType = {
  type: QuestionType.FREE_TEXT
  value: string
}

interface BaseQuestionOptions {
  hasSampleSolution?: boolean
  hasAnswerFeedbacks?: boolean
}

export interface ElementOptionsChoices extends BaseQuestionOptions {
  choices: Choice[]
  displayMode: DisplayMode
}

export interface ElementOptionsNumerical extends BaseQuestionOptions {
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

export interface ElementOptionsFreeText extends BaseQuestionOptions {
  solutions?: string[]
  restrictions?: {
    maxLength?: number | null
  }
}

// TODO: no options for FC and CONTENT?
export interface ElementOptionsFlashcard {}
export interface ElementOptionsContent {}

export type ElementOptions =
  | ElementOptionsChoices
  | ElementOptionsNumerical
  | ElementOptionsFreeText
  | ElementOptionsFlashcard
  | ElementOptionsContent

export interface BaseElementData {
  type: ElementType

  id: string
  elementId: number | null // TODO - remove nullability
  questionId?: number | null // TODO - remove questionId after migration
  name: string
  content: string
  pointsMultiplier: number
  explanation?: string | null

  options: object
}

export type BaseElementDataKeys = (keyof BaseElementData)[]

interface IElementData<Type extends ElementType, Options extends ElementOptions>
  extends Omit<Element, 'id'> {
  type: Type
  options: Options
  id: string
  elementId: number | null // TODO - remove nullability
  questionId?: number | null // TODO - remove questionId after migration
}

// export type FlashcardElementData = IElementData<'FLASHCARD', null>

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
export type FlashcardElementData = IElementData<
  'FLASHCARD',
  ElementOptionsFlashcard
>
export type ContentElementData = IElementData<'CONTENT', ElementOptionsContent>

export type AllElementTypeData =
  | ChoicesElementData
  | FreeTextElementData
  | NumericalElementData
  | FlashcardElementData
  | ContentElementData

export type ElementInstanceOptions = {
  pointsMultiplier?: number
  resetTimeDays?: number
}

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

export type FlashcardInstanceResults = {
  [FlashcardCorrectness.INCORRECT]: number
  [FlashcardCorrectness.PARTIAL]: number
  [FlashcardCorrectness.CORRECT]: number
  total: number
}

export type ContentInstanceResults = {
  total: number
}

export type ElementInstanceResults =
  | FlashcardInstanceResults
  | ContentInstanceResults
  | AllQuestionInstanceTypeData

export type GroupActivityDecisions = {
  instanceId: number
  type: ElementType
  freeTextResponse?: string
  choicesResponse?: number[]
  numericalResponse?: number
  contentResponse?: boolean
}[]

declare global {
  namespace PrismaJson {
    type PrismaQuestionResponse = QuestionResponse
    type PrismaElementOptions = ElementOptions
    type PrismaQuestionResults = QuestionResults
    type PrismaElementData = AllElementTypeData
    type PrismaElementInstanceOptions = ElementInstanceOptions
    type PrismaElementInstanceResults = ElementInstanceResults
    type PrismaGroupActivityDecisions = GroupActivityDecisions
  }
}
// #endregion

// ----- ELEMENT STACKS -----
// #region
export type LiveQuizStackOptions = {
  timeLimit?: number
  expiresAt?: Date
  randomSelection?: number
  // TODO: by moving it here, we lose the default value, so ensure it is set in backend code correctly
  execution: number
  // TODO: rename the enum for consistency
  status: SessionBlockStatus
}

export type MicrolearningStackOptions = {}

export type PracticeQuizStackOptions = {}

export type GroupActivityStackOptions = {}

export type ElementStackOptions =
  | LiveQuizStackOptions
  | MicrolearningStackOptions
  | PracticeQuizStackOptions
  | GroupActivityStackOptions

interface IElementStackOptions<
  Type extends ElementStackType,
  Options extends ElementStackOptions | null
> {}

export type AllElementStackOptions =
  | IElementStackOptions<'LIVE_QUIZ', LiveQuizStackOptions>
  | IElementStackOptions<'PRACTICE_QUIZ', PracticeQuizStackOptions>
  | IElementStackOptions<'MICROLEARNING', MicrolearningStackOptions>
  | IElementStackOptions<'GROUP_ACTIVITY', GroupActivityStackOptions>

declare global {
  namespace PrismaJson {
    type PrismaElementStackOptions = ElementStackOptions
  }
}
// #endregion
