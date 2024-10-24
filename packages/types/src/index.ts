import type {
  Element,
  ElementStackType,
  ElementType,
  QuestionInstance,
  SessionBlockStatus,
} from '@klicker-uzh/prisma'

export type ElementKeys = keyof Element

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
export type AvatarKeyTypes =
  | 'skinTone'
  | 'eyes'
  | 'mouth'
  | 'hair'
  | 'accessory'
  | 'hairColor'
  | 'clothing'
  | 'clothingColor'
  | 'facialHair'

export type AvatarHairTypes = 'long' | 'bun' | 'short' | 'buzz' | 'afro'
export type AvatarHairColorTypes = 'blonde' | 'black' | 'brown'
export type AvatarEyesTypes =
  | 'normal'
  | 'happy'
  | 'content'
  | 'squint'
  | 'heart'
  | 'wink'
export type AvatarAccessoryTypes =
  | 'none'
  | 'roundGlasses'
  | 'tinyGlasses'
  | 'shades'
export type AvatarMouthTypes = 'grin' | 'openSmile' | 'serious'
export type AvatarFacialHairTypes = 'none' | 'stubble' | 'mediumBeard'
export type AvatarClothingTypes = 'shirt' | 'dress' | 'dressShirt'
export type AvatarClothingColorTypes = 'blue' | 'green' | 'red'
export type AvatarSkinToneTypes = 'light' | 'dark'

export type AvatarOptions = {
  skinTone: AvatarSkinToneTypes[]
  eyes: AvatarEyesTypes[]
  mouth: AvatarMouthTypes[]
  hair: AvatarHairTypes[]
  accessory: AvatarAccessoryTypes[]
  hairColor: AvatarHairColorTypes[]
  clothing: AvatarClothingTypes[]
  clothingColor: AvatarClothingColorTypes[]
  facialHair: AvatarFacialHairTypes[]
}

export type AvatarSettings = {
  skinTone: AvatarSkinToneTypes
  eyes: AvatarEyesTypes
  mouth: AvatarMouthTypes
  hair: AvatarHairTypes
  accessory: AvatarAccessoryTypes
  hairColor: AvatarHairColorTypes
  clothing: AvatarClothingTypes
  clothingColor: AvatarClothingColorTypes
  facialHair: AvatarFacialHairTypes
}
// #endregion

// ----- ELEMENT DATA AND INSTANCES -----
// #region
export type SingleQuestionResponseChoices = {
  choices: number[]
}

export type SingleQuestionResponseValue = {
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

export type SingleQuestionResponseFlashcard = {
  correctness: FlashcardCorrectness
}

export type SingleQuestionResponseContent = {
  viewed: boolean
}

export type SingleQuestionResponse =
  | SingleQuestionResponseChoices
  | SingleQuestionResponseValue
  | SingleQuestionResponseFlashcard
  | SingleQuestionResponseContent

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

export type NumericalSolutionRange = {
  min?: number | null
  max?: number | null
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
  solutionRanges?: NumericalSolutionRange[]
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
  options: ElementOptions
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

export type GroupActivityDecision = {
  instanceId: number
  type: ElementType
  freeTextResponse?: string | null
  choicesResponse?: number[] | null
  numericalResponse?: number | null
  contentResponse?: boolean | null
}
export type GroupActivityDecisions = GroupActivityDecision[]

export type GroupActivityGrading = {
  instanceId: number
  score: number
  maxPoints: number
  feedback?: string | null
  correctness?: ResponseCorrectness
}

export type GroupActivityResults = {
  passed: boolean
  points: number
  comment?: string | null
  grading: GroupActivityGrading[]
}
// #endregion

// ----- INSTANCE EVALUATION -----
// #region
export interface IQuestionFeedback {
  ix: number
  feedback?: string
  correct?: boolean
  value: string
}

export interface IBaseInstanceEvaluation {
  instanceId: number
  elementType: ElementType
  score: number
  xp?: number | null
  pointsMultiplier: number
  explanation?: string | null
  feedbacks?: IQuestionFeedback[]
  numAnswers?: number
  pointsAwarded?: number | null
  percentile?: number
  newPointsFrom?: Date
  xpAwarded?: number
  newXpFrom?: Date
  correctness?: number | null
}

export interface IInstanceEvaluationChoices extends IBaseInstanceEvaluation {
  choices: Record<string, number> // instance results type cannot be represented with exact keys
  lastResponse?: SingleQuestionResponseChoices | null
}
export type InstanceEvaluationChoices = IInstanceEvaluationChoices

export interface IInstanceEvaluationNumerical extends IBaseInstanceEvaluation {
  answers?: Record<string, { count: number; value: string; correct?: boolean }> // instance results type cannot be represented with exact keys
  solutionRanges?: NumericalSolutionRange[]
  lastResponse?: SingleQuestionResponseValue | null
}
export type InstanceEvaluationNumerical = IInstanceEvaluationNumerical

export interface IInstanceEvaluationFreeText extends IBaseInstanceEvaluation {
  answers?: Record<string, { count: number; value: string; correct?: boolean }> // instance results type cannot be represented with exact keys
  solutions: string[]
  lastResponse?: SingleQuestionResponseValue | null
}
export type InstanceEvaluationFreeText = IInstanceEvaluationFreeText

export interface IInstanceEvaluationFlashcard extends IBaseInstanceEvaluation {
  lastResponse?: SingleQuestionResponseFlashcard | null
}
export type InstanceEvaluationFlashcard = IInstanceEvaluationFlashcard

export interface IInstanceEvaluationContent extends IBaseInstanceEvaluation {
  lastResponse?: SingleQuestionResponseContent | null
}
export type InstanceEvaluationContent = IInstanceEvaluationContent

export type InstanceEvaluation =
  | IInstanceEvaluationChoices
  | IInstanceEvaluationNumerical
  | IInstanceEvaluationFreeText
  | IInstanceEvaluationFlashcard
  | IInstanceEvaluationContent
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
