import * as DB from '@klicker-uzh/prisma/client'
import {
  ActivityType as ActivityTypeEnum,
  SortByType as SortByTypeEnum,
  type CaseStudyCaseInput as CaseStudyCaseInputType,
  type CaseStudyCriteriaSolutionInput as CaseStudyCriteriaSolutionInputType,
  type CaseStudyCriterionInput as CaseStudyCriterionInputType,
  type CaseStudyCriterionLabelsInput as CaseStudyCriterionLabelsInputType,
  type CaseStudySolutionInput as CaseStudySolutionInputType,
  type CaseStudySolution as CaseStudySolutionType,
  type ChoiceInput as ChoiceInputType,
  type ChoicesResponse as ChoicesResponseType,
  type CodeTestCaseInput as CodeTestCaseInputType,
  type ElementManipulationInput as ElementManipulationInputType,
  type ElementOptionsCaseStudy as ElementOptionsCaseStudyType,
  type ElementOptionsChoices as ElementOptionsChoicesType,
  type ElementOptionsCode as ElementOptionsCodeType,
  type ElementOptionsFreeText as ElementOptionsFreeTextType,
  type ElementOptionsNumerical as ElementOptionsNumericalType,
  type ElementOptionsSelection as ElementOptionsSelectionType,
  type FreeTextRestrictionsInput as FreeTextRestrictionsInputType,
  type IInstanceEvaluationCaseStudy,
  type IInstanceEvaluationChoices,
  type IInstanceEvaluationCode,
  type IInstanceEvaluationContent,
  type IInstanceEvaluationFlashcard,
  type IInstanceEvaluationFreeText,
  type IInstanceEvaluationNumerical,
  type IInstanceEvaluationSelection,
  type IQuestionFeedback,
  type NumericalRestrictionsInput as NumericalRestrictionsInputType,
  type OptionsCaseStudyInput as OptionsCaseStudyInputType,
  type OptionsChoicesInput as OptionsChoicesInputType,
  type OptionsCodeInput as OptionsCodeInputType,
  type OptionsFreeTextInput as OptionsFreeTextInputType,
  type OptionsNumericalInput as OptionsNumericalInputType,
  type OptionsSelectionInput as OptionsSelectionInputType,
  type ResponseInput as ResponseInputType,
  type SingleCaseStudyResponse as SingleCaseStudyResponseType,
  type SingleChoiceResponse as SingleChoiceResponseType,
  type SingleFreeTextResponse as SingleFreeTextResponseType,
  type SingleNumericalResponse as SingleNumericalRepsonseType,
  type SingleQuestionResponseCaseStudy as SingleQuestionResponseCaseStudyType,
  type SingleQuestionResponseChoices as SingleQuestionResponseChoicesType,
  type SingleQuestionResponseCode as SingleQuestionResponseCodeType,
  type SingleQuestionResponseContent as SingleQuestionResponseContentType,
  type SingleQuestionResponseFlashcard as SingleQuestionResponseFlashcardType,
  type SingleQuestionResponseSelection as SingleQuestionResponseSelectionType,
  type SingleQuestionResponseValue as SingleQuestionResponseValueType,
  type SingleSelectionResponse as SingleSelectionResponseType,
  type SolutionRangeInput as SolutionRangeInputType,
  type TemplateBlockElementInput as TemplateBlockElementInputType,
  type TemplateBlockInput as TemplateBlockInputType,
} from '@klicker-uzh/types'
import builder from '../builder.js'
import { ActivityType, ElementFeedbackRef } from './analytics.js'
import { CodeTestEvaluation } from './code.js'
import {
  AuthoringCodeElementData,
  CaseStudyCaseSolution,
  CaseStudyElementOptions,
  ChoiceElementOptions,
  CodeElementOptions,
  CodeLanguage,
  CodeTestVisibility,
  ElementData,
  ElementDisplayMode,
  ElementInstanceOptions,
  ElementInstanceType,
  ElementStatus,
  ElementType,
  FreeTextElementOptions,
  NumericalElementOptions,
  NumericalSolutionRange,
  SelectionElementOptions,
} from './elementData.js'
import { FlashcardCorrectness } from './evaluation.js'
import {
  CaseStudyCaseResponse,
  ChoicesResponse,
  PublicationStatus,
} from './practiceQuiz.js'
import { PermissionLevel, SharingType } from './sharing.js'

export const SortByType = builder.enumType('SortByType', {
  values: Object.values(SortByTypeEnum),
})

// ----- QUESTION INPUTS -----
// #region
export const ChoiceInputRef = builder.inputRef<ChoiceInputType>('ChoiceInput')
export const ChoiceInput = ChoiceInputRef.implement({
  fields: (t) => ({
    ix: t.int({ required: true }),
    value: t.string({ required: true }),
    correct: t.boolean({ required: false }),
    feedback: t.string({ required: false }),
  }),
})

