import * as DB from '@klicker-uzh/prisma/client'
import {
  CaseStudyCriterionLabelsInput,
  FlashcardCorrectness as FlashcardCorrectnessType,
  InstanceEvaluation as IInstanceEvaluation,
  StackFeedbackStatus as StackFeedbackStatusType,
} from '@klicker-uzh/types'
import builder from '../builder.js'
import { CaseStudyCriterionLabels, ElementType } from './elementData.js'
import {
  ConfusionTimestepRef,
  ElementBlockStatus,
  FeedbackRef,
  IFeedback,
  LiveQuizResponseCollectionMode,
} from './liveQuiz.js'
import { PublicationStatus } from './practiceQuiz.js'
import { LocaleType } from './user.js'

export interface IActivityEvaluation {
  id: string
  name: string
  displayName?: string | null
  description?: string | null
  courseId?: string | null
  courseLanguage?: DB.Locale | null
  status?: DB.PublicationStatus | null
  responseCollectionMode?: DB.LiveQuizResponseCollectionMode | null
  isAssessmentEnabled?: boolean | null
  pinCode?: string | null
  results: IStackEvaluation[]
  feedbacks?: IFeedback[] | null
  confusionFeedbacks?: DB.ConfusionTimestep[] | null
}

export interface IStackFeedback {
  id: number
  status: StackFeedbackStatusType
  score?: number
  evaluations?: IInstanceEvaluation[]
}

export interface IStackEvaluation {
  stackId: number
  stackName?: string | null
  stackDescription?: string | null
  stackOrder: number
  stackActive: boolean
  instances: IElementInstanceEvaluation[]
  status?: DB.ElementBlockStatus | null
  expiresAt?: Date | null
  timeLimit?: number | null
}

export interface IElementInstanceEvaluation {
  id: number
  type: DB.ElementType
  name: string
  content: string
  explanation?: string | null
  hasSampleSolution: boolean
  hasAnswerFeedbacks: boolean
  results: InstanceEvaluationResults
}

export type InstanceEvaluationResults =
  | IChoicesElementEvaluationResults
  | INumericalElementEvaluationResults
  | IFreeElementEvaluationResults
  | ISelectionElementEvaluationResults
  | IFlashcardElementEvaluationResults
  | IContentElementEvaluationResults

export interface IChoicesElementEvaluationResults {
  totalAnswers: number
  anonymousAnswers: number
  choices: {
    value: string
    count: number
    correct?: boolean | null
    feedback?: string | null
  }[]
}

export interface IChoicesActivityEvaluationData
  extends IElementInstanceEvaluation {
  results: IChoicesElementEvaluationResults
}

interface INumericalElementSolutionRange {
  min?: number | null
  max?: number | null
}

export interface INumericalElementEvaluationResults {
  totalAnswers: number
  anonymousAnswers: number
  maxValue?: number | null
  minValue?: number | null
  solutionRanges?: INumericalElementSolutionRange[] | null
  exactSolutions?: number[] | null
  responseValues: {
    value: number
    count: number
    correct?: boolean | null
  }[]
}

export interface IStatistics {
  max: number
  min: number
  mean: number
  median: number
  q1: number
  q3: number
  sd: number
}

export interface INumericalActivityEvaluationData
  extends IElementInstanceEvaluation {
  results: INumericalElementEvaluationResults
  statistics?: IStatistics
}

export interface IFreeElementEvaluationResults {
  totalAnswers: number
  anonymousAnswers: number
  maxLength?: number | null
  solutions?: string[] | null
  responses: {
    value: string
    count: number
    correct?: boolean | null
  }[]
}

export interface IFreeTextActivityEvaluationData
  extends IElementInstanceEvaluation {
  results: IFreeElementEvaluationResults
}

export interface ISelectionElementEvaluationResults {
  totalAnswers: number
  anonymousAnswers: number
  numberOfInputs?: number | null
  answerSolutionIds?: number[] | null
  selectionResponses: {
    answerId: number
    value: string
    count: number
  }[]
}

