import type {
  AppliedPointCorrection,
  Element,
  ElementInstance,
  ElementStatus,
  ElementType,
  ObjectAccess,
  ObjectType,
  ParameterType,
  PerformanceLevel,
  PointCorrection,
  CodeSubmissionStatus as PrismaCodeSubmissionStatus,
  ResponseCorrectness as PrismaResponseCorrectness,
} from '@klicker-uzh/prisma/client'

// ----- HATCHET (WORKER/TASK) TYPES -----
export * from './assessmentReport.js'
export * from './hatchet.js'

// ----- ACTIVITY LOG TYPES -----
// #region
export enum ActivityLogModificationFieldType {
  TITLE = 'title',
  STATUS = 'status',
  CONTENT = 'content',
}

export interface ActivityLogModificationDetails {
  field: ActivityLogModificationFieldType | string
  oldValue: string
  newValue: string
}
// #endregion

export type ElementKeys = keyof Element

// ! Types used in helpers (this file) and across GraphQL
export enum DisplayMode {
  LIST = 'LIST',
  GRID = 'GRID',
}

export enum SortByType {
  TITLE = 'TITLE',
  TYPE = 'TYPE',
  STATUS = 'STATUS',
  CREATED = 'CREATED',
  MODIFIED = 'MODIFIED',
}

export enum ActivityType {
  LIVE_QUIZ = 'LIVE_QUIZ',
  PRACTICE_QUIZ = 'PRACTICE_QUIZ',
  MICRO_LEARNING = 'MICRO_LEARNING',
  GROUP_ACTIVITY = 'GROUP_ACTIVITY',
}

export type CodeActivityStackViolation =
  | 'UNSUPPORTED_ACTIVITY'
  | 'CODE_MUST_BE_ONLY_ELEMENT'

export function getCodeActivityStackViolation(
  elementTypes: readonly string[],
  allowCodeElements: boolean
): CodeActivityStackViolation | null {
  if (!elementTypes.includes('CODE')) {
    return null
  }

  if (!allowCodeElements) {
    return 'UNSUPPORTED_ACTIVITY'
  }

  return elementTypes.length === 1 ? null : 'CODE_MUST_BE_ONLY_ELEMENT'
}

export enum SharingType {
  OWNED = 'OWNED', // owned objects
  SHARED = 'SHARED', // objects shared directly with the user (potentially through user group)
  DEPENDENCY = 'DEPENDENCY', // objects shared with the user indirectly (through the object being a dependency of another object)
}

export type ElementBlockInput = {
  order: number
  timeLimit?: number | null
  elements: ElementInstanceInput[]
}

export type ElementStackInput = {
  order: number
  displayName?: string | null
  description?: string | null
  elements: ElementInstanceInput[]
}

export type ElementInstanceInput = {
  elementId: number
  order: number
  existingInstanceId?: number | null
  duplicateInstance: boolean
}

export type ElementVersionInput = {
  instanceId: number
  version: number
}

export type CaseStudyCriterionResponse = {
  criterionId: string
  response: number
}

export type CaseStudyItemResponse = {
  itemId: number
  criterionResponses: CaseStudyCriterionResponse[]
}

export type CaseStudyCaseResponse = {
  caseId: string
  itemResponses: CaseStudyItemResponse[]
}

export type CaseStudyResponseObject = {
  [caseId: string]: {
    [itemId: number]: {
      [criterionId: string]: number // value = response
    }
  }
}

export type ChoiceInput = {
  ix: number
  value: string
  correct?: boolean | null
  feedback?: string | null
}

export type OptionsChoicesInput = {
  displayMode?: DisplayMode | null
  hasSampleSolution?: boolean | null
  hasAnswerFeedbacks?: boolean | null
  choices?: ChoiceInput[] | null
}

export type NumericalRestrictionsInput = {
  min?: number | null
  max?: number | null
}

export type SolutionRangeInput = {
  min?: number | null
  max?: number | null
}

export type OptionsNumericalInput = {
  hasSampleSolution?: boolean | null
  hasAnswerFeedbacks?: boolean | null
  accuracy?: number | null
  unit?: string | null
  restrictions?: NumericalRestrictionsInput | null
  solutionRanges?: SolutionRangeInput[] | null
  exactSolutions?: number[] | null
  feedback?: string | null
}

export type FreeTextRestrictionsInput = {
  maxLength?: number | null
  minLength?: number | null
  pattern?: string | null
}