export const OptionsChoicesInputRef = builder.inputRef<OptionsChoicesInputType>(
  'OptionsChoicesInput'
)
export const OptionsChoicesInput = OptionsChoicesInputRef.implement({
  fields: (t) => ({
    displayMode: t.field({ required: false, type: ElementDisplayMode }),
    hasSampleSolution: t.boolean({ required: false }),
    hasAnswerFeedbacks: t.boolean({ required: false }),
    choices: t.field({
      required: false,
      type: [ChoiceInput],
    }),
  }),
})

export const NumericalRestrictionsInputRef =
  builder.inputRef<NumericalRestrictionsInputType>('NumericalRestrictionsInput')
export const NumericalRestrictionsInput =
  NumericalRestrictionsInputRef.implement({
    fields: (t) => ({
      min: t.float({ required: false }),
      max: t.float({ required: false }),
    }),
  })

export const SolutionRangeInputRef =
  builder.inputRef<SolutionRangeInputType>('SolutionRangeInput')
export const SolutionRangeInput = SolutionRangeInputRef.implement({
  fields: (t) => ({
    min: t.float({ required: false }),
    max: t.float({ required: false }),
  }),
})

export const OptionsNumericalInputRef =
  builder.inputRef<OptionsNumericalInputType>('OptionsNumericalInput')
export const OptionsNumericalInput = OptionsNumericalInputRef.implement({
  fields: (t) => ({
    hasSampleSolution: t.boolean({ required: false }),
    hasAnswerFeedbacks: t.boolean({ required: false }),
    accuracy: t.int({ required: false }),
    unit: t.string({ required: false }),
    restrictions: t.field({
      type: NumericalRestrictionsInput,
      required: false,
    }),
    solutionRanges: t.field({
      type: [SolutionRangeInput],
      required: false,
    }),
    exactSolutions: t.floatList({ required: false }),
    feedback: t.string({ required: false }),
  }),
})

export const CodeTestCaseInputRef =
  builder.inputRef<CodeTestCaseInputType>('CodeTestCaseInput')
export const CodeTestCaseInput = CodeTestCaseInputRef.implement({
  fields: (t) => ({
    id: t.string({ required: true }),
    name: t.string({ required: true }),
    args: t.field({
      type: ['Json'],
      required: { list: true, items: false },
    }),
    expectedOutput: t.field({ type: 'Json', required: false }),
    visibility: t.field({ type: CodeTestVisibility, required: true }),
    weight: t.float({ required: true }),
  }),
})

export const OptionsCodeInputRef =
  builder.inputRef<OptionsCodeInputType>('OptionsCodeInput')
export const OptionsCodeInput = OptionsCodeInputRef.implement({
  fields: (t) => ({
    language: t.field({ type: CodeLanguage, required: true }),
    starterCode: t.string({ required: false }),
    sampleSolution: t.string({ required: false }),
    entrypoint: t.string({ required: true }),
    testCases: t.field({ type: [CodeTestCaseInput], required: true }),
    hasSampleSolution: t.boolean({ required: true }),
  }),
})

export const FreeTextRestrictionsInputRef =
  builder.inputRef<FreeTextRestrictionsInputType>('FreeTextRestrictionsInput')
export const FreeTextRestrictionsInput = FreeTextRestrictionsInputRef.implement(
  {
    fields: (t) => ({
      maxLength: t.int({ required: false }),
      minLength: t.int({ required: false }),
      pattern: t.string({ required: false }),
    }),
  }
)

export const OptionsFreeTextInputRef =
  builder.inputRef<OptionsFreeTextInputType>('OptionsFreeTextInput')
export const OptionsFreeTextInput = OptionsFreeTextInputRef.implement({
  fields: (t) => ({
    hasSampleSolution: t.boolean({ required: false }),
    hasAnswerFeedbacks: t.boolean({ required: false }),
    placeholder: t.string({ required: false }),
    restrictions: t.field({
      type: FreeTextRestrictionsInput,
      required: false,
    }),
    solutions: t.stringList({ required: false }),
    feedback: t.string({ required: false }),
  }),
})

export const ResponseInputRef =
  builder.inputRef<ResponseInputType>('ResponseInput')
export const ResponseInput = ResponseInputRef.implement({
  fields: (t) => ({
    choices: t.field({
      type: [ChoicesResponse],
      required: false,
    }),
    value: t.string({ required: false }),
    selection: t.intList({ required: false }),
    assessment: t.field({
      type: [CaseStudyCaseResponse],
      required: false,
    }),
  }),
})