export interface ISelectionActivityEvaluationData
  extends IElementInstanceEvaluation {
  results: ISelectionElementEvaluationResults
}

export interface ICaseStudyElementEvaluationResults {
  totalAnswers: number
  anonymousAnswers: number
  caseResults: {
    caseId: string
    items: {
      itemId: number
      criteria: {
        // general criterion information (always provided)
        criterionId: string
        name: string
        min: number
        max: number
        step: number
        unit?: string | null
        // TODO: add labels here for evaluation view

        // sample solutions (not required)
        solutionMin?: number | null
        solutionMax?: number | null

        // student responses and statistics computed based on it
        statistics?: IStatistics
        responses: {
          value: number
          count: number
        }[]
      }[]
    }[]
  }[]
}

export interface ICaseStudyActivityEvaluationData
  extends IElementInstanceEvaluation {
  cases: {
    id: string
    name: string
    description: string
  }[]
  items: {
    id: number
    name: string
  }[]
  criteria: {
    id: string
    name: string
    labels: CaseStudyCriterionLabelsInput
  }[]
  results: ICaseStudyElementEvaluationResults
}

export interface IFlashcardElementEvaluationResults {
  totalAnswers: number
  anonymousAnswers: number
  correctCount: number
  partialCount: number
  incorrectCount: number
}

export interface IFlashcardActivityEvaluationData
  extends IElementInstanceEvaluation {
  results: IFlashcardElementEvaluationResults
}

export interface IContentElementEvaluationResults {
  totalAnswers: number
  anonymousAnswers: number
}

export interface IContentActivityEvaluationData
  extends IElementInstanceEvaluation {
  results: IContentElementEvaluationResults
}

export const FlashcardCorrectness = builder.enumType('FlashcardCorrectness', {
  values: Object.values(FlashcardCorrectnessType),
})

export const ResponseCorrectness = builder.enumType('ResponseCorrectness', {
  values: Object.values(DB.ResponseCorrectness),
})

// ----- ACTIVITY EVALUATION INTERFACE -----
// #region
export const ActivityEvaluationRef =
  builder.objectRef<IActivityEvaluation>('ActivityEvaluation')
export const ActivityEvaluation = ActivityEvaluationRef.implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
    displayName: t.exposeString('displayName', { nullable: true }),
    description: t.exposeString('description', { nullable: true }),
    courseId: t.exposeString('courseId', { nullable: true }),
    courseLanguage: t.expose('courseLanguage', {
      type: LocaleType,
      nullable: true,
    }),
    status: t.expose('status', { type: PublicationStatus, nullable: true }),
    responseCollectionMode: t.expose('responseCollectionMode', {
      type: LiveQuizResponseCollectionMode,
      nullable: true,
    }),
    isAssessmentEnabled: t.exposeBoolean('isAssessmentEnabled', {
      nullable: true,
    }),
    pinCode: t.exposeString('pinCode', { nullable: true }),
    results: t.expose('results', {
      type: [StackEvaluation],
    }),
    feedbacks: t.expose('feedbacks', {
      type: [FeedbackRef],
      nullable: true,
    }),
    confusionFeedbacks: t.expose('confusionFeedbacks', {
      type: [ConfusionTimestepRef],
      nullable: true,
    }),
  }),
})
// #endregion

// ----- STACK EVALUATION INTERFACE -----
// #region
export const StackEvaluationRef =
  builder.objectRef<IStackEvaluation>('StackEvaluation')
export const StackEvaluation = StackEvaluationRef.implement({
  fields: (t) => ({
    stackId: t.exposeInt('stackId'),
    stackName: t.exposeString('stackName', { nullable: true }),
    stackDescription: t.exposeString('stackDescription', { nullable: true }),
    stackOrder: t.exposeInt('stackOrder'),
    stackActive: t.exposeBoolean('stackActive'),
    status: t.expose('status', {
      type: ElementBlockStatus,
      nullable: true,
    }),
    expiresAt: t.expose('expiresAt', {
      type: 'Date',
      nullable: true,
    }),
    timeLimit: t.exposeInt('timeLimit', { nullable: true }),
    instances: t.field({
      type: [ElementInstanceEvaluation],
      resolve: (s) => s.instances,
    }),
  }),
})

