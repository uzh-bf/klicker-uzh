import * as DB from '@klicker-uzh/prisma'
import { FlashcardCorrectness as FlashcardCorrectnessType } from '@klicker-uzh/types'
import builder from '../builder.js'
import { ElementType } from './questionData.js'

// TODO: move types to separate file with type definitions?
export interface IActivityEvaluation {
  id: string
  name: string
  displayName?: string | null
  description?: string | null
  results: IStackEvaluation[]
}

export interface IStackEvaluation {
  stackId: number
  stackName?: string | null
  stackDescription?: string | null
  stackOrder: number
  instances: IElementInstanceEvaluation[]
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

export interface IChoicesElementInstanceEvaluation
  extends IElementInstanceEvaluation {
  results: IChoicesElementEvaluationResults
}

export interface INumericalElementEvaluationResults {
  totalAnswers: number
  anonymousAnswers: number
  maxValue?: number | null
  minValue?: number | null
  solutionRanges: { min?: number | null; max?: number | null }[]
  responseValues: {
    value: number
    count: number
    correct?: boolean | null
  }[]
}

export interface INumericalElementInstanceEvaluation
  extends IElementInstanceEvaluation {
  results: INumericalElementEvaluationResults
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

export interface IFreeElementInstanceEvaluation
  extends IElementInstanceEvaluation {
  results: IFreeElementEvaluationResults
}

export interface IFlashcardElementEvaluationResults {
  totalAnswers: number
  anonymousAnswers: number
  correctCount: number
  partialCount: number
  incorrectCount: number
}

export interface IFlashcardElementInstanceEvaluation
  extends IElementInstanceEvaluation {
  results: IFlashcardElementEvaluationResults
}

export interface IContentElementEvaluationResults {
  totalAnswers: number
  anonymousAnswers: number
}

export interface IContentElementInstanceEvaluation
  extends IElementInstanceEvaluation {
  results: IContentElementEvaluationResults
}

export const FlashcardCorrectness = builder.enumType('FlashcardCorrectness', {
  values: Object.values(FlashcardCorrectnessType),
})

// ----- ACTIVITY EVALUATION INTERFACE -----
export const ActivityEvaluationRef =
  builder.objectRef<IActivityEvaluation>('ActivityEvaluation')
export const ActivityEvaluation = ActivityEvaluationRef.implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
    displayName: t.exposeString('displayName', { nullable: true }),
    description: t.exposeString('description', { nullable: true }),
    results: t.expose('results', {
      type: [StackEvaluation],
    }),
  }),
})

// ----- STACK EVALUATION INTERFACE -----
export const StackEvaluationRef =
  builder.objectRef<IStackEvaluation>('StackEvaluation')
export const StackEvaluation = StackEvaluationRef.implement({
  fields: (t) => ({
    stackId: t.exposeInt('stackId'),
    stackName: t.exposeString('stackName', { nullable: true }),
    stackDescription: t.exposeString('stackDescription', { nullable: true }),
    stackOrder: t.exposeInt('stackOrder'),
    instances: t.field({
      type: [ElementInstanceEvaluation],
      resolve: (s) => s.instances,
    }),
  }),
})

// ----- CHOICES ELEMENT EVALUATION INTERFACE -----
const sharedElementEvaluation = (t) => ({
  id: t.exposeInt('id'),
  type: t.expose('type', { type: ElementType }),
  name: t.exposeString('name'),
  content: t.exposeString('content'),
  explanation: t.exposeString('explanation', { nullable: true }),
  hasSampleSolution: t.exposeBoolean('hasSampleSolution'),
  hasAnswerFeedbacks: t.exposeBoolean('hasAnswerFeedbacks'),
})

export const ChoicesElementInstanceEvaluationRef =
  builder.objectRef<IChoicesElementInstanceEvaluation>(
    'ChoicesElementInstanceEvaluation'
  )
export const ChoicesElementInstanceEvaluation =
  ChoicesElementInstanceEvaluationRef.implement({
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

// ----- NUMERICAL ELEMENT EVALUATION INTERFACE -----
export const NumericalElementInstanceEvaluationRef =
  builder.objectRef<INumericalElementInstanceEvaluation>(
    'NumericalElementInstanceEvaluation'
  )
export const NumericalElementInstanceEvaluation =
  NumericalElementInstanceEvaluationRef.implement({
    fields: (t) => ({
      ...sharedElementEvaluation(t),
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
    }),
    responseValues: t.expose('responseValues', {
      type: [NumericalElementResult],
    }),
  }),
})

export const NumericalElementSolutionsRef = builder.objectRef<
  INumericalElementEvaluationResults['solutionRanges'][0]
>('NumericalElementSolutions')
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

// ----- FREE TEXT ELEMENT EVALUATION INTERFACE -----
export const FreeElementInstanceEvaluationRef =
  builder.objectRef<IFreeElementInstanceEvaluation>(
    'FreeElementInstanceEvaluation'
  )
export const FreeElementInstanceEvaluation =
  FreeElementInstanceEvaluationRef.implement({
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

// ----- FLASHCARD ELEMENT EVALUATION INTERFACE -----
export const FlashcardElementInstanceEvaluationRef =
  builder.objectRef<IFlashcardElementInstanceEvaluation>(
    'FlashcardElementInstanceEvaluation'
  )
export const FlashcardElementInstanceEvaluation =
  FlashcardElementInstanceEvaluationRef.implement({
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
export const ContentElementInstanceEvaluationRef =
  builder.objectRef<IContentElementInstanceEvaluation>(
    'ContentElementInstanceEvaluation'
  )
export const ContentElementInstanceEvaluation =
  ContentElementInstanceEvaluationRef.implement({
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

// ----- ELEMENT EVALUATION INTERFACE -----
export const ElementInstanceEvaluation = builder.unionType(
  'ElementInstanceEvaluation',
  {
    types: [
      ChoicesElementInstanceEvaluation,
      NumericalElementInstanceEvaluation,
      FreeElementInstanceEvaluation,
      FlashcardElementInstanceEvaluation,
      ContentElementInstanceEvaluation,
    ],
    resolveType: (element) => {
      switch (element.type) {
        case DB.ElementType.SC:
        case DB.ElementType.MC:
        case DB.ElementType.KPRIM:
          return ChoicesElementInstanceEvaluation
        case DB.ElementType.NUMERICAL:
          return NumericalElementInstanceEvaluation
        case DB.ElementType.FREE_TEXT:
          return FreeElementInstanceEvaluation
        case DB.ElementType.FLASHCARD:
          return FlashcardElementInstanceEvaluation
        case DB.ElementType.CONTENT:
          return ContentElementInstanceEvaluation
      }
    },
  }
)