export const OptionsSelectionInputRef =
  builder.inputRef<OptionsSelectionInputType>('OptionsSelectionInput')
export const OptionsSelectionInput = OptionsSelectionInputRef.implement({
  fields: (t) => ({
    hasSampleSolution: t.boolean({ required: false }),
    answerCollection: t.int({ required: false }),
    numberOfInputs: t.int({ required: false }),
    correctAnswers: t.intList({ required: false }),
  }),
})

export const CaseStudyCriterionLabelsInputRef =
  builder.inputRef<CaseStudyCriterionLabelsInputType>(
    'CaseStudyCriterionLabelsInput'
  )
export const CaseStudyCriterionLabelsInput =
  CaseStudyCriterionLabelsInputRef.implement({
    fields: (t) => ({
      min: t.string({ required: true }),
      mid: t.string({ required: false }),
      max: t.string({ required: true }),
    }),
  })

export const CaseStudyCriterionInputRef =
  builder.inputRef<CaseStudyCriterionInputType>('CaseStudyCriterionInput')
export const CaseStudyCriterionInput = CaseStudyCriterionInputRef.implement({
  fields: (t) => ({
    id: t.string({ required: true }),
    name: t.string({ required: true }),
    order: t.int({ required: true }),
    min: t.float({ required: true }),
    max: t.float({ required: true }),
    step: t.float({ required: true }),
    unit: t.string({ required: false }),
    labels: t.field({
      type: CaseStudyCriterionLabelsInput,
      required: false,
    }),
  }),
})

export const CaseStudyCriteriaSolutionInputRef =
  builder.inputRef<CaseStudyCriteriaSolutionInputType>(
    'CaseStudyCriteriaSolutionInput'
  )
export const CaseStudyCriteriaSolutionInput =
  CaseStudyCriteriaSolutionInputRef.implement({
    fields: (t) => ({
      criterionId: t.string({ required: true }),
      min: t.float({ required: true }),
      max: t.float({ required: true }),
    }),
  })

export const CaseStudySolutionInputRef =
  builder.inputRef<CaseStudySolutionInputType>('CaseStudySolutionInput')
export const CaseStudySolutionInput = CaseStudySolutionInputRef.implement({
  fields: (t) => ({
    itemId: t.int({ required: true }),
    criteriaSolutions: t.field({
      type: [CaseStudyCriteriaSolutionInput],
      required: true,
    }),
  }),
})

export const CaseStudyCaseInputRef =
  builder.inputRef<CaseStudyCaseInputType>('CaseStudyCaseInput')
export const CaseStudyCaseInput = CaseStudyCaseInputRef.implement({
  fields: (t) => ({
    id: t.string({ required: true }),
    title: t.string({ required: true }),
    description: t.string({ required: true }),
    order: t.int({ required: true }),
    solutions: t.field({ type: [CaseStudySolutionInput], required: false }),
  }),
})

export const OptionsCaseStudyInputRef =
  builder.inputRef<OptionsCaseStudyInputType>('OptionsCaseStudyInput')
export const OptionsCaseStudyInput = OptionsCaseStudyInputRef.implement({
  fields: (t) => ({
    hasSampleSolution: t.boolean({ required: false }),
    answerCollection: t.int({ required: false }),
    collectionItemIds: t.intList({ required: false }),
    criteria: t.field({ type: [CaseStudyCriterionInput], required: false }),
    cases: t.field({ type: [CaseStudyCaseInput], required: false }),
  }),
})

export const TemplateElementManipulationInputRef =
  builder.inputRef<ElementManipulationInputType>(
    'TemplateElementManipulationInput'
  )
export const TemplateElementManipulationInput =
  TemplateElementManipulationInputRef.implement({
    fields: (t) => ({
      id: t.int({ required: false }),
      status: t.field({ type: ElementStatus, required: false }),
      type: t.field({ type: ElementType, required: true }),
      name: t.string({ required: false }),
      content: t.string({ required: false }),
      explanation: t.string({ required: false }),
      choicesOptions: t.field({ type: OptionsChoicesInput, required: false }),
      numericalOptions: t.field({
        type: OptionsNumericalInput,
        required: false,
      }),
      freeTextOptions: t.field({ type: OptionsFreeTextInput, required: false }),
      selectionOptions: t.field({
        type: OptionsSelectionInput,
        required: false,
      }),
      caseStudyOptions: t.field({
        type: OptionsCaseStudyInput,
        required: false,
      }),
      basePoints: t.boolean({ required: false }),
      pointsMultiplier: t.int({ required: false }),
      tags: t.stringList({ required: false }),
    }),
  })

export const TemplateBlockElementInputRef =
  builder.inputRef<TemplateBlockElementInputType>('TemplateBlockElementInput')