export const Statistics = builder
  .objectRef<IStatistics>('Statistics')
  .implement({
    fields: (t) => ({
      max: t.exposeFloat('max'),
      min: t.exposeFloat('min'),
      mean: t.exposeFloat('mean'),
      median: t.exposeFloat('median'),
      q1: t.exposeFloat('q1'),
      q3: t.exposeFloat('q3'),
      sd: t.exposeFloat('sd'),
    }),
  })
// #endregion

// ----- CHOICES ELEMENT EVALUATION INTERFACE -----
// #region
const sharedElementEvaluation = (t) => ({
  id: t.exposeInt('id'),
  type: t.expose('type', { type: ElementType }),
  name: t.exposeString('name'),
  content: t.exposeString('content'),
  explanation: t.exposeString('explanation', { nullable: true }),
  hasSampleSolution: t.exposeBoolean('hasSampleSolution'),
  hasAnswerFeedbacks: t.exposeBoolean('hasAnswerFeedbacks'),
})

export const ChoicesActivityEvaluationDataRef =
  builder.objectRef<IChoicesActivityEvaluationData>(
    'ChoicesActivityEvaluationData'
  )
export const ChoicesActivityEvaluationData =
  ChoicesActivityEvaluationDataRef.implement({
    fields: (t) => ({
      ...sharedElementEvaluation(t),
      results: t.expose('results', {
        type: ChoicesElementResults,
      }),
    }),
  })

export const ChoicesElementResultsRef =
  builder.objectRef<IChoicesElementEvaluationResults>('ChoicesElementResults')
export const ChoicesElementResults = ChoicesElementResultsRef.implement({
  fields: (t) => ({
    totalAnswers: t.exposeInt('totalAnswers'),
    anonymousAnswers: t.exposeInt('anonymousAnswers'),
    choices: t.expose('choices', {
      type: [ChoiceElementResults],
    }),
  }),
})

export const ChoiceElementResultsRef = builder.objectRef<
  IChoicesElementEvaluationResults['choices'][0]
>('ChoiceElementResults')
export const ChoiceElementResults = ChoiceElementResultsRef.implement({
  fields: (t) => ({
    value: t.exposeString('value'),
    count: t.exposeInt('count'),
    correct: t.exposeBoolean('correct', { nullable: true }),
    feedback: t.exposeString('feedback', { nullable: true }),
  }),
})
// #endregion

// ----- NUMERICAL ELEMENT EVALUATION INTERFACE -----
// #region
export const NumericalActivityEvaluationDataRef =
  builder.objectRef<INumericalActivityEvaluationData>(
    'NumericalActivityEvaluationData'
  )
export const NumericalActivityEvaluationData =
  NumericalActivityEvaluationDataRef.implement({
    fields: (t) => ({
      ...sharedElementEvaluation(t),
      statistics: t.expose('statistics', { type: Statistics, nullable: true }),
      results: t.expose('results', {
        type: NumericalElementResults,
      }),
    }),
  })

export const NumericalElementResultsRef =
  builder.objectRef<INumericalElementEvaluationResults>(
    'NumericalElementResults'
  )
export const NumericalElementResults = NumericalElementResultsRef.implement({
  fields: (t) => ({
    totalAnswers: t.exposeInt('totalAnswers'),
    anonymousAnswers: t.exposeInt('anonymousAnswers'),
    maxValue: t.exposeFloat('maxValue', { nullable: true }),
    minValue: t.exposeFloat('minValue', { nullable: true }),
    solutionRanges: t.expose('solutionRanges', {
      type: [NumericalElementSolutions],
      nullable: true,
    }),
    exactSolutions: t.exposeFloatList('exactSolutions', { nullable: true }),
    responseValues: t.expose('responseValues', {
      type: [NumericalElementResult],
    }),
  }),
})

export const NumericalElementSolutionsRef =
  builder.objectRef<INumericalElementSolutionRange>('NumericalElementSolutions')
