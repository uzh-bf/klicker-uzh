export const ElementDisplayMode = {
  Grid: 'GRID',
  List: 'LIST',
} as const

export type ElementDisplayMode =
  (typeof ElementDisplayMode)[keyof typeof ElementDisplayMode]

export const ElementType = {
  CaseStudy: 'CASE_STUDY',
  Content: 'CONTENT',
  Flashcard: 'FLASHCARD',
  FreeText: 'FREE_TEXT',
  Kprim: 'KPRIM',
  Mc: 'MC',
  Numerical: 'NUMERICAL',
  Sc: 'SC',
  Selection: 'SELECTION',
} as const

export type ElementType = (typeof ElementType)[keyof typeof ElementType]

export const FlashcardCorrectness = {
  Correct: 'CORRECT',
  Incorrect: 'INCORRECT',
  Partial: 'PARTIAL',
} as const

export type FlashcardCorrectness =
  (typeof FlashcardCorrectness)[keyof typeof FlashcardCorrectness]

export type InstanceEvaluation = {
  newPointsFrom?: Date | number | string | null
  newXpFrom?: Date | number | string | null
  pointsAwarded?: number | null
  pointsMultiplier?: number | null
  score: number
  xpAwarded?: number | null
}

export type Choice = {
  correct?: boolean | null
  feedback?: string | null
  ix: number
  value: string
}

export type QuestionFeedback = Choice

export type ChoiceElementOptions = {
  choices: Choice[]
  displayMode: ElementDisplayMode
  hasAnswerFeedbacks?: boolean | null
  hasSampleSolution?: boolean | null
}

export type ChoicesInstanceEvaluation = InstanceEvaluation & {
  __typename?: 'ChoicesInstanceEvaluation'
  choices?:
    | {
        count: number
        ix: number
      }[]
    | null
  explanation?: string | null
  feedbacks?: QuestionFeedback[] | null
  instanceId?: number | null
  lastResponse?: {
    choices: {
      ix: number
      selected: boolean
    }[]
  } | null
  numAnswers?: number | null
}

export type FreeTextElementOptions = {
  hasSampleSolution?: boolean | null
  restrictions?: {
    maxLength?: number | null
  } | null
  solutions?: string[] | null
}

export type FreeTextInstanceEvaluation = InstanceEvaluation & {
  __typename?: 'FreeTextInstanceEvaluation'
  answers?:
    | {
        count: number
        value: string
      }[]
    | null
  explanation?: string | null
  instanceId?: number | null
  lastResponse?: {
    value: string
  } | null
  solutions?: string[] | null
}

export type NumericalElementOptions = {
  accuracy?: number | null
  exactSolutions?: number[] | null
  hasSampleSolution?: boolean | null
  placeholder?: string | null
  restrictions?: {
    max?: number | null
    min?: number | null
  } | null
  solutionRanges?: NumericalSolutionRange[] | null
  unit?: string | null
}

export type NumericalSolutionRange = {
  max?: number | null
  min?: number | null
}

export type NumericalInstanceEvaluation = InstanceEvaluation & {
  __typename?: 'NumericalInstanceEvaluation'
  exactSolutions?: number[] | null
  explanation?: string | null
  instanceId?: number | null
  lastResponse?: {
    value: string
  } | null
  responses?:
    | {
        count: number
        value: number
      }[]
    | null
  solutionRanges?: NumericalSolutionRange[] | null
}

export type Statistics = {
  max: number
  mean: number
  median: number
  min: number
  q1: number
  q3: number
  sd: number
}

type ActivityEvaluationBase = {
  content: string
  explanation?: string | null
  hasAnswerFeedbacks: boolean
  hasSampleSolution: boolean
  id: number
  name: string
  type: ElementType
}

type CountedTextResult = {
  correct?: boolean | null
  count: number
  feedback?: string | null
  value: string
}

type CountedNumericalResult = {
  correct?: boolean | null
  count: number
  value: number
}

export type ChoicesActivityEvaluationData = ActivityEvaluationBase & {
  __typename: 'ChoicesActivityEvaluationData'
  results: {
    anonymousAnswers: number
    choices: CountedTextResult[]
    totalAnswers: number
  }
}

export type NumericalActivityEvaluationData = ActivityEvaluationBase & {
  __typename: 'NumericalActivityEvaluationData'
  results: {
    anonymousAnswers: number
    exactSolutions?: number[] | null
    maxValue?: number | null
    minValue?: number | null
    responseValues: CountedNumericalResult[]
    solutionRanges?: NumericalSolutionRange[] | null
    totalAnswers: number
  }
  statistics?: Statistics | null
}

export type FreeTextActivityEvaluationData = ActivityEvaluationBase & {
  __typename: 'FreeTextActivityEvaluationData'
  results: {
    anonymousAnswers: number
    maxLength?: number | null
    responses: CountedTextResult[]
    solutions?: string[] | null
    totalAnswers: number
  }
}

export type SelectionActivityEvaluationData = ActivityEvaluationBase & {
  __typename: 'SelectionActivityEvaluationData'
  results: {
    anonymousAnswers: number
    answerSolutionIds?: number[] | null
    numberOfInputs?: number | null
    selectionResponses: {
      answerId: number
      count: number
      value: string
    }[]
    totalAnswers: number
  }
}

