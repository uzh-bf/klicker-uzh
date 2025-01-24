import type {
  Element,
  ElementType,
  ObjectAccess,
  PerformanceLevel,
} from '@klicker-uzh/prisma'

export type ElementKeys = keyof Element

// ! Types used in helpers (this file) and across GraphQL
export enum DisplayMode {
  LIST = 'LIST',
  GRID = 'GRID',
}

export enum AccessType {
  OWNER = 'OWNER',
  SHARED = 'SHARED',
}

export enum CatalogObjectType {
  ANSWER_COLLECTION = 'ANSWER_COLLECTION',
  // TODO: add more object types once they are supported
  // ELEMENT = 'ELEMENT',
  // LIVE_QUIZ = 'LIVE_QUIZ',
  // PRACTICE_QUIZ = 'PRACTICE_QUIZ',
  // MICRO_LEARNING = 'MICRO_LEARNING',
  // GROUP_ACTIVITY = 'GROUP_ACTIVITY',
}

export enum ActivityType {
  LIVE_QUIZ = 'LIVE_QUIZ',
  PRACTICE_QUIZ = 'PRACTICE_QUIZ',
  MICRO_LEARNING = 'MICRO_LEARNING',
  GROUP_ACTIVITY = 'GROUP_ACTIVITY',
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

export type BlockInput = {
  timeLimit?: number | null
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

// ----- RESOURCES -----
// #region
export type ObjectSharingRequest = {
  permissionId: number
  objectName: string
  objectType: CatalogObjectType
  userId: string
  userShortname: string
  userEmail: string
}
// #endregion

// ----- CATALOG -----
// #region
export type CatalogObject = {
  id?: number
  uuid?: string
  name: string
  objectType: CatalogObjectType
  access: ObjectAccess
  ownerShortname?: string
  isRequested: boolean
  isShared: boolean
  isOwner: boolean
}

// #endregion

// ----- ELEMENT DATA AND INSTANCES -----
// #region
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

export type SingleQuestionResponseChoices = {
  choices: number[]
}

export type SingleQuestionResponseValue = {
  value: string
}

export type SingleQuestionResponseSelection = {
  selection: number[]
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
  | SingleQuestionResponseSelection

export type Choice = {
  ix: number
  value: string
  correct?: boolean
  feedback?: string
}

export type NumericalRestrictions = {
  min?: number | null
  max?: number | null
}

export type NumericalSolutionRange = {
  min?: number | null
  max?: number | null
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
  accuracy?: number | null
  placeholder?: string | null
  restrictions?: NumericalRestrictions | null
  solutionRanges?: NumericalSolutionRange[] | null
  exactSolutions?: number[] | null
}

export type FreeTextRestrictions = {
  maxLength?: number | null
}

export interface ElementOptionsFreeText extends BaseQuestionOptions {
  restrictions?: FreeTextRestrictions | null
  solutions?: string[] | null
}

export type SelectionAnswerCollectionEntry = {
  id: number
  value: string
}

export interface SelectionAnswerCollection {
  id: number
  entries: SelectionAnswerCollectionEntry[]
}

export interface ElementOptionsSelection extends BaseQuestionOptions {
  numberOfInputs?: number
  answerCollection?: SelectionAnswerCollection
  answerCollectionSolutionIds?: number[] | null
}

export interface ElementOptionsFlashcard {}
export interface ElementOptionsContent {}

export type ElementOptions =
  | ElementOptionsChoices
  | ElementOptionsNumerical
  | ElementOptionsFreeText
  | ElementOptionsFlashcard
  | ElementOptionsContent
  | ElementOptionsSelection

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

interface IElementData<Type extends ElementType, Options extends ElementOptions>
  extends Omit<Element, 'id'> {
  id: string
  type: Type
  options: Options
  elementId: number
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
export type SelectionElementData = IElementData<
  'SELECTION',
  ElementOptionsSelection
>

export type AllElementTypeData =
  | ChoicesElementData
  | FreeTextElementData
  | NumericalElementData
  | FlashcardElementData
  | ContentElementData
  | SelectionElementData

export type ElementInstanceOptions = {
  pointsMultiplier?: number
  resetTimeDays?: number
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

export type ElementResultsFlashcard = {
  [FlashcardCorrectness.INCORRECT]: number
  [FlashcardCorrectness.PARTIAL]: number
  [FlashcardCorrectness.CORRECT]: number
  total: number
}

export type ElementResultsContent = {
  total: number
}

export type ElementResultsSelection = {
  selections: Record<number, number>
  total: number
}

export type ElementInstanceResults =
  | ElementResultsChoices
  | ElementResultsOpen
  | ElementResultsFlashcard
  | ElementResultsContent
  | ElementResultsSelection

export type GroupActivityDecision = {
  instanceId: number
  type: ElementType
  freeTextResponse?: string | null
  choicesResponse?: number[] | null
  numericalResponse?: number | null
  contentResponse?: boolean | null
  selectionResponse?: number[] | null
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

interface IBaseInstanceEvaluation {
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

export type SingleChoiceResponse = { ix: number; count: number }
export interface IInstanceEvaluationChoices extends IBaseInstanceEvaluation {
  choices: SingleChoiceResponse[]
  lastResponse?: SingleQuestionResponseChoices | null
}
export type InstanceEvaluationChoices = IInstanceEvaluationChoices

export type SingleNumericalResponse = { count: number; value: number }
export interface IInstanceEvaluationNumerical extends IBaseInstanceEvaluation {
  responses?: SingleNumericalResponse[]
  solutionRanges?: NumericalSolutionRange[]
  exactSolutions?: number[]
  lastResponse?: SingleQuestionResponseValue | null
}
export type InstanceEvaluationNumerical = IInstanceEvaluationNumerical

export type SingleFreeTextResponse = { count: number; value: string }
export interface IInstanceEvaluationFreeText extends IBaseInstanceEvaluation {
  answers?: SingleFreeTextResponse[]
  solutions: string[]
  lastResponse?: SingleQuestionResponseValue | null
}
export type InstanceEvaluationFreeText = IInstanceEvaluationFreeText

export type SingleSelectionResponse = {
  answerId: number
  value: string
  count: number
}
export interface IInstanceEvaluationSelection extends IBaseInstanceEvaluation {
  selectionResponses?: SingleSelectionResponse[]
  answerSolutionIds?: number[]
  lastResponse?: SingleQuestionResponseSelection | null
}
export type InstanceEvaluationSelection = IInstanceEvaluationSelection

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
  | IInstanceEvaluationSelection
// #endregion

// ----- LEARNING ANALYTICS -----
// #region
export type PerformanceRates = {
  firstErrorRate: number
  lastErrorRate: number
  errorRate: number
  firstPartialRate: number
  lastPartialRate: number
  partialRate: number
  firstCorrectRate: number
  lastCorrectRate: number
  correctRate: number
}

export type ActivityPerformance = {
  id: number
  activityName: string
  activityType: ActivityType
  rates: PerformanceRates
}

export type ParticipantActivityPerformances = {
  participantId: string
  participantUsername: string
  participantEmail: string | null
  activityPerformances: ParticipantActivityPerformance[]
}

export type ParticipantActivityPerformance = {
  id: number
  activityId: string
  totalScore: number
  completion: number
}

export type InstancePerformance = {
  id: number
  elementName: string
  elementType: ElementType
  rates: PerformanceRates
}

export type ParticipantPerformance = {
  id: number
  firstErrorRate: number
  firstPerformance: PerformanceLevel
  lastErrorRate: number
  lastPerformance: PerformanceLevel
  totalErrorRate: number
  totalPerformance: PerformanceLevel
}

export type InstanceFeedback = {
  id: number
  activityType: ActivityType
  instanceName: string
  instanceType: ElementType
  upvoteRate: number
  downvoteRate: number
  feedbackCount: number
}

export type ActivityFeedback = {
  id: string
  activityType: ActivityType
  activityName: string
  upvoteRate: number
  downvoteRate: number
  feedbackCount: number
}

export type InstanceQuizAnalytics = {
  id: number
  elementName: string
  elementType: ElementType
  numberOfAnswers: number
  uniqueParticipants: number
  averageTimeSpent: number
  firstErrorRate?: number | null
  firstPartialRate?: number | null
  firstCorrectRate?: number | null
  lastErrorRate?: number | null
  lastPartialRate?: number | null
  lastCorrectRate?: number | null
  totalErrorRate: number
  totalPartialRate: number
  totalCorrectRate: number
  upvoteRate: number
  downvoteRate: number
  feedbackCount: number
}

export type ActivityQuizAnalytics = {
  id: number
  numberOfAnswers: number
  averageTimeSpent: number
  firstErrorRate?: number | null
  firstPartialRate?: number | null
  firstCorrectRate?: number | null
  lastErrorRate?: number | null
  lastPartialRate?: number | null
  lastCorrectRate?: number | null
  totalErrorRate: number
  totalPartialRate: number
  totalCorrectRate: number
}
// #endregion