export const TemplateBlockElementInput = TemplateBlockElementInputRef.implement(
  {
    fields: (t) => ({
      order: t.int({ required: true }),
      useExistingElement: t.boolean({ required: true }),
      existingElementId: t.int({ required: false }),
      useNewElement: t.boolean({ required: true }),
      newElement: t.field({
        type: TemplateElementManipulationInput,
        required: false,
      }),
    }),
  }
)

export const TemplateBlockInputRef =
  builder.inputRef<TemplateBlockInputType>('TemplateBlockInput')
export const TemplateBlockInput = TemplateBlockInputRef.implement({
  fields: (t) => ({
    timeLimit: t.int({ required: false }),
    order: t.int({ required: true }),
    elements: t.field({ type: [TemplateBlockElementInput], required: true }),
  }),
})

interface IElementInstanceVersionInfo {
  id: number
  newTitle: string
  newSampleSolution: boolean
}
export const ElementInstanceVersionInfoRef =
  builder.objectRef<IElementInstanceVersionInfo>('ElementInstanceVersionInfo')
export const ElementInstanceVersionInfo =
  ElementInstanceVersionInfoRef.implement({
    fields: (t) => ({
      id: t.exposeInt('id'),
      newTitle: t.exposeString('newTitle'),
      newSampleSolution: t.exposeBoolean('newSampleSolution'),
    }),
  })

// #endregion

// ----- SINGLE QUESTION RESPONSE INTERFACES -----
// #region
export const ChoicesResponseObject = builder
  .objectRef<ChoicesResponseType>('ChoicesResponseObject')
  .implement({
    fields: (t) => ({
      ix: t.exposeInt('ix'),
      selected: t.exposeBoolean('selected'),
    }),
  })
export const SingleQuestionResponseChoices = builder
  .objectRef<SingleQuestionResponseChoicesType>('SingleQuestionResponseChoices')
  .implement({
    fields: (t) => ({
      choices: t.expose('choices', {
        type: [ChoicesResponseObject],
      }),
    }),
  })

export const SingleQuestionResponseValue = builder
  .objectRef<SingleQuestionResponseValueType>('SingleQuestionResponseValue')
  .implement({
    fields: (t) => ({
      value: t.exposeString('value'),
    }),
  })

export const SingleQuestionResponseSelection = builder
  .objectRef<SingleQuestionResponseSelectionType>(
    'SingleQuestionResponseSelection'
  )
  .implement({
    fields: (t) => ({
      selection: t.exposeIntList('selection'),
    }),
  })

export const SingleQuestionResponseFlashcard = builder
  .objectRef<SingleQuestionResponseFlashcardType>(
    'SingleQuestionResponseFlashcard'
  )
  .implement({
    fields: (t) => ({
      correctness: t.expose('correctness', { type: FlashcardCorrectness }),
    }),
  })

export const SingleQuestionResponseContent = builder
  .objectRef<SingleQuestionResponseContentType>('SingleQuestionResponseContent')
  .implement({
    fields: (t) => ({
      viewed: t.exposeBoolean('viewed'),
    }),
  })

export const SingleQuestionResponseCode = builder
  .objectRef<SingleQuestionResponseCodeType>('SingleQuestionResponseCode')
  .implement({
    fields: (t) => ({
      code: t.exposeString('code'),
    }),
  })

// #endregion

// ----- INSTANCE EVALUATION INTERFACE -----
// #region
export const QuestionFeedback = builder
  .objectRef<IQuestionFeedback>('QuestionFeedback')
  .implement({
    fields: (t) => ({
      ix: t.exposeInt('ix'),
      feedback: t.exposeString('feedback', { nullable: true }),
      correct: t.exposeBoolean('correct', { nullable: true }),
      value: t.exposeString('value'),
    }),
  })

function sharedEvaluationProps(t) {
  return {
    instanceId: t.exposeInt('instanceId'),
    elementType: t.expose('elementType', { type: ElementType }),

    score: t.exposeFloat('score'),
    xp: t.exposeInt('xp', { nullable: true }),
    pointsMultiplier: t.exposeInt('pointsMultiplier'),
    explanation: t.exposeString('explanation', { nullable: true }),
    feedbacks: t.expose('feedbacks', {
      type: [QuestionFeedback],
      nullable: true,
    }),

    numAnswers: t.exposeInt('numAnswers', { nullable: true }),
    pointsAwarded: t.exposeFloat('pointsAwarded', { nullable: true }),
    percentile: t.exposeFloat('percentile', { nullable: true }),
    newPointsFrom: t.expose('newPointsFrom', {
      type: 'Date',
      nullable: true,
    }),
    xpAwarded: t.exposeInt('xpAwarded', { nullable: true }),
    newXpFrom: t.expose('newXpFrom', {
      type: 'Date',
      nullable: true,
    }),
    correctness: t.exposeFloat('correctness', { nullable: true }),
  }
}