export type OptionsFreeTextInput = {
  hasSampleSolution?: boolean | null
  hasAnswerFeedbacks?: boolean | null
  placeholder?: string | null
  restrictions?: FreeTextRestrictionsInput | null
  solutions?: string[] | null
  feedback?: string | null
}

export type CaseStudyCriteriaSolutionInput = {
  criterionId: string
  min: number
  max: number
}

export type CaseStudySolutionInput = {
  itemId: number
  criteriaSolutions: CaseStudyCriteriaSolutionInput[]
}

export type CaseStudyCriterionLabelsInput = {
  min: string
  mid?: string | null
  max: string
}

export type CaseStudyCriterionInput = {
  id: string
  name: string
  order: number
  min: number
  max: number
  step: number
  unit?: string | null
  labels?: CaseStudyCriterionLabelsInput | null
}

export type CaseStudyCaseInput = {
  id: string
  title: string
  description: string
  order: number
  solutions?: CaseStudySolutionInput[] | null
}

export type OptionsCaseStudyInput = {
  hasSampleSolution?: boolean | null
  answerCollection?: number | null
  collectionItemIds?: number[] | null
  criteria?: CaseStudyCriterionInput[] | null
  cases?: CaseStudyCaseInput[] | null
}

export type OptionsSelectionInput = {
  hasSampleSolution?: boolean | null
  answerCollection?: number | null
  numberOfInputs?: number | null
  correctAnswers?: number[] | null
}

export type JsonValue =
  | boolean
  | number
  | string
  | null
  | JsonValue[]
  | { [key: string]: JsonValue }

export type CodeLanguage = 'python'
export type CodeTestVisibility = 'public' | 'hidden'

export type CodeTestCaseInput = {
  id: string
  name: string
  args?: unknown[] | null
  expectedOutput?: unknown
  visibility: CodeTestVisibility
  weight: number
}

export type CodeExecutionLimitsInput = {
  perTestTimeoutSeconds?: number | null
}

export type OptionsCodeInput = {
  language?: CodeLanguage | null
  starterCode?: string | null
  sampleSolution?: string | null
  entrypoint?: string | null
  testCases?: CodeTestCaseInput[] | null
  executionLimits?: CodeExecutionLimitsInput | null
  hasSampleSolution?: boolean | null
}

export type CodeTestResult = {
  id: string
  passed: boolean
}

export type CodePublicTestResult = CodeTestResult & {
  name: string
  actualOutput?: JsonValue
  stdout?: string
  stderr?: string
}

export type CodeSubmissionFeedback = {
  pointsPercentage: number
  publicTestResults: CodePublicTestResult[]
}

export type CodeSubmissionResult = CodeSubmissionFeedback & {
  hiddenTestResults: CodeTestResult[]
}

export type CodeSubmissionStatus = PrismaCodeSubmissionStatus

export type CodeSubmissionReceipt = {
  id: string
  gradingStatus: CodeSubmissionStatus
  feedback?: CodeSubmissionFeedback | null
}

export type ResponseInput = {
  choices?: ChoicesResponse[] | null // SC / MC / KPRIM
  value?: string | null // FREE_TEXT / NUMERICAL
  selection?: number[] | null // SELECTION
  assessment?: CaseStudyCaseResponse[] | null // CASE_STUDY
  viewed?: boolean | null // CONTENT
  code?: string | null // CODE
}

export type LiveQuizResponseInput = {
  choices?: ChoicesResponse[] | null // SC / MC / KPRIM
  value?: string | null // FREE_TEXT / NUMERICAL
  selection?: number[] | null // SELECTION
  assessment?: CaseStudyResponseObject | null // CASE_STUDY - no need to convert to array for pothos validation in live quiz submissions
  viewed?: boolean | null // CONTENT
}

export type ElementOptionsInput = OptionsChoicesInput &
  OptionsNumericalInput &
  OptionsFreeTextInput &
  OptionsSelectionInput &
  OptionsCaseStudyInput &
  OptionsCodeInput

export type ElementManipulationInput = {
  id?: number | null
  status?: ElementStatus | null
  type: ElementType
  name?: string | null
  content?: string | null
  explanation?: string | null
  options?: ElementOptionsInput | null
  choicesOptions?: OptionsChoicesInput | null
  numericalOptions?: OptionsNumericalInput | null
  freeTextOptions?: OptionsFreeTextInput | null
  selectionOptions?: OptionsSelectionInput | null
  caseStudyOptions?: OptionsCaseStudyInput | null
  basePoints?: boolean | null
  pointsMultiplier?: number | null
  tags?: string[] | null
  // boolean to signal that the element is created in template mode (modified check for permissions on answer collections)
  templateId?: string | null
}