export const NumericalElementSolutions = NumericalElementSolutionsRef.implement(
  {
    fields: (t) => ({
      min: t.exposeFloat('min', { nullable: true }),
      max: t.exposeFloat('max', { nullable: true }),
    }),
  }
)

export const NumericalElementResultRef = builder.objectRef<
  INumericalElementEvaluationResults['responseValues'][0]
>('NumericalElementResult')
export const NumericalElementResult = NumericalElementResultRef.implement({
  fields: (t) => ({
    value: t.exposeFloat('value'),
    count: t.exposeInt('count'),
    correct: t.exposeBoolean('correct', { nullable: true }),
  }),
})
// #endregion

// ----- FREE TEXT ELEMENT EVALUATION INTERFACE -----
// #region
export const FreeTextActivityEvaluationDataRef =
  builder.objectRef<IFreeTextActivityEvaluationData>(
    'FreeTextActivityEvaluationData'
  )
export const FreeTextActivityEvaluationData =
  FreeTextActivityEvaluationDataRef.implement({
    fields: (t) => ({
      ...sharedElementEvaluation(t),
      results: t.expose('results', {
        type: FreeElementResults,
      }),
    }),
  })

export const FreeElementResultsRef =
  builder.objectRef<IFreeElementEvaluationResults>('FreeElementResults')
export const FreeElementResults = FreeElementResultsRef.implement({
  fields: (t) => ({
    totalAnswers: t.exposeInt('totalAnswers'),
    anonymousAnswers: t.exposeInt('anonymousAnswers'),
    maxLength: t.exposeInt('maxLength', { nullable: true }),
    solutions: t.exposeStringList('solutions', { nullable: true }),
    responses: t.expose('responses', {
      type: [FreeElementResult],
    }),
  }),
})

export const FreeElementResultRef =
  builder.objectRef<IFreeElementEvaluationResults['responses'][0]>(
    'FreeElementResult'
  )
export const FreeElementResult = FreeElementResultRef.implement({
  fields: (t) => ({
    value: t.exposeString('value'),
    count: t.exposeInt('count'),
    correct: t.exposeBoolean('correct', { nullable: true }),
  }),
})
// #endregion

// ----- CASE STUDY ELEMENT EVALUATION INTERFACE -----
// #region
export const CaseStudyActivityEvaluationDataRef =
  builder.objectRef<ICaseStudyActivityEvaluationData>(
    'CaseStudyActivityEvaluationData'
  )
export const CaseStudyActivityEvaluationData =
  CaseStudyActivityEvaluationDataRef.implement({
    fields: (t) => ({
      ...sharedElementEvaluation(t),
      cases: t.expose('cases', {
        type: [CaseStudyElementResultCaseInfo],
      }),
      items: t.expose('items', {
        type: [CaseStudyElementResultItemInfo],
      }),
      criteria: t.expose('criteria', {
        type: [CaseStudyElementResultCriterionInfo],
      }),
      results: t.expose('results', {
        type: CaseStudyElementResults,
      }),
    }),
  })

export const CaseStudyElementResultsRef =
  builder.objectRef<ICaseStudyElementEvaluationResults>(
    'CaseStudyElementResults'
  )
export const CaseStudyElementResults = CaseStudyElementResultsRef.implement({
  fields: (t) => ({
    totalAnswers: t.exposeInt('totalAnswers'),
    anonymousAnswers: t.exposeInt('anonymousAnswers'),
    caseResults: t.expose('caseResults', {
      type: [CaseStudyElementResultCase],
    }),
  }),
})

export const CaseStudyElementResultCaseInfoRef = builder.objectRef<
  ICaseStudyActivityEvaluationData['cases'][0]
>('CaseStudyElementResultCaseInfo')
export const CaseStudyElementResultCaseInfo =
  CaseStudyElementResultCaseInfoRef.implement({
    fields: (t) => ({
      id: t.exposeString('id'),
      name: t.exposeString('name'),
      description: t.exposeString('description'),
    }),
  })

export const CaseStudyElementResultItemInfoRef = builder.objectRef<
  ICaseStudyActivityEvaluationData['items'][0]