export const SingleChoiceResponse = builder
  .objectRef<SingleChoiceResponseType>('SingleChoiceResponse')
  .implement({
    fields: (t) => ({
      ix: t.exposeInt('ix'),
      count: t.exposeInt('count'),
    }),
  })

export const ChoicesInstanceEvaluation = builder
  .objectRef<IInstanceEvaluationChoices>('ChoicesInstanceEvaluation')
  .implement({
    fields: (t) => ({
      ...sharedEvaluationProps(t),
      choices: t.expose('choices', {
        type: [SingleChoiceResponse],
        nullable: true,
      }),
      lastResponse: t.expose('lastResponse', {
        type: SingleQuestionResponseChoices,
        nullable: true,
      }),
    }),
  })

export const SingleNumericalRepsonse = builder
  .objectRef<SingleNumericalRepsonseType>('SingleNumericalResponse')
  .implement({
    fields: (t) => ({
      value: t.exposeFloat('value'),
      count: t.exposeInt('count'),
    }),
  })

export const NumericalInstanceEvaluation = builder
  .objectRef<IInstanceEvaluationNumerical>('NumericalInstanceEvaluation')
  .implement({
    fields: (t) => ({
      ...sharedEvaluationProps(t),
      responses: t.expose('responses', {
        type: [SingleNumericalRepsonse],
        nullable: true,
      }),
      solutionRanges: t.expose('solutionRanges', {
        type: [NumericalSolutionRange],
        nullable: true,
      }),
      exactSolutions: t.exposeFloatList('exactSolutions', { nullable: true }),
      lastResponse: t.expose('lastResponse', {
        type: SingleQuestionResponseValue,
        nullable: true,
      }),
    }),
  })

export const SingleFreeTextResponse = builder
  .objectRef<SingleFreeTextResponseType>('SingleFreeTextResponse')
  .implement({
    fields: (t) => ({
      value: t.exposeString('value'),
      count: t.exposeInt('count'),
    }),
  })

export const FreeTextInstanceEvaluation = builder
  .objectRef<IInstanceEvaluationFreeText>('FreeTextInstanceEvaluation')
  .implement({
    fields: (t) => ({
      ...sharedEvaluationProps(t),
      answers: t.expose('answers', {
        type: [SingleFreeTextResponse],
        nullable: true,
      }),
      solutions: t.exposeStringList('solutions', { nullable: true }),
      lastResponse: t.expose('lastResponse', {
        type: SingleQuestionResponseValue,
        nullable: true,
      }),
    }),
  })

export const SingleSelectionResponse = builder
  .objectRef<SingleSelectionResponseType>('SingleSelectionResponse')
  .implement({
    fields: (t) => ({
      answerId: t.exposeInt('answerId'),
      value: t.exposeString('value'),
      count: t.exposeInt('count'),
    }),
  })

export const SelectionInstanceEvaluation = builder
  .objectRef<IInstanceEvaluationSelection>('SelectionInstanceEvaluation')
  .implement({
    fields: (t) => ({
      ...sharedEvaluationProps(t),
      selectionResponses: t.expose('selectionResponses', {
        type: [SingleSelectionResponse],
        nullable: true,
      }),
      answerSolutionIds: t.exposeIntList('answerSolutionIds', {
        nullable: true,
      }),
      lastResponse: t.expose('lastResponse', {
        type: SingleQuestionResponseSelection,
        nullable: true,
      }),
    }),
  })

export const SingleQuestionResponseCaseStudyCriterion = builder
  .objectRef<
    SingleQuestionResponseCaseStudyType['assessment'][0]['itemResponses'][0]['criterionResponses'][0]
  >('SingleQuestionResponseCaseStudyCriterion')
  .implement({
    fields: (t) => ({
      criterionId: t.exposeString('criterionId'),
      response: t.exposeFloat('response'),
      correct: t.exposeBoolean('correct', { nullable: true }),
    }),
  })

export const SingleQuestionResponseCaseStudyItem = builder
  .objectRef<
    SingleQuestionResponseCaseStudyType['assessment'][0]['itemResponses'][0]
  >('SingleQuestionResponseCaseStudyItem')
  .implement({
    fields: (t) => ({
      itemId: t.exposeInt('itemId'),
      criterionResponses: t.expose('criterionResponses', {
        type: [SingleQuestionResponseCaseStudyCriterion],
      }),
    }),
  })

