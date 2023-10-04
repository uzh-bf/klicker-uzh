import * as DB from '@klicker-uzh/prisma'
import builder from '../builder'
import { QuestionData, QuestionDisplayMode, QuestionType } from './questionData'

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
    choices: t.field({
      type: [ChoiceInput],
    }),
  }),
})

export const NumericalRestrictionsInput = builder.inputType(
  'NumericalRestrictionsInput',
  {
    fields: (t) => ({
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
    placeholder: t.string({ required: false }),
    restrictions: t.field({
      type: FreeTextRestrictionsInput,
      required: false,
    }),
    solutions: t.stringList({ required: false }),
    feedback: t.string({ required: false }),
  }),
})

export const ResponseInput = builder.inputType('ResponseInput', {
  directives: {
    oneOf: {},
  },
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
  feedbacks?: IQuestionFeedback[]
  choices?: object[]
  answers?: object[]
  score: number
  pointsAwarded?: number | null
  percentile?: number
  newPointsFrom?: Date
  xpAwarded?: number
  newXpFrom?: Date
}
export const InstanceEvaluation = builder
  .objectRef<IInstanceEvaluation>('InstanceEvaluation')
  .implement({
    fields: (t) => ({
      feedbacks: t.expose('feedbacks', {
        type: [QuestionFeedback],
        nullable: true,
      }),
      choices: t.expose('choices', { type: 'Json', nullable: true }),
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
    }),
  })

export const Question = builder.prismaObject('Question', {
  fields: (t) => ({
    id: t.exposeInt('id'),

    name: t.exposeString('name'),
    type: t.expose('type', { type: QuestionType }),
    content: t.exposeString('content'),
    explanation: t.exposeString('explanation', { nullable: true }),

    options: t.expose('options', { type: 'Json' }),
    pointsMultiplier: t.exposeInt('pointsMultiplier'),

    questionData: t.field({
      type: QuestionData,
      resolve: (q) => q,
    }),
    displayMode: t.expose('displayMode', { type: QuestionDisplayMode }),

    isArchived: t.exposeBoolean('isArchived'),
    isDeleted: t.exposeBoolean('isDeleted'),

    hasSampleSolution: t.exposeBoolean('hasSampleSolution'),
    hasAnswerFeedbacks: t.exposeBoolean('hasAnswerFeedbacks'),

    createdAt: t.expose('createdAt', { type: 'Date' }),
    updatedAt: t.expose('updatedAt', { type: 'Date' }),

    tags: t.relation('tags'),
  }),
})

export interface IQuestionInstance extends DB.QuestionInstance {
  evaluation?: IInstanceEvaluation
}
export const QuestionInstanceRef =
  builder.objectRef<IQuestionInstance>('QuestionInstance')
export const QuestionInstance = QuestionInstanceRef.implement({
  fields: (t) => ({
    id: t.exposeInt('id'),

    pointsMultiplier: t.exposeInt('pointsMultiplier'),
    evaluation: t.expose('evaluation', {
      type: InstanceEvaluation,
      nullable: true,
    }),

    questionData: t.field({
      type: QuestionData,
      resolve: (q) => q.questionData,
    }),
  }),
})

export const Tag = builder.prismaObject('Tag', {
  fields: (t) => ({
    id: t.exposeInt('id'),
    name: t.exposeString('name'),
    order: t.exposeInt('order'),
  }),
})
