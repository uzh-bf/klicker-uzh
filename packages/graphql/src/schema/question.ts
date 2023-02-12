import builder from '../builder'
import { QuestionData } from './questionData'

export const ResponseInput = builder.inputType('ResponseInput', {
  fields: (t) => ({
    choices: t.intList({ required: false }),
    value: t.string({ required: false }),
  }),
})

interface QuestionFeedback {
  ix: number
  feedback: string
  correct: boolean
  value: string
}

export const QuestionFeedback = builder
  .objectRef<QuestionFeedback>('QuestionFeedback')
  .implement({
    fields: (t) => ({
      ix: t.exposeInt('ix'),
      feedback: t.exposeString('feedback'),
      correct: t.exposeBoolean('correct'),
      value: t.exposeString('value'),
    }),
  })

interface InstanceEvaluation {
  feedbacks?: QuestionFeedback[]
  choices: object[]
  score: number
  pointsAwarded?: number
  percentile?: number
  newPointsFrom?: Date
}

export const InstanceEvaluation = builder
  .objectRef<InstanceEvaluation>('InstanceEvaluation')
  .implement({
    fields: (t) => ({
      feedbacks: t.expose('feedbacks', {
        type: [QuestionFeedback],
        nullable: true,
      }),
      choices: t.expose('choices', { type: 'Json' }),
      score: t.exposeFloat('score'),
      pointsAwarded: t.exposeFloat('pointsAwarded', { nullable: true }),
      percentile: t.exposeFloat('percentile', { nullable: true }),
      newPointsFrom: t.expose('newPointsFrom', {
        type: 'Date',
        nullable: true,
      }),
    }),
  })

export const Question = builder.prismaObject('Question', {
  fields: (t) => ({
    id: t.exposeInt('id'),

    name: t.exposeString('name'),
    type: t.exposeString('type'),
    content: t.exposeString('content'),

    options: t.expose('options', { type: 'Json' }),
    pointsMultiplier: t.exposeInt('pointsMultiplier'),

    questionData: t.field({ type: QuestionData, resolve: (q) => q }),

    isArchived: t.exposeBoolean('isArchived'),
    isDeleted: t.exposeBoolean('isDeleted'),

    hasSampleSolution: t.exposeBoolean('hasSampleSolution'),
    hasAnswerFeedbacks: t.exposeBoolean('hasAnswerFeedbacks'),

    createdAt: t.expose('createdAt', { type: 'Date' }),
    updatedAt: t.expose('updatedAt', { type: 'Date' }),

    attachments: t.relation('attachments'),

    tags: t.relation('tags'),
  }),
})

export const QuestionInstance = builder.prismaObject('QuestionInstance', {
  fields: (t) => ({
    id: t.exposeInt('id'),

    pointsMultiplier: t.exposeInt('pointsMultiplier'),
    evaluation: t.field({
      type: InstanceEvaluation,
      resolve: (instance) => instance.evaluation,
      nullable: true,
    }),

    // HACK: as any fixes a weird TS error that only occurs in console
    questionData: t.expose('questionData', { type: QuestionData as any }),

    attachments: t.relation('attachments'),
  }),
})

export const Tag = builder.prismaObject('Tag', {
  fields: (t) => ({
    id: t.exposeInt('id'),
    name: t.exposeString('name'),
  }),
})

export const Attachment = builder.prismaObject('Attachment', {
  fields: (t) => ({
    id: t.exposeID('id'),

    href: t.exposeString('href'),
    name: t.exposeString('name'),
    originalName: t.exposeString('originalName', { nullable: true }),
    type: t.exposeString('type'),
    description: t.exposeString('description', { nullable: true }),
  }),
})

export const AttachmentInstance = builder.prismaObject('AttachmentInstance', {
  fields: (t) => ({
    id: t.exposeID('id'),

    href: t.exposeString('href'),
    name: t.exposeString('name'),
    originalName: t.exposeString('originalName', { nullable: true }),
    type: t.exposeString('type'),
    description: t.exposeString('description', { nullable: true }),
  }),
})