export const SingleQuestionResponseCaseStudyCase = builder
  .objectRef<
    SingleQuestionResponseCaseStudyType['assessment'][0]
  >('SingleQuestionResponseCaseStudyCase')
  .implement({
    fields: (t) => ({
      caseId: t.exposeString('caseId'),
      itemResponses: t.expose('itemResponses', {
        type: [SingleQuestionResponseCaseStudyItem],
      }),
    }),
  })

export const SingleQuestionResponseCaseStudy = builder
  .objectRef<SingleQuestionResponseCaseStudyType>(
    'SingleQuestionResponseCaseStudy'
  )
  .implement({
    fields: (t) => ({
      assessment: t.expose('assessment', {
        type: [SingleQuestionResponseCaseStudyCase],
      }),
    }),
  })

export const SingleCaseStudyResponse = builder
  .objectRef<SingleCaseStudyResponseType>('SingleCaseStudyResponse')
  .implement({
    fields: (t) => ({
      caseId: t.exposeString('caseId'),
      itemId: t.exposeInt('itemId'),
      criterionId: t.exposeString('criterionId'),
      responseValues: t.exposeFloatList('responseValues'),
    }),
  })

export const CaseStudySolution = builder
  .objectRef<CaseStudySolutionType>('CaseStudySolution')
  .implement({
    fields: (t) => ({
      caseId: t.exposeString('caseId'),
      solutions: t.expose('solutions', {
        type: [CaseStudyCaseSolution],
        nullable: true,
      }),
    }),
  })

export const CaseStudyInstanceEvaluation = builder
  .objectRef<IInstanceEvaluationCaseStudy>('CaseStudyInstanceEvaluation')
  .implement({
    fields: (t) => ({
      ...sharedEvaluationProps(t),
      assessments: t.expose('assessments', {
        type: [SingleCaseStudyResponse],
        nullable: true,
      }),
      studySolutions: t.expose('studySolutions', {
        type: [CaseStudySolution],
        nullable: true,
      }),
      lastResponse: t.expose('lastResponse', {
        type: SingleQuestionResponseCaseStudy,
        nullable: true,
      }),
    }),
  })

export const FlashcardInstanceEvaluation = builder
  .objectRef<IInstanceEvaluationFlashcard>('FlashcardInstanceEvaluation')
  .implement({
    fields: (t) => ({
      ...sharedEvaluationProps(t),
      lastResponse: t.expose('lastResponse', {
        type: SingleQuestionResponseFlashcard,
        nullable: true,
      }),
    }),
  })

export const ContentInstanceEvaluation = builder
  .objectRef<IInstanceEvaluationContent>('ContentInstanceEvaluation')
  .implement({
    fields: (t) => ({
      ...sharedEvaluationProps(t),
      lastResponse: t.expose('lastResponse', {
        type: SingleQuestionResponseContent,
        nullable: true,
      }),
    }),
  })

export const CodeInstanceEvaluation = builder
  .objectRef<IInstanceEvaluationCode>('CodeInstanceEvaluation')
  .implement({
    fields: (t) => ({
      ...sharedEvaluationProps(t),
      testResults: t.expose('testResults', {
        type: [CodeTestEvaluation],
        nullable: true,
      }),
      lastResponse: t.expose('lastResponse', {
        type: SingleQuestionResponseCode,
        nullable: true,
      }),
    }),
  })

export const InstanceEvaluation = builder.unionType('InstanceEvaluation', {
  types: [
    ChoicesInstanceEvaluation,
    NumericalInstanceEvaluation,
    FreeTextInstanceEvaluation,
    SelectionInstanceEvaluation,
    CaseStudyInstanceEvaluation,
    FlashcardInstanceEvaluation,
    ContentInstanceEvaluation,
    CodeInstanceEvaluation,
  ],
  resolveType: (element) => {
    switch (element.elementType) {
      case DB.ElementType.SC:
      case DB.ElementType.MC:
      case DB.ElementType.KPRIM:
        return ChoicesInstanceEvaluation
      case DB.ElementType.NUMERICAL:
        return NumericalInstanceEvaluation
      case DB.ElementType.FREE_TEXT:
        return FreeTextInstanceEvaluation
      case DB.ElementType.SELECTION:
        return SelectionInstanceEvaluation
      case DB.ElementType.CASE_STUDY:
        return CaseStudyInstanceEvaluation
      case DB.ElementType.FLASHCARD:
        return FlashcardInstanceEvaluation
      case DB.ElementType.CONTENT:
        return ContentInstanceEvaluation
      case DB.ElementType.CODE:
        return CodeInstanceEvaluation
    }
  },
})
// #endregion

