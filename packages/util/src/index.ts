import {
  type Element,
  type ElementStackType,
  type ElementType,
  type QuestionInstance,
  type SessionBlockStatus,
  ElementInstanceType as PrismaElementInstanceType,
  ElementType as PrismaElementType,
} from '@klicker-uzh/prisma'
import { pick } from 'remeda'

type ElementKeys = keyof Element
const RELEVANT_KEYS: ElementKeys[] = [
  'name',
  'content',
  'explanation',
  'pointsMultiplier',
  'type',
  'options',
]

export function processQuestionData(
  question: Element
): AllQuestionTypeData | null {
  if (
    question.type === PrismaElementType.SC ||
    question.type === PrismaElementType.MC ||
    question.type === PrismaElementType.KPRIM ||
    question.type === PrismaElementType.NUMERICAL ||
    question.type === PrismaElementType.FREE_TEXT
  ) {
    return {
      ...pick(question, RELEVANT_KEYS),
      id: `${question.id}-v${question.version}`,
      questionId: question.id,
    } as AllQuestionTypeData
  }
  return null
}

// save custom type
const CONTENT_KEYS: ElementKeys[] = [
  'name',
  'content',
  'type',
  'pointsMultiplier',
]
const FLASHCARD_KEYS: ElementKeys[] = [
  'name',
  'content',
  'explanation',
  'type',
  'pointsMultiplier',
]
const QUESTION_KEYS: ElementKeys[] = [
  'name',
  'content',
  'explanation',
  'pointsMultiplier',
  'type',
  'options',
]

export function processElementData(element: Element): AllElementTypeData {
  if (element.type === PrismaElementType.FLASHCARD) {
    return {
      ...pick(element, FLASHCARD_KEYS),
      id: `${element.id}-v${element.version}`,
      elementId: element.id,
    }
  } else if (
    element.type === PrismaElementType.SC ||
    element.type === PrismaElementType.MC ||
    element.type === PrismaElementType.KPRIM ||
    element.type === PrismaElementType.NUMERICAL ||
    element.type === PrismaElementType.FREE_TEXT
  ) {
    return {
      ...pick(element, QUESTION_KEYS),
      id: `${element.id}-v${element.version}`,
      elementId: element.id,
    }
  } else if (element.type === PrismaElementType.CONTENT) {
    return {
      ...pick(element, CONTENT_KEYS),
      id: `${element.id}-v${element.version}`,
      elementId: element.id,
    }
  } else {
    throw new Error(
      'Invalid element type encountered during element data processing'
    )
  }
}

export function getInitialElementResults(
  element: Element
): ElementInstanceResults {
  if (element.type === PrismaElementType.FLASHCARD) {
    return {
      INCORRECT: 0,
      PARTIAL: 0,
      CORRECT: 0,
      total: 0,
    }
  } else if (
    element.type === PrismaElementType.SC ||
    element.type === PrismaElementType.MC ||
    element.type === PrismaElementType.KPRIM
  ) {
    const choices = element.options.choices.reduce(
      (acc: Record<string, number>, _: any, ix: number) => ({
        ...acc,
        [ix]: 0,
      }),
      {}
    )
    return { choices, total: 0 }
  } else if (
    element.type === PrismaElementType.NUMERICAL ||
    element.type === PrismaElementType.FREE_TEXT
  ) {
    return {
      responses: {},
      total: 0,
    }
  } else if (element.type === PrismaElementType.CONTENT) {
    return {
      total: 0,
    }
  } else {
    throw new Error(
      'Invalid element type encountered during result initialization'
    )
  }
}

export function getInitialInstanceStatistics(type: PrismaElementInstanceType) {
  if (type === PrismaElementInstanceType.LIVE_QUIZ) {
    return undefined
  } else if (type === PrismaElementInstanceType.PRACTICE_QUIZ) {
    return {
      anonymousCorrectCount: 0,
      anonymousPartialCorrectCount: 0,
      anonymousWrongCount: 0,

      correctCount: 0,
      partialCorrectCount: 0,
      wrongCount: 0,
      firstCorrectCount: 0,
      firstPartialCorrectCount: 0,
      firstWrongCount: 0,
      lastCorrectCount: 0,
      lastPartialCorrectCount: 0,
      lastWrongCount: 0,

      upvoteCount: 0,
      downvoteCount: 0,

      uniqueParticipantCount: 0,
      averageTimeSpent: 0,
    }
  } else if (type === PrismaElementInstanceType.MICROLEARNING) {
    return {
      anonymousCorrectCount: 0,
      anonymousPartialCorrectCount: 0,
      anonymousWrongCount: 0,

      correctCount: 0,
      partialCorrectCount: 0,
      wrongCount: 0,

      upvoteCount: 0,
      downvoteCount: 0,

      uniqueParticipantCount: 0,
      averageTimeSpent: 0,
    }
  } else if (type === PrismaElementInstanceType.GROUP_ACTIVITY) {
    return {
      // correct counts are currently only set on group activity instance
      correctCount: -1,
      partialCorrectCount: -1,
      wrongCount: -1,

      upvoteCount: 0,
      downvoteCount: 0,

      uniqueParticipantCount: -1, // participant counts not available on group activities at the moment, group counts should be available from number of instances immediately
      averageTimeSpent: -1, // time tracking not available on group activities at the moment
    }
  }

  return undefined
}

