import * as DB from '@klicker-uzh/prisma'
import type { BaseQuestionData } from '@klicker-uzh/types'
import builder from '../builder.js'
import { ElementFeedbackRef } from './analytics.js'
import { ElementData, ElementInstanceOptions } from './elementData.js'
import {
  ElementDisplayMode,
  ElementInstanceType,
  ElementStatus,
  ElementType,
  QuestionData,
} from './questionData.js'

export const ChoiceInput = builder.inputType('ChoiceInput', {
  fields: (t) => ({
    ix: t.int({ required: true }),
    value: t.string({ required: true }),
    correct: t.boolean({ required: false }),
    feedback: t.string({ required: false }),
  }),
})

export const OptionsChoicesInput = builder.inputType('OptionsChoicesInput', {
  fields: (t) => ({
    displayMode: t.field({ required: false, type: ElementDisplayMode }),
    hasSampleSolution: t.boolean({ required: false }),
    hasAnswerFeedbacks: t.boolean({ required: false }),
    choices: t.field({
      type: [ChoiceInput],
    }),
  }),
})

export const NumericalRestrictionsInput = builder.inputType(
  'NumericalRestrictionsInput',
  {
    fields: (t) => ({
      hasSampleSolution: t.boolean({ required: false }),
      hasAnswerFeedbacks: t.boolean({ required: false }),
      min: t.float({ required: false }),
      max: t.float({ required: false }),
    }),
  }
)

export const SolutionRangeInput = builder.inputType('SolutionRangeInput', {
  fields: (t) => ({
    min: t.float({ required: false }),
    max: t.float({ required: false }),
  }),
})

export const OptionsNumericalInput = builder.inputType(
  'OptionsNumericalInput',
  {
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
      feedback: t.string({ required: false }),
    }),
  }
)

export const FreeTextRestrictionsInput = builder.inputType(
  'FreeTextRestrictionsInput',
  {
    fields: (t) => ({
      maxLength: t.int({ required: false }),
      minLength: t.int({ required: false }),
      pattern: t.string({ required: false }),
    }),
  }
)

export const OptionsFreeTextInput = builder.inputType('OptionsFreeTextInput', {
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

// TODO: remove after migration to new element structure
export const ResponseInput = builder.inputType('ResponseInput', {
  // directives: {
  //   oneOf: {},
  // },
  fields: (t) => ({
    choices: t.intList({ required: false }),
    value: t.string({ required: false }),
  }),
})

export interface IQuestionFeedback {
  ix: number
  feedback?: string
  correct?: boolean
  value: string
}
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

export interface IInstanceEvaluation {
  instanceId: number
  pointsMultiplier?: number
  explanation?: string | null
  feedbacks?: IQuestionFeedback[]
  choices?: object[]
  numAnswers?: number
  answers?: object[]
  score: number
  pointsAwarded?: number | null
  percentile?: number
  newPointsFrom?: Date
  xpAwarded?: number
  newXpFrom?: Date
  solutions?: string[]
  solutionRanges?: { min?: number | null; max?: number | null }[]
  lastResponse?: object | null
  correctness?: number | null
}
export const InstanceEvaluation = builder
  .objectRef<IInstanceEvaluation>('InstanceEvaluation')
  .implement({
    fields: (t) => ({
      instanceId: t.exposeInt('instanceId'),
      pointsMultiplier: t.exposeInt('pointsMultiplier', { nullable: true }),
      explanation: t.exposeString('explanation', { nullable: true }),
      feedbacks: t.expose('feedbacks', {
        type: [QuestionFeedback],
        nullable: true,
      }),
      choices: t.expose('choices', { type: 'Json', nullable: true }),
      numAnswers: t.exposeInt('numAnswers', { nullable: true }),
      answers: t.expose('answers', {
        type: 'Json',
        nullable: true,
      }),
      score: t.exposeFloat('score'),
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
      solutions: t.expose('solutions', { type: 'Json', nullable: true }),
      solutionRanges: t.expose('solutionRanges', {
        type: 'Json',
        nullable: true,
      }),
      lastResponse: t.expose('lastResponse', { type: 'Json', nullable: true }),
      correctness: t.exposeFloat('correctness', { nullable: true }),
    }),
  })

export interface IElement extends Omit<DB.Element, 'ownerId' | 'originalId'> {
  tags?: ITag[] | null
  questionData?: BaseQuestionData | null
}
export const ElementRef = builder.objectRef<IElement>('Element')
export const Element = ElementRef.implement({
  fields: (t) => ({
    id: t.exposeInt('id'),

    version: t.exposeInt('version'),
    name: t.exposeString('name'),
    status: t.expose('status', { type: ElementStatus }),
    type: t.expose('type', { type: ElementType }),
    content: t.exposeString('content'),
    explanation: t.exposeString('explanation', { nullable: true }),

    options: t.expose('options', { type: 'Json' }),
    pointsMultiplier: t.exposeInt('pointsMultiplier'),

    questionData: t.field({
      type: QuestionData,
      resolve: (q) => q.questionData,
      nullable: true,
    }),

    isArchived: t.exposeBoolean('isArchived'),
    isDeleted: t.exposeBoolean('isDeleted'),

    createdAt: t.expose('createdAt', { type: 'Date' }),
    updatedAt: t.expose('updatedAt', { type: 'Date' }),

    tags: t.expose('tags', {
      type: [TagRef],
      nullable: true,
    }),
  }),
})

export interface IQuestionOrElementInstance {
  questionInstance?: DB.QuestionInstance | null
  elementInstance?: DB.ElementInstance | null
}
export const QuestionOrElementInstanceRef =
  builder.objectRef<IQuestionOrElementInstance>('QuestionOrElementInstance')
export const QuestionOrElementInstance = QuestionOrElementInstanceRef.implement(
  {
    fields: (t) => ({
      questionInstance: t.expose('questionInstance', {
        type: QuestionInstanceRef,
        nullable: true,
      }),
      elementInstance: t.expose('elementInstance', {
        type: ElementInstanceRef,
        nullable: true,
      }),
    }),
  }
)

export const QuestionInstanceRef =
  builder.objectRef<DB.QuestionInstance>('QuestionInstance')
export const QuestionInstance = QuestionInstanceRef.implement({
  fields: (t) => ({
    id: t.exposeInt('id'),
    pointsMultiplier: t.exposeInt('pointsMultiplier', { nullable: true }),

    questionData: t.field({
      type: QuestionData,
      resolve: (q) => q.questionData,
      nullable: true,
    }),
  }),
})

export interface IElementInstance extends DB.ElementInstance {
  feedbacks?: DB.ElementFeedback[] | null
}
export const ElementInstanceRef =
  builder.objectRef<IElementInstance>('ElementInstance')
export const ElementInstance = ElementInstanceRef.implement({
  fields: (t) => ({
    id: t.exposeInt('id'),

    type: t.expose('type', { type: ElementInstanceType }),
    elementType: t.expose('elementType', { type: ElementType }),

    elementData: t.field({
      type: ElementData,
      resolve: (q) => q.elementData,
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

export interface ITag
  extends Omit<DB.Tag, 'originalId' | 'ownerId' | 'createdAt' | 'updatedAt'> {}
export const TagRef = builder.objectRef<ITag>('Tag')
export const Tag = TagRef.implement({
  fields: (t) => ({
    id: t.exposeInt('id'),
    name: t.exposeString('name'),
    order: t.exposeInt('order'),
  }),
})