// ----- ELEMENT INTERFACE -----
// #region
interface IBaseElementProps extends Omit<DB.Element, 'ownerId'> {
  tags?: ITag[] | null
  permissionLevel?: DB.PermissionLevel
  derivedAccess?: boolean // = derived from other object => removal disabled
  numSharedUsers?: number
  isOwner?: boolean // = OWNER
  isManager?: boolean // = OWNER / ADMIN
  isEditor?: boolean // = OWNER / ADMIN / WRITE
  isImported?: boolean // imported flag for UI icon
  isShared?: boolean // flag to signal whether the object is owned or shared
  isRemovable?: boolean // = derived from other object / direct user group permission => removal disabled
}

const sharedElementProps = (t: any) => ({
  id: t.exposeInt('id'),

  version: t.exposeInt('version'),
  name: t.exposeString('name'),
  status: t.expose('status', { type: ElementStatus }),
  type: t.expose('type', { type: ElementType }),
  content: t.exposeString('content'),
  explanation: t.exposeString('explanation', { nullable: true }),
  basePoints: t.exposeBoolean('basePoints'),
  pointsMultiplier: t.exposeInt('pointsMultiplier'),

  isArchived: t.exposeBoolean('isArchived', { nullable: true }),
  isDeleted: t.exposeBoolean('isDeleted', { nullable: true }),

  createdAt: t.expose('createdAt', { type: 'Date', nullable: true }),
  updatedAt: t.expose('updatedAt', { type: 'Date', nullable: true }),

  permissionLevel: t.expose('permissionLevel', {
    type: PermissionLevel,
    nullable: true,
  }),
  derivedAccess: t.exposeBoolean('derivedAccess', { nullable: true }),
  numSharedUsers: t.exposeInt('numSharedUsers', { nullable: true }),
  isOwner: t.exposeBoolean('isOwner', { nullable: true }),
  isManager: t.exposeBoolean('isManager', { nullable: true }),
  isEditor: t.exposeBoolean('isEditor', { nullable: true }),
  isImported: t.exposeBoolean('isImported', { nullable: true }),
  isShared: t.exposeBoolean('isShared', { nullable: true }),
  isRemovable: t.exposeBoolean('isRemovable', { nullable: true }),
  sharingType: t.expose('sharingType', { type: SharingType, nullable: true }),

  tags: t.expose('tags', {
    type: [TagRef],
    nullable: true,
  }),
})

export interface IChoicesElement extends IBaseElementProps {
  options: ElementOptionsChoicesType
}
export const ChoicesElement = builder
  .objectRef<IChoicesElement>('ChoicesElement')
  .implement({
    fields: (t) => ({
      ...sharedElementProps(t),
      options: t.expose('options', { type: ChoiceElementOptions }),
    }),
  })

export interface INumericalElement extends IBaseElementProps {
  options: ElementOptionsNumericalType
}
export const NumericalElement = builder
  .objectRef<INumericalElement>('NumericalElement')
  .implement({
    fields: (t) => ({
      ...sharedElementProps(t),
      options: t.expose('options', { type: NumericalElementOptions }),
    }),
  })

export interface IFreeTextElement extends IBaseElementProps {
  options: ElementOptionsFreeTextType
}
export const FreeTextElement = builder
  .objectRef<IFreeTextElement>('FreeTextElement')
  .implement({
    fields: (t) => ({
      ...sharedElementProps(t),
      options: t.expose('options', { type: FreeTextElementOptions }),
    }),
  })

export interface ISelectionElement extends IBaseElementProps {
  options: ElementOptionsSelectionType
}
export const SelectionElement = builder
  .objectRef<ISelectionElement>('SelectionElement')
  .implement({
    fields: (t) => ({
      ...sharedElementProps(t),
      options: t.expose('options', { type: SelectionElementOptions }),
    }),
  })

export interface ICaseStudyElement extends IBaseElementProps {
  options: ElementOptionsCaseStudyType
}
export const CaseStudyElement = builder
  .objectRef<ICaseStudyElement>('CaseStudyElement')
  .implement({
    fields: (t) => ({
      ...sharedElementProps(t),
      options: t.expose('options', { type: CaseStudyElementOptions }),
    }),
  })

export interface ICodeElement extends IBaseElementProps {
  options: ElementOptionsCodeType
}
export const CodeElement = builder
  .objectRef<ICodeElement>('CodeElement')
  .implement({
    fields: (t) => ({
      ...sharedElementProps(t),
      options: t.expose('options', { type: CodeElementOptions }),
    }),
  })

export interface IFlashcardElement extends IBaseElementProps {}
export const FlashcardElement = builder
  .objectRef<IFlashcardElement>('FlashcardElement')
  .implement({
    fields: (t) => ({
      ...sharedElementProps(t),
    }),
  })

export interface IContentElement extends IBaseElementProps {}
export const ContentElement = builder
  .objectRef<IContentElement>('ContentElement')
  .implement({
    fields: (t) => ({
      ...sharedElementProps(t),
    }),
  })