>('CaseStudyElementResultItemInfo')
export const CaseStudyElementResultItemInfo =
  CaseStudyElementResultItemInfoRef.implement({
    fields: (t) => ({
      id: t.exposeInt('id'),
      name: t.exposeString('name'),
    }),
  })

export const CaseStudyElementResultCriterionInfoRef = builder.objectRef<
  ICaseStudyActivityEvaluationData['criteria'][0]
>('CaseStudyElementResultCriterionInfo')
export const CaseStudyElementResultCriterionInfo =
  CaseStudyElementResultCriterionInfoRef.implement({
    fields: (t) => ({
      id: t.exposeString('id'),
      name: t.exposeString('name'),
      labels: t.expose('labels', {
        type: CaseStudyCriterionLabels,
        nullable: true,
      }),
    }),
  })

export const CaseStudyElementResultCaseRef = builder.objectRef<
  ICaseStudyElementEvaluationResults['caseResults'][0]
>('CaseStudyElementResultCase')
export const CaseStudyElementResultCase =
  CaseStudyElementResultCaseRef.implement({
    fields: (t) => ({
      caseId: t.exposeString('caseId'),
      items: t.expose('items', {
        type: [CaseStudyElementResultItem],
      }),
    }),
  })

export const CaseStudyElementResultItemRef = builder.objectRef<
  ICaseStudyElementEvaluationResults['caseResults'][0]['items'][0]
>('CaseStudyElementResultItem')
export const CaseStudyElementResultItem =
  CaseStudyElementResultItemRef.implement({
    fields: (t) => ({
      itemId: t.exposeInt('itemId'),
      criteria: t.expose('criteria', {
        type: [CaseStudyElementResultCriterion],
      }),
    }),
  })

export const CaseStudyElementResultCriterionRef = builder.objectRef<
  ICaseStudyElementEvaluationResults['caseResults'][0]['items'][0]['criteria'][0]
>('CaseStudyElementResultCriterion')
export const CaseStudyElementResultCriterion =
  CaseStudyElementResultCriterionRef.implement({
    fields: (t) => ({
      // general criterion information (always provided)
      criterionId: t.exposeString('criterionId'),
      name: t.exposeString('name'),
      min: t.exposeFloat('min'),
      max: t.exposeFloat('max'),
      step: t.exposeFloat('step'),
      unit: t.exposeString('unit', { nullable: true }),
      // TODO: add labels here for evaluation view

      // sample solutions (not required)
      solutionMin: t.exposeFloat('solutionMin', { nullable: true }),
      solutionMax: t.exposeFloat('solutionMax', { nullable: true }),

      // student responses and statistics computed based on it
      statistics: t.expose('statistics', { type: Statistics, nullable: true }),
      responses: t.expose('responses', {
        type: [CaseStudyElementResultResponse],
      }),
    }),
  })

export const CaseStudyElementResultResponseRef = builder.objectRef<
  ICaseStudyElementEvaluationResults['caseResults'][0]['items'][0]['criteria'][0]['responses'][0]
>('CaseStudyElementResultResponse')
export const CaseStudyElementResultResponse =
  CaseStudyElementResultResponseRef.implement({
    fields: (t) => ({
      value: t.exposeFloat('value'),
      count: t.exposeInt('count'),
    }),
  })
// #endregion

// ----- SELECTION ELEMENT EVALUATION INTERFACE -----
// #region
export const SelectionActivityEvaluationDataRef =
  builder.objectRef<ISelectionActivityEvaluationData>(
    'SelectionActivityEvaluationData'
  )
export const SelectionActivityEvaluationData =
  SelectionActivityEvaluationDataRef.implement({
    fields: (t) => ({
      ...sharedElementEvaluation(t),
      results: t.expose('results', {
        type: SelectionElementResults,
      }),
    }),
  })

export const SelectionElementResultsRef =
  builder.objectRef<ISelectionElementEvaluationResults>(
    'SelectionElementResults'
  )