export type FlashcardActivityEvaluationData = ActivityEvaluationBase & {
  __typename: 'FlashcardActivityEvaluationData'
  results: {
    anonymousAnswers: number
    correctCount: number
    incorrectCount: number
    partialCount: number
    totalAnswers: number
  }
}

export type ElementInstanceEvaluation =
  | ChoicesActivityEvaluationData
  | NumericalActivityEvaluationData
  | FreeTextActivityEvaluationData
  | SelectionActivityEvaluationData
  | FlashcardActivityEvaluationData

export type ContentElementInstance = {
  elementData: {
    content: string
  }
}

export type SelectionElementOptions = {
  answerCollection?: {
    entries?:
      | {
          id: number
          value: string
        }[]
      | null
  } | null
  answerCollectionSolutionIds?: number[] | null
  hasSampleSolution?: boolean | null
  numberOfInputs?: number | null
}

export type SelectionInstanceEvaluation = InstanceEvaluation & {
  __typename?: 'SelectionInstanceEvaluation'
  answerSolutionIds?: number[] | null
  explanation?: string | null
  instanceId?: number | null
  lastResponse?: {
    selection: number[]
  } | null
  numAnswers?: number | null
  selectionResponses?:
    | {
        answerId: number
        count: number
        value: string
      }[]
    | null
}

export type CaseStudyElementOptions = {
  answerCollectionId?: number | null
  cases: {
    description: string
    id: string
    solutions?:
      | {
          criteriaSolutions: {
            criterionId: string
            max: number
            min: number
          }[]
          itemId: number
        }[]
      | null
    title: string
  }[]
  collectionItemIds?: number[] | null
  criteria: {
    id: string
    labels?: {
      max: string
      mid?: string | null
      min: string
    } | null
    max: number
    min: number
    name: string
    step: number
    unit?: string | null
  }[]
  hasSampleSolution?: boolean | null
  items?:
    | {
        id: number
        value: string
      }[]
    | null
}

export type CaseStudyInstanceEvaluation = InstanceEvaluation & {
  __typename?: 'CaseStudyInstanceEvaluation'
  assessments?:
    | {
        caseId: string
        criterionId: string
        itemId: number
        responseValues: number[]
      }[]
    | null
  explanation?: string | null
  instanceId?: number | null
  lastResponse?: {
    assessment: {
      caseId: string
      itemResponses: {
        criterionResponses: {
          criterionId: string
          correct?: boolean | null
          response: number
        }[]
        itemId: number
      }[]
    }[]
  } | null
  studySolutions?:
    | {
        caseId: string
        solutions?:
          | {
              criteriaSolutions: {
                criterionId: string
                max: number
                min: number
              }[]
              itemId: number
            }[]
          | null
      }[]
    | null
}

export type ContentInstanceEvaluation = InstanceEvaluation & {
  __typename?: 'ContentInstanceEvaluation'
  instanceId?: number | null
  lastResponse?: {
    viewed: boolean
  } | null
}

export type FlashcardInstanceEvaluation = InstanceEvaluation & {
  __typename?: 'FlashcardInstanceEvaluation'
  instanceId?: number | null
  lastResponse?: {
    correctness: FlashcardCorrectness
  } | null
}

export type StudentInstanceEvaluation =
  | CaseStudyInstanceEvaluation
  | ChoicesInstanceEvaluation
  | ContentInstanceEvaluation
  | FlashcardInstanceEvaluation
  | FreeTextInstanceEvaluation
  | NumericalInstanceEvaluation
  | SelectionInstanceEvaluation

type ElementDataBase = {
  basePoints: boolean
  content: string
  id: string
  name: string
  explanation?: string | null
  type: ElementType
}

type ChoicesElementData = ElementDataBase & {
  __typename: 'ChoicesElementData'
  options: ChoiceElementOptions
  type: typeof ElementType.Kprim | typeof ElementType.Mc | typeof ElementType.Sc
}

type NumericalElementData = ElementDataBase & {
  __typename: 'NumericalElementData'
  options: NumericalElementOptions
  type: typeof ElementType.Numerical
}

type FreeTextElementData = ElementDataBase & {
  __typename: 'FreeTextElementData'
  options: FreeTextElementOptions
  type: typeof ElementType.FreeText
}

type SelectionElementData = ElementDataBase & {
  __typename: 'SelectionElementData'
  options: SelectionElementOptions
  type: typeof ElementType.Selection
}

type CaseStudyElementData = ElementDataBase & {
  __typename: 'CaseStudyElementData'
  options: CaseStudyElementOptions
  type: typeof ElementType.CaseStudy
}

type FlashcardElementData = ElementDataBase & {
  __typename: 'FlashcardElementData'
  type: typeof ElementType.Flashcard
}

type ContentElementData = ElementDataBase & {
  __typename: 'ContentElementData'
  type: typeof ElementType.Content
}

export type ElementInstance = {
  elementData:
    | CaseStudyElementData
    | ChoicesElementData
    | ContentElementData
    | FlashcardElementData
    | FreeTextElementData
    | NumericalElementData
    | SelectionElementData
  elementType: ElementType
  id: number
}

export type ElementStack = {
  description?: string | null
  displayName?: string | null
  elements?: ElementInstance[] | null
  id: number
}