export const Element = builder.unionType('Element', {
  types: [
    ChoicesElement,
    NumericalElement,
    FreeTextElement,
    FlashcardElement,
    ContentElement,
    SelectionElement,
    CaseStudyElement,
    CodeElement,
  ],
  resolveType: (element) => {
    switch (element.type) {
      case DB.ElementType.SC:
      case DB.ElementType.MC:
      case DB.ElementType.KPRIM:
        return ChoicesElement
      case DB.ElementType.NUMERICAL:
        return NumericalElement
      case DB.ElementType.FREE_TEXT:
        return FreeTextElement
      case DB.ElementType.FLASHCARD:
        return FlashcardElement
      case DB.ElementType.CONTENT:
        return ContentElement
      case DB.ElementType.SELECTION:
        return SelectionElement
      case DB.ElementType.CASE_STUDY:
        return CaseStudyElement
      case DB.ElementType.CODE:
        return CodeElement
    }
  },
})

export interface IUserElementList {
  numOfElements: number
  elements: (
    | IChoicesElement
    | INumericalElement
    | IFreeTextElement
    | IFlashcardElement
    | IContentElement
    | ISelectionElement
    | ICaseStudyElement
    | ICodeElement
  )[]
}

export const UserElementListRef =
  builder.objectRef<IUserElementList>('UserElementList')
export const UserElementList = builder.objectType(UserElementListRef, {
  name: 'UserElementList',
  fields: (t) => ({
    numOfElements: t.exposeInt('numOfElements'),
    elements: t.expose('elements', { type: [Element] }),
  }),
})

interface IElementSummary {
  sharedElementActivityUse: boolean // = true if the element is used in an activity by a user with shared access
  retainsDerivedAccess: boolean // = true if the element is used in activity with admin / owner access -> retain derived access
  derivedAccessToResources: boolean // = true if the element leads to derived access to resources
}
export const ElementSummaryRef =
  builder.objectRef<IElementSummary>('ElementSummary')
export const ElementSummary = ElementSummaryRef.implement({
  fields: (t) => ({
    sharedElementActivityUse: t.exposeBoolean('sharedElementActivityUse'),
    retainsDerivedAccess: t.exposeBoolean('retainsDerivedAccess'),
    derivedAccessToResources: t.exposeBoolean('derivedAccessToResources'),
  }),
})
// #endregion

export interface IElementInstance
  extends Omit<DB.ElementInstance, 'isVersionOutdated'> {
  feedbacks?: DB.ElementFeedback[] | null
  correlationKey?: string | null
}
export const ElementInstanceRef =
  builder.objectRef<IElementInstance>('ElementInstance')
export const ElementInstance = ElementInstanceRef.implement({
  fields: (t) => ({
    id: t.exposeInt('id'),

    type: t.expose('type', { type: ElementInstanceType }),
    elementType: t.expose('elementType', { type: ElementType }),
    correlationKey: t.exposeString('correlationKey', { nullable: true }), // correlation key for assessment response validation

    elementData: t.field({
      type: ElementData,
      resolve: (q) => q.elementData,
    }),

    codeAuthoringData: t
      .withAuth({ authenticated: true, role: DB.UserRole.USER })
      .field({
        nullable: true,
        type: AuthoringCodeElementData,
        resolve: (instance) =>
          instance.elementData.type === DB.ElementType.CODE
            ? instance.elementData
            : null,
      }),

    options: t.expose('options', {
      type: ElementInstanceOptions,
      nullable: true,
    }),

    feedbacks: t.expose('feedbacks', {
      type: [ElementFeedbackRef],
      nullable: true,
    }),
  }),
})

export interface IInstanceUpdateActivityInfo {
  activityName: string
  activityType: ActivityTypeEnum
  status: DB.PublicationStatus
}
export const InstanceUpdateActivityInfoRef =
  builder.objectRef<IInstanceUpdateActivityInfo>('InstanceUpdateActivityInfo')
export const InstanceUpdateActivityInfo =
  InstanceUpdateActivityInfoRef.implement({
    fields: (t) => ({
      activityName: t.exposeString('activityName'),
      activityType: t.expose('activityType', { type: ActivityType }),
      status: t.expose('status', { type: PublicationStatus }),
    }),
  })

export interface ITag
  extends Omit<DB.Tag, 'ownerId' | 'createdAt' | 'updatedAt'> {}
export const TagRef = builder.objectRef<ITag>('Tag')
export const Tag = TagRef.implement({
  fields: (t) => ({
    id: t.exposeInt('id'),
    name: t.exposeString('name'),
    order: t.exposeInt('order'),
  }),
})