export const SelectionElementResults = SelectionElementResultsRef.implement({
  fields: (t) => ({
    totalAnswers: t.exposeInt('totalAnswers'),
    anonymousAnswers: t.exposeInt('anonymousAnswers'),
    numberOfInputs: t.exposeInt('numberOfInputs', { nullable: true }),
    answerSolutionIds: t.exposeIntList('answerSolutionIds', { nullable: true }),
    selectionResponses: t.expose('selectionResponses', {
      type: [SelectionElementResult],
    }),
  }),
})

export const SelectionElementResultRef = builder.objectRef<
  ISelectionElementEvaluationResults['selectionResponses'][0]
>('SelectionElementResult')
export const SelectionElementResult = SelectionElementResultRef.implement({
  fields: (t) => ({
    answerId: t.exposeInt('answerId'),
    value: t.exposeString('value'),
    count: t.exposeInt('count'),
  }),
})
// #endregion

// ----- FLASHCARD ELEMENT EVALUATION INTERFACE -----
// #region
export const FlashcardActivityEvaluationDataRef =
  builder.objectRef<IFlashcardActivityEvaluationData>(
    'FlashcardActivityEvaluationData'
  )
export const FlashcardActivityEvaluationData =
  FlashcardActivityEvaluationDataRef.implement({
    fields: (t) => ({
      ...sharedElementEvaluation(t),
      results: t.expose('results', {
        type: FlashcardElementResults,
      }),
    }),
  })

export const FlashcardElementResultsRef =
  builder.objectRef<IFlashcardElementEvaluationResults>(
    'FlashcardElementResults'
  )
export const FlashcardElementResults = FlashcardElementResultsRef.implement({
  fields: (t) => ({
    totalAnswers: t.exposeInt('totalAnswers'),
    anonymousAnswers: t.exposeInt('anonymousAnswers'),
    correctCount: t.exposeInt('correctCount'),
    partialCount: t.exposeInt('partialCount'),
    incorrectCount: t.exposeInt('incorrectCount'),
  }),
})

// ----- CONTENT ELEMENT EVALUATION INTERFACE -----
export const ContentActivityEvaluationDataRef =
  builder.objectRef<IContentActivityEvaluationData>(
    'ContentActivityEvaluationData'
  )
export const ContentActivityEvaluationData =
  ContentActivityEvaluationDataRef.implement({
    fields: (t) => ({
      ...sharedElementEvaluation(t),
      results: t.expose('results', {
        type: ContentElementResults,
      }),
    }),
  })

export const ContentElementResultsRef =
  builder.objectRef<IContentElementEvaluationResults>('ContentElementResults')
export const ContentElementResults = ContentElementResultsRef.implement({
  fields: (t) => ({
    totalAnswers: t.exposeInt('totalAnswers'),
    anonymousAnswers: t.exposeInt('anonymousAnswers'),
  }),
})
// #endregion

// ----- ELEMENT EVALUATION INTERFACE -----
// #region
export const ElementInstanceEvaluation = builder.unionType(
  'ElementInstanceEvaluation',
  {
    types: [
      ChoicesActivityEvaluationData,
      NumericalActivityEvaluationData,
      FreeTextActivityEvaluationData,
      FlashcardActivityEvaluationData,
      ContentActivityEvaluationData,
      SelectionActivityEvaluationData,
      CaseStudyActivityEvaluationData,
    ],
    resolveType: (element) => {
      switch (element.type) {
        case DB.ElementType.SC:
        case DB.ElementType.MC:
        case DB.ElementType.KPRIM:
          return ChoicesActivityEvaluationData
        case DB.ElementType.NUMERICAL:
          return NumericalActivityEvaluationData
        case DB.ElementType.FREE_TEXT:
          return FreeTextActivityEvaluationData
        case DB.ElementType.FLASHCARD:
          return FlashcardActivityEvaluationData
        case DB.ElementType.CONTENT:
          return ContentActivityEvaluationData
        case DB.ElementType.SELECTION:
          return SelectionActivityEvaluationData
        case DB.ElementType.CASE_STUDY:
          return CaseStudyActivityEvaluationData
      }
    },
  }
)
// #endregion
