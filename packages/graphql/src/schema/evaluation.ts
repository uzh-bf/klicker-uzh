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

export interface IChoicesElementInstanceEvaluation
  extends IElementInstanceEvaluation {
  results: {
    totalAnswers: number
    choices: {
      value: string
      count: number
      correct?: boolean | null
      feedback?: string | null
    }[]
  }
}

export interface IFreeElementInstanceEvaluation
  extends IElementInstanceEvaluation {
  results: {
    totalAnswers: number
    free: {
      value: string
      count: number
      correct?: boolean | null
      maxLength?: number | null
      maxValue?: number | null
      minValue?: number | null
    }[]
  }
}

export interface IFlashcardElementInstanceEvaluation
  extends IElementInstanceEvaluation {
  results: {
    totalAnswers: number
    studentGrading: {
      value: FlashcardCorrectnessType
      count: number
    }[]
  }
}

export interface IContentElementInstanceEvaluation
  extends IElementInstanceEvaluation {
  results: {
    totalAnswers: number
  }
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
  builder.interfaceRef<IChoicesElementInstanceEvaluation>(
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

export const ChoicesElementResultsRef = builder.interfaceRef<
  IChoicesElementInstanceEvaluation['results']
>('ChoicesElementResults')
export const ChoicesElementResults = ChoicesElementResultsRef.implement({
  fields: (t) => ({
    totalAnswers: t.exposeInt('totalAnswers'),
    choices: t.expose('choices', {
      type: [ChoiceElementResults],
    }),
  }),
})

export const ChoiceElementResultsRef = builder.interfaceRef<
  IChoicesElementInstanceEvaluation['results']['choices'][0]
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
  builder.interfaceRef<IFreeElementInstanceEvaluation>(
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
  builder.interfaceRef<IFreeElementInstanceEvaluation['results']>(
    'FreeElementResults'
  )
export const FreeElementResults = FreeElementResultsRef.implement({
  fields: (t) => ({
    totalAnswers: t.exposeInt('totalAnswers'),
    free: t.expose('free', {
      type: [FreeElementResult],
    }),
  }),
})

export const FreeElementResultRef =
  builder.interfaceRef<IFreeElementInstanceEvaluation['results']['free'][0]>(
    'FreeElementResult'
  )
export const FreeElementResult = FreeElementResultRef.implement({
  fields: (t) => ({
    value: t.exposeString('value'),
    count: t.exposeInt('count'),
    correct: t.exposeBoolean('correct', { nullable: true }),
    maxLength: t.exposeInt('maxLength', { nullable: true }),
    maxValue: t.exposeInt('maxValue', { nullable: true }),
    minValue: t.exposeInt('minValue', { nullable: true }),
  }),
})

// ----- FLASHCARD ELEMENT EVALUATION INTERFACE -----
export const FlashcardElementInstanceEvaluationRef =
  builder.interfaceRef<IFlashcardElementInstanceEvaluation>(
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

export const FlashcardElementResultsRef = builder.interfaceRef<
  IFlashcardElementInstanceEvaluation['results']
>('FlashcardElementResults')
export const FlashcardElementResults = FlashcardElementResultsRef.implement({
  fields: (t) => ({
    totalAnswers: t.exposeInt('totalAnswers'),
    studentGrading: t.expose('studentGrading', {
      type: [FlashcardElementResult],
    }),
  }),
})

export const FlashcardElementResultRef = builder.interfaceRef<
  IFlashcardElementInstanceEvaluation['results']['studentGrading'][0]
>('FlashcardElementResult')
export const FlashcardElementResult = FlashcardElementResultRef.implement({
  fields: (t) => ({
    value: t.expose('value', { type: FlashcardCorrectness }),
    count: t.exposeInt('count'),
  }),
})

// ----- CONTENT ELEMENT EVALUATION INTERFACE -----
export const ContentElementInstanceEvaluationRef =
  builder.interfaceRef<IContentElementInstanceEvaluation>(
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

export const ContentElementResultsRef = builder.interfaceRef<
  IContentElementInstanceEvaluation['results']
>('ContentElementResults')
export const ContentElementResults = ContentElementResultsRef.implement({
  fields: (t) => ({
    totalAnswers: t.exposeInt('totalAnswers'),
  }),
})