export type TemplateBlockElementInput = {
  order: number
  useExistingElement: boolean // boolean to signal that an existing element should be loaded into the template
  existingElementId?: number | null // id of the existing instance that should be loaded into the template
  useNewElement: boolean // boolean to signal that either the existing template instance should be copied into the user account or a new element should be created
  newElement?: ElementManipulationInput | null // content for the element, if the user has chosen to insert their own content
}

export type TemplateBlockInput = {
  timeLimit?: number | null
  order: number
  elements: TemplateBlockElementInput[]
}

export type ChoicesResponse = {
  ix: number
  selected: boolean
}

export type StackResponseInput = {
  instanceId: number
  type: ElementType
  flashcardResponse?: FlashcardCorrectness | null
  contentReponse?: boolean | null
  choicesResponse?: ChoicesResponse[] | null
  numericalResponse?: number | null
  freeTextResponse?: string | null
  selectionResponse?: number[] | null
  caseStudyResponse?: CaseStudyCaseResponse[] | null
  codeResponse?: string | null
}

export type GroupActivityClueInput = {
  name: string
  displayName: string
  type: ParameterType
  value: string
  unit?: string | null
}

export type GroupActivityGradingDecisionInput = {
  instanceId: number
  score: number
  feedback?: string | null
}

export type GroupActivityGradingInput = {
  passed: boolean
  comment?: string | null
  grading: GroupActivityGradingDecisionInput[]
}

