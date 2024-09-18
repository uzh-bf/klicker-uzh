import * as DB from '@klicker-uzh/prisma'
import builder from '../builder.js'
import { FlashcardCorrectness as FlashcardCorrectnessType } from '../types/app.js'
import { ElementType } from './questionData.js'

// TODO: move types to separate file with type definitions?
export interface IActivityEvaluation {
  id: number
  name: string
  displayName: string
  description?: string | null
  results: IStackEvaluation[]
}

export interface IStackEvaluation {
  stackId: number
  stackName: string
  stackDescription: string
  stackOrder: number
  instances: IElementInstanceEvaluation[]
}

export interface IElementInstanceEvaluation {
  id: number
  type: DB.ElementType
  name: string
  displayName: string
  content: string
  explanation?: string | null
  hasSampleSolution: boolean
  hasAnswerFeedbacks: boolean
  results: object // TODO: typing with results objects?!
}

export type InstanceEvaluationResults =
  | IChoicesElementInstanceEvaluation
  | IFreeElementInstanceEvaluation
  | IFlashcardElementInstanceEvaluation
  | IContentElementInstanceEvaluation

interface IElementInstanceEvaluationResults<
  Type extends DB.ElementType,
  Results extends InstanceEvaluationResults,
> {}

export type ChoicesInstanceEvaluationData = IElementInstanceEvaluationResults<
  'SC' | 'MC' | 'KPRIM',
  IChoicesElementInstanceEvaluation
>
export type FreeInstanceEvaluationData = IElementInstanceEvaluationResults<
  'FREE_TEXT' | 'NUMERICAL',
  IFreeElementInstanceEvaluation
>
export type FlashcardInstanceEvaluationData = IElementInstanceEvaluationResults<
  'FLASHCARD',
  IFlashcardElementInstanceEvaluation
>
export type ContentInstanceEvaluationData = IElementInstanceEvaluationResults<
  'CONTENT',
  IContentElementInstanceEvaluation
>

export type AllInstanceEvaluationData =
  | ChoicesInstanceEvaluationData
  | FreeInstanceEvaluationData
  | FlashcardInstanceEvaluationData
  | ContentInstanceEvaluationData

export interface IChoicesElementEvaluationResults {
  totalAnswers: number
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

export interface IFreeElementEvaluationResults {
  totalAnswers: number
  maxLength?: number | null
  maxValue?: number | null
  minValue?: number | null
  free: {
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
  builder.interfaceRef<IActivityEvaluation>('ActivityEvaluation')
export const ActivityEvaluation = ActivityEvaluationRef.implement({
  fields: (t) => ({
    id: t.exposeInt('id'),
    name: t.exposeString('name'),
    displayName: t.exposeString('displayName'),
    description: t.exposeString('description', { nullable: true }),
    results: t.expose('results', {
      type: [StackEvaluation],
    }),
  }),
})

// ----- STACK EVALUATION INTERFACE -----
export const StackEvaluationRef =
  builder.interfaceRef<IStackEvaluation>('StackEvaluation')
export const StackEvaluation = StackEvaluationRef.implement({
  fields: (t) => ({
    stackId: t.exposeInt('stackId'),
    stackName: t.exposeString('stackName'),
    stackDescription: t.exposeString('stackDescription'),
    stackOrder: t.exposeInt('stackOrder'),
    instances: t.field({
      type: [ElementInstanceEvaluationRef],
      resolve: (s) => s.instances,
    }),
  }),
})

// ----- ELEMENT EVALUATION INTERFACE -----
export const ElementInstanceEvaluationRef =
  builder.interfaceRef<IElementInstanceEvaluation>('ElementInstanceEvaluation')
export const ElementInstanceEvaluation = ElementInstanceEvaluationRef.implement(
  {
    fields: (t) => ({
      id: t.exposeInt('id'),
      type: t.expose('type', { type: ElementType }),
      name: t.exposeString('name'),
      displayName: t.exposeString('displayName'),
      content: t.exposeString('content'),
      explanation: t.exposeString('explanation', { nullable: true }),
      hasSampleSolution: t.exposeBoolean('hasSampleSolution'),
      hasAnswerFeedbacks: t.exposeBoolean('hasAnswerFeedbacks'),
    }),
    resolveType(value) {
      switch (value.type) {
        case DB.ElementType.SC:
        case DB.ElementType.MC:
        case DB.ElementType.KPRIM:
          return 'ChoicesElementInstanceEvaluation'
        case DB.ElementType.NUMERICAL:
        case DB.ElementType.FREE_TEXT:
          return 'FreeElementInstanceEvaluation'
        case DB.ElementType.FLASHCARD:
          return 'FlashcardElementInstanceEvaluation'
        case DB.ElementType.CONTENT:
          return 'ContentElementInstanceEvaluation'
        default:
          return null
      }
    },
  }
)

// ----- CHOICES ELEMENT EVALUATION INTERFACE -----
export const ChoicesElementInstanceEvaluationRef =
  builder.objectRef<IChoicesElementInstanceEvaluation>(
    'ChoicesElementInstanceEvaluation'
  )
export const ChoicesElementInstanceEvaluation =
  ChoicesElementInstanceEvaluationRef.implement({
    interfaces: [ElementInstanceEvaluation],
    fields: (t) => ({
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

// ----- FREE ELEMENT EVALUATION INTERFACE -----
export const FreeElementInstanceEvaluationRef =
  builder.objectRef<IFreeElementInstanceEvaluation>(
    'FreeElementInstanceEvaluation'
  )
export const FreeElementInstanceEvaluation =
  FreeElementInstanceEvaluationRef.implement({
    interfaces: [ElementInstanceEvaluation],
    fields: (t) => ({
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
    maxLength: t.exposeInt('maxLength', { nullable: true }),
    maxValue: t.exposeInt('maxValue', { nullable: true }),
    minValue: t.exposeInt('minValue', { nullable: true }),
    free: t.expose('free', {
      type: [FreeElementResult],
    }),
  }),
})

export const FreeElementResultRef =
  builder.objectRef<IFreeElementEvaluationResults['free'][0]>(
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
    interfaces: [ElementInstanceEvaluation],
    fields: (t) => ({
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
    interfaces: [ElementInstanceEvaluation],
    fields: (t) => ({
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
  }),
})