// ! Types used in helpers (this file) and across GraphQL
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

export enum ResponseCorrectness {
  CORRECT = 'CORRECT',
  INCORRECT = 'INCORRECT',
  PARTIAL = 'PARTIAL',
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

// TODO: update during migration of live quiz -> element data instead of question data
export interface IQuestionInstanceWithResults<
  Type extends ElementType,
  Results extends QuestionResults,
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

export type QuestionOptions =
  | ElementOptionsChoices
  | ElementOptionsNumerical
  | ElementOptionsFreeText

export interface BaseElementData {
  id: string
  elementId: number
  type: ElementType
  name: string
  content: string
  pointsMultiplier: number
  explanation?: string | null
  options: object
}

// TODO: remove after migration of live quiz
export interface BaseQuestionData {
  id: string
  questionId: number
  type: ElementType
  name: string
  content: string
  pointsMultiplier: number
  explanation?: string | null
  options: object
}

interface IElementData<Type extends ElementType, Options extends ElementOptions>
  extends Omit<Element, 'id'> {
  id: string
  type: Type
  options: Options
  elementId: number
}

// TODO: remove after migration of live quiz
interface IQuestionData<
  Type extends ElementType,
  Options extends QuestionOptions,
> extends Omit<
    Element,
    | 'id'
    | 'originalId'
    | 'status'
    | 'version'
    | 'isArchived'
    | 'isDeleted'
    | 'ownerId'
    | 'createdAt'
    | 'updatedAt'
  > {
  id: string
  type: Type
  options: Options
  questionId: number
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

// TODO: remove after migration of live quiz
export type ChoicesQuestionData = IQuestionData<
  'SC' | 'MC' | 'KPRIM',
  ElementOptionsChoices
>
// TODO: remove after migration of live quiz
export type FreeTextQuestionData = IQuestionData<
  'FREE_TEXT',
  ElementOptionsFreeText
>
// TODO: remove after migration of live quiz
export type NumericalQuestionData = IQuestionData<
  'NUMERICAL',
  ElementOptionsNumerical
>

// TODO: remove after migration of live quiz
export type AllQuestionTypeData =
  | ChoicesQuestionData
  | FreeTextQuestionData
  | NumericalQuestionData

export type ElementInstanceOptions = {
  pointsMultiplier?: number
  resetTimeDays?: number
  maxBonusPoints?: number
  timeToZeroBonus?: number
}

export type ElementResultsChoices = {
  choices: Record<string, number>
  total: number
}

export type ElementResultsOpen = {
  responses: {
    [x: string]: {
      count: number
      value: string
      correct?: boolean
    }
  }
  total: number
}

export type FlashcardResults = {
  [FlashcardCorrectness.INCORRECT]: number
  [FlashcardCorrectness.PARTIAL]: number
  [FlashcardCorrectness.CORRECT]: number
  total: number
}

export type ContentResults = {
  total: number
}

export type ElementInstanceResults =
  | ElementResultsChoices
  | ElementResultsOpen
  | FlashcardResults
  | ContentResults

export type GroupActivityDecisions = {
  instanceId: number
  type: ElementType
  freeTextResponse?: string | null
  choicesResponse?: number[] | null
  numericalResponse?: number | null
  contentResponse?: boolean | null
}[]

export type GroupActivityResults = {
  passed: boolean
  points: number
  comment?: string | null
  grading: {
    instanceId: number
    score: number
    maxPoints: number
    feedback?: string | null
    correctness?: ResponseCorrectness
  }[]
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
  Options extends ElementStackOptions | null,
> {}

export type AllElementStackOptions =
  | IElementStackOptions<'LIVE_QUIZ', LiveQuizStackOptions>
  | IElementStackOptions<'PRACTICE_QUIZ', PracticeQuizStackOptions>
  | IElementStackOptions<'MICROLEARNING', MicrolearningStackOptions>
  | IElementStackOptions<'GROUP_ACTIVITY', GroupActivityStackOptions>

// #endregion