export type AvatarSettingsInput = {
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

export type SubscriptionKeysInput = {
  p256dh: string
  auth: string
}

export type SubscriptionObjectInput = {
  endpoint: string
  expirationTime?: number | null
  keys: SubscriptionKeysInput
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
  requestId: number
  objectName: string
  objectType: ObjectType
  userId: string
  userShortname: string
  userEmail: string
}
// #endregion

// ----- CATALOG -----
// #region
export type CatalogObject = {
  id: number // assignment id
  objectId?: number // object id
  objectUuid?: string // object uuid
  name: string
  objectType: ObjectType
  templateId?: string
  access: ObjectAccess
  ownerShortname?: string
  isOwner: boolean
  isManager: boolean
  isRequested: boolean
  isShared: boolean
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
  choices: ChoicesResponse[]
}

export type SingleQuestionResponseValue = {
  value: string
}

export type SingleQuestionResponseSelection = {
  selection: number[]
}

export type SingleQuestionResponseCaseStudy = {
  assessment: {
    caseId: string
    itemResponses: {
      itemId: number
      criterionResponses: {
        criterionId: string
        response: number
        correct?: boolean
      }[]
    }[]
  }[]
}

export type SingleQuestionResponseFlashcard = {
  correctness: FlashcardCorrectness
}

export type SingleQuestionResponseContent = {
  viewed: boolean
}

export type SingleQuestionResponseCode = {
  code: string
}

export type SingleQuestionResponse =
  | SingleQuestionResponseChoices
  | SingleQuestionResponseValue
  | SingleQuestionResponseFlashcard
  | SingleQuestionResponseContent
  | SingleQuestionResponseSelection
  | SingleQuestionResponseCaseStudy
  | SingleQuestionResponseCode

export type SingleQuestionResponseLiveQuizCaseStudy = {
  assessment: CaseStudyResponseObject
}

export type SingleQuestionResponseLiveQuiz =
  | SingleQuestionResponseChoices
  | SingleQuestionResponseValue
  | SingleQuestionResponseFlashcard
  | SingleQuestionResponseContent
  | SingleQuestionResponseSelection
  | SingleQuestionResponseLiveQuizCaseStudy

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

interface BaseElementOptions {
  hasSampleSolution?: boolean
  hasAnswerFeedbacks?: boolean
}

export interface ElementOptionsChoices extends BaseElementOptions {
  choices: Choice[]
  displayMode: DisplayMode
}

export interface ElementOptionsNumerical extends BaseElementOptions {
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

export interface ElementOptionsFreeText extends BaseElementOptions {
  restrictions?: FreeTextRestrictions | null
  solutions?: string[] | null
}

export type ElementOptionsAnswerCollectionEntry = {
  id: number
  value: string
}

export interface ElementOptionsAnswerCollection {
  id: number
  entries: ElementOptionsAnswerCollectionEntry[]
}

export interface ElementOptionsSelection extends BaseElementOptions {
  numberOfInputs: number
  answerCollection?: ElementOptionsAnswerCollection // instance and element data fetching only (not stored here on db element = relation)
  answerCollectionSolutionIds?: number[] | null // instance and element data fetching only (not stored here on db element = relation)
}

export type CaseStudyCriterionLabels = {
  min: string
  mid?: string | null
  max: string
}

export type CaseStudyCriterion = {
  id: string // use nanoid (as for choices) to simplify distinction from items & ordering
  name: string
  order?: number
  min: number
  max: number
  step: number
  unit?: string | null
  labels?: CaseStudyCriterionLabels | null
}

export type CaseStudyCaseCriterionSolution = {
  criterionId: string
  min: number
  max: number
}

export type CaseStudyCaseSolution = {
  itemId: number
  criteriaSolutions: CaseStudyCaseCriterionSolution[]
}

export type CaseStudyCase = {
  id: string // use nanoid (as for choices) to simplify distinction from items & ordering
  title: string
  description: string
  order?: number
  solutions?: CaseStudyCaseSolution[] | null
}

export interface ElementOptionsCaseStudy extends BaseElementOptions {
  answerCollectionId?: number // instance and element data fetching only (not stored here on db element = relation)
  collectionItemIds?: number[] // for element data fetching only
  items?: ElementOptionsAnswerCollectionEntry[] // instance only
  criteria: CaseStudyCriterion[]
  cases: CaseStudyCase[]
}

export type CodeTestCase = {
  id: string
  name: string
  args: JsonValue[]
  expectedOutput: JsonValue
  visibility: CodeTestVisibility
  weight: number
}

export interface ElementOptionsCode extends BaseElementOptions {
  language: CodeLanguage
  starterCode?: string
  sampleSolution?: string
  entrypoint: string
  testCases: CodeTestCase[]
  executionLimits: {
    perTestTimeoutSeconds: 5
  }
}

export type PublicCodeTestCase = Pick<
  CodeTestCase,
  'id' | 'name' | 'args' | 'expectedOutput'
>

export interface PublicElementOptionsCode {
  language: CodeLanguage
  starterCode?: string
  entrypoint: string
  testCases: PublicCodeTestCase[]
  executionLimits: {
    perTestTimeoutSeconds: 5
  }
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
  | ElementOptionsCaseStudy
  | ElementOptionsCode

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
export type CaseStudyElementData = IElementData<
  'CASE_STUDY',
  ElementOptionsCaseStudy
>
export type CodeElementData = IElementData<'CODE', ElementOptionsCode>

export type PublicCodeElementData = Omit<CodeElementData, 'options'> & {
  options: PublicElementOptionsCode
}

export type ElementData =
  | ChoicesElementData
  | FreeTextElementData
  | NumericalElementData
  | FlashcardElementData
  | ContentElementData
  | SelectionElementData
  | CaseStudyElementData
  | CodeElementData

export type ParticipantElementData =
  | Exclude<ElementData, CodeElementData>
  | PublicCodeElementData

export type ElementInstanceOptions = {
  basePoints?: boolean
  pointsMultiplier?: number
  resetTimeDays?: number
}

export type ElementResultsChoices = {
  choices: Record<string, number>
  total: number
}

export type ElementResultsOpen = {
  responses: {
    [md5Hash: string]: {
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
  selections: Record<string, number>
  total: number
}

export type ElementResultsCaseStudy = {
  // student responses are stored with keys: caseId, itemId, criterionId, response map as for open results
  assessments: {
    [caseId: string]: {
      [itemId: string]: {
        [criterionId: string]: {
          [md5Hash: string]: {
            value: number
            count: number
            correct?: boolean
          }
        }
      }
    }
  }
  total: number
}

export type ElementResultsCode = {
  tests: Record<string, { passed: number; total: number }>
  submissions: Record<string, true>
  total: number
}

export type ElementInstanceResults =
  | ElementResultsChoices
  | ElementResultsOpen
  | ElementResultsFlashcard
  | ElementResultsContent
  | ElementResultsSelection
  | ElementResultsCaseStudy
  | ElementResultsCode

export type GroupActivityDecision = {
  instanceId: number
  type: ElementType
  freeTextResponse?: SingleQuestionResponseValue['value'] | null
  choicesResponse?: SingleQuestionResponseChoices['choices'] | null
  numericalResponse?: number | null
  contentResponse?: SingleQuestionResponseContent['viewed'] | null
  selectionResponse?: SingleQuestionResponseSelection['selection'] | null
  caseStudyResponse?: SingleQuestionResponseCaseStudy['assessment'] | null
  codeResponse?: string | null
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

export type CaseStudySolutionsObject = {
  [caseId: string]: {
    [itemId: string]: {
      [criterionId: string]: {
        min: number
        max: number
      }
    }
  }
}
export type CaseStudySolution = {
  caseId: string
  solutions: CaseStudyCaseSolution[] // format of solutions in element options / elementData
}
// ? Caution: The following type does not coincide with the results structure in the database (for less required computations in the frontend)
export type SingleCaseStudyResponse = {
  caseId: string
  itemId: number
  criterionId: string
  responseValues: number[] // responses by other participants (irrespective of count)
}
export interface IInstanceEvaluationCaseStudy extends IBaseInstanceEvaluation {
  assessments?: SingleCaseStudyResponse[]
  studySolutions?: CaseStudySolution[]
  lastResponse?: SingleQuestionResponseCaseStudy | null
}
export type InstanceEvaluationCaseStudy = IInstanceEvaluationCaseStudy

export interface IInstanceEvaluationFlashcard extends IBaseInstanceEvaluation {
  lastResponse?: SingleQuestionResponseFlashcard | null
}
export type InstanceEvaluationFlashcard = IInstanceEvaluationFlashcard

export interface IInstanceEvaluationContent extends IBaseInstanceEvaluation {
  lastResponse?: SingleQuestionResponseContent | null
}
export type InstanceEvaluationContent = IInstanceEvaluationContent

export type CodeTestEvaluation = {
  id: string
  name: string
  passedCount: number
  totalCount: number
}

export interface IInstanceEvaluationCode extends IBaseInstanceEvaluation {
  testResults?: CodeTestEvaluation[]
  lastResponse?: SingleQuestionResponseCode | null
}
export type InstanceEvaluationCode = IInstanceEvaluationCode

export type InstanceEvaluation =
  | IInstanceEvaluationChoices
  | IInstanceEvaluationNumerical
  | IInstanceEvaluationFreeText
  | IInstanceEvaluationFlashcard
  | IInstanceEvaluationContent
  | IInstanceEvaluationSelection
  | IInstanceEvaluationCaseStudy
  | IInstanceEvaluationCode
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

// ----- ASSESSMENT -----
// #region
export type ActivityStudentPerformance = {
  id: string
  activityId: string
  displayName: string
  finishedAt: Date
  multiplier: number
  basePoints: number
  availableBasePoints: number
  correctnessPoints: number
  availableCorrectnessPoints: number
  bonusPoints: number
  availableBonusPoints: number
  corrections: StudentPointCorrection[]
}

export type StudentPointCorrection = {
  id: number
  lecturerReason?: string | null
  studentReason: string
  awardedBasePoints: number
  awardedCorrectnessPoints: number
  awardedBonusPoints: number
  deductedBasePoints: number
  deductedCorrectnessPoints: number
  deductedBonusPoints: number
}

export type StudentAssessmentResultsItem = {
  participantId: string
  participantEmail: string
  basePoints: number
  correctnessPoints: number
  bonusPoints: number
}
export type AssessmentResultsLiveQuiz = {
  name: string
  quizBasePoints: number
  quizCorrectnessPoints: number
  quizBonusPoints: number
  availableBasePoints: number
  availableCorrectnessPoints: number
  availableBonusPoints: number
  numberOfCorrections: number
  studentResults: StudentAssessmentResultsItem[]
}
export type AssessmentResultsCourse = {
  name: string
  availableBasePoints: number
  availableCorrectnessPoints: number
  availableBonusPoints: number
  numberOfCorrections: number
  studentResults: StudentAssessmentResultsItem[]
}

export type StudentAssessmentBlockResponse = {
  blockId: number
  instances: StudentAssessmentInstanceResponse[]
}
export type StudentAssessmentInstanceResponse = {
  instance: ElementInstance
  corrections: (AppliedPointCorrection & {
    pointCorrection: PointCorrection
  })[]
  basePoints: number
  correctnessPoints: number
  bonusPoints: number
  correctness?: PrismaResponseCorrectness | null
  submission?: SingleQuestionResponseLiveQuiz | null
}

export enum PointCorrectionType {
  ALL_COURSE = 'ALL_COURSE',
  PARTICIPATING = 'PARTICIPATING',
  SINGLE = 'SINGLE',
  MULTIPLE = 'MULTIPLE',
}
// #endregion
