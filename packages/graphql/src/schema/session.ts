import * as DB from '@klicker-uzh/prisma'

import builder from '../builder'
import { AllElementTypeData, QuestionResults } from '../types/app'
import type { ICourse } from './course'
import { CourseRef } from './course'
import type { IQuestionInstance } from './question'
import { QuestionInstanceRef } from './question'
import { QuestionDataRef } from './questionData'

export const SessionStatus = builder.enumType('SessionStatus', {
  values: Object.values(DB.SessionStatus),
})

export const SessionBlockStatus = builder.enumType('SessionBlockStatus', {
  values: Object.values(DB.SessionBlockStatus),
})

export const SessionAccessMode = builder.enumType('SessionAccessMode', {
  values: Object.values(DB.AccessMode),
})

export const BlockInput = builder.inputType('BlockInput', {
  fields: (t) => ({
    questionIds: t.intList({ required: true }),
    randomSelection: t.int({ required: false }),
    timeLimit: t.int({ required: false }),
  }),
})

export interface ISession extends DB.LiveSession {
  numOfBlocks?: number
  numOfQuestions?: number
  activeBlock?: ISessionBlock | null
  blocks?: ISessionBlock[]
  feedbacks?: IFeedback[]
  confusionFeedbacks?: DB.ConfusionTimestep[]
  confusionSummary?: IConfusionSummary
  course?: ICourse | null
}
export const SessionRef = builder.objectRef<ISession>('Session')
export const Session = SessionRef.implement({
  fields: (t) => ({
    id: t.exposeID('id'),

    isLiveQAEnabled: t.exposeBoolean('isLiveQAEnabled'),
    isConfusionFeedbackEnabled: t.exposeBoolean('isConfusionFeedbackEnabled'),
    isModerationEnabled: t.exposeBoolean('isModerationEnabled'),
    isGamificationEnabled: t.exposeBoolean('isGamificationEnabled'),

    namespace: t.exposeString('namespace'),
    name: t.exposeString('name'),
    description: t.exposeString('description', { nullable: true }),
    displayName: t.exposeString('displayName'),
    linkToJoin: t.exposeString('linkTo', { nullable: true }),
    pinCode: t.exposeInt('pinCode', { nullable: true }),

    pointsMultiplier: t.exposeInt('pointsMultiplier'),

    status: t.expose('status', { type: SessionStatus }),
    accessMode: t.expose('accessMode', { type: SessionAccessMode }),

    numOfBlocks: t.exposeInt('numOfBlocks', { nullable: true }),
    numOfQuestions: t.exposeInt('numOfQuestions', { nullable: true }),

    activeBlock: t.expose('activeBlock', {
      type: SessionBlockRef,
      nullable: true,
    }),
    blocks: t.expose('blocks', {
      type: [SessionBlockRef],
      nullable: true,
    }),
    feedbacks: t.expose('feedbacks', {
      type: [FeedbackRef],
      nullable: true,
    }),
    confusionFeedbacks: t.expose('confusionFeedbacks', {
      type: [ConfusionTimestepRef],
      nullable: true,
    }),
    confusionSummary: t.expose('confusionSummary', {
      type: ConfusionSummary,
      nullable: true,
    }),
    course: t.expose('course', {
      type: CourseRef,
      nullable: true,
    }),

    linkTo: t.exposeString('linkTo', { nullable: true }),

    createdAt: t.expose('createdAt', { type: 'Date' }),
    updatedAt: t.expose('updatedAt', { type: 'Date', nullable: true }),
    startedAt: t.expose('startedAt', { type: 'Date', nullable: true }),
    finishedAt: t.expose('finishedAt', { type: 'Date', nullable: true }),
  }),
})

export interface ISessionBlock extends DB.SessionBlock {
  instances?: IQuestionInstance[]
}
export const SessionBlockRef = builder.objectRef<ISessionBlock>('SessionBlock')
export const SessionBlock = SessionBlockRef.implement({
  fields: (t) => ({
    id: t.exposeInt('id'),

    status: t.expose('status', { type: SessionBlockStatus }),
    order: t.exposeInt('order', { nullable: true }),
    expiresAt: t.expose('expiresAt', { type: 'Date', nullable: true }),
    timeLimit: t.exposeInt('timeLimit', { nullable: true }),
    randomSelection: t.exposeInt('randomSelection', { nullable: true }),
    execution: t.exposeInt('execution', { nullable: true }),

    instances: t.expose('instances', {
      type: [QuestionInstanceRef],
      nullable: true,
    }),
  }),
})

export interface IFeedback extends DB.Feedback {
  responses?: DB.FeedbackResponse[]
}
export const FeedbackRef = builder.objectRef<IFeedback>('Feedback')
export const Feedback = FeedbackRef.implement({
  fields: (t) => ({
    id: t.exposeInt('id'),
    isPublished: t.exposeBoolean('isPublished'),
    isPinned: t.exposeBoolean('isPinned'),
    isResolved: t.exposeBoolean('isResolved'),
    content: t.exposeString('content'),
    votes: t.exposeInt('votes'),
    responses: t.expose('responses', {
      type: [FeedbackResponseRef],
      nullable: true,
    }),
    resolvedAt: t.expose('resolvedAt', { type: 'Date', nullable: true }),
    createdAt: t.expose('createdAt', { type: 'Date' }),
  }),
})

export const FeedbackResponseRef =
  builder.objectRef<DB.FeedbackResponse>('FeedbackResponse')
export const FeedbackResponse = FeedbackResponseRef.implement({
  fields: (t) => ({
    id: t.exposeInt('id'),
    content: t.exposeString('content'),
    positiveReactions: t.exposeInt('positiveReactions'),
    negativeReactions: t.exposeInt('negativeReactions'),

    createdAt: t.expose('createdAt', { type: 'Date' }),
  }),
})

export const ConfusionTimestepRef =
  builder.objectRef<DB.ConfusionTimestep>('ConfusionTimestep')
export const ConfusionTimestep = ConfusionTimestepRef.implement({
  fields: (t) => ({
    speed: t.exposeInt('speed'),
    difficulty: t.exposeInt('difficulty'),
    createdAt: t.expose('createdAt', { type: 'Date' }),
  }),
})

export interface IConfusionSummary {
  speed: number
  difficulty: number
  numberOfParticipants: number
}
export const ConfusionSummary = builder
  .objectRef<IConfusionSummary>('ConfusionSummary')
  .implement({
    fields: (t) => ({
      speed: t.exposeFloat('speed'),
      difficulty: t.exposeFloat('difficulty'),
      numberOfParticipants: t.exposeInt('numberOfParticipants', {
        nullable: true,
      }),
    }),
  })

export interface IStatistics {
  max: number
  min: number
  mean: number
  median: number
  q1: number
  q3: number
  sd: number
}
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

export interface IInstanceResult {
  id: string

  blockIx?: number
  instanceIx: number
  participants: number
  results: QuestionResults
  status: DB.SessionBlockStatus

  questionData: AllElementTypeData
  statistics?: IStatistics
}
export const InstanceResultRef =
  builder.objectRef<IInstanceResult>('InstanceResult')
export const InstanceResult = InstanceResultRef.implement({
  fields: (t) => ({
    id: t.exposeString('id'),

    blockIx: t.exposeInt('blockIx', { nullable: true }),
    instanceIx: t.exposeInt('instanceIx'),
    participants: t.exposeInt('participants'),
    results: t.expose('results', { type: 'Json' }),
    status: t.expose('status', { type: SessionBlockStatus }),

    questionData: t.field({
      type: QuestionDataRef,
      resolve: (q) => q.questionData,
    }),
    statistics: t.expose('statistics', { type: Statistics, nullable: true }),
  }),
})

export const QuestionResponseRef =
  builder.objectRef<DB.QuestionResponse>('QuestionResponse')
export const QuestionResponse = QuestionResponseRef.implement({
  fields: (t) => ({
    id: t.exposeInt('id'),
  }),
})

export const QuestionResponseDetailRef =
  builder.objectRef<DB.QuestionResponseDetail>('QuestionResponseDetail')
export const QuestionResponseDetail = QuestionResponseDetailRef.implement({
  fields: (t) => ({
    id: t.exposeInt('id'),
  }),
})

export interface ITabData {
  id: string
  questionIx?: number | null
  name: string
  status?: string | null
}
export const TabData = builder.objectRef<ITabData>('TabData').implement({
  fields: (t) => ({
    id: t.exposeString('id'),
    questionIx: t.exposeInt('questionIx', { nullable: true }),
    name: t.exposeString('name'),
    status: t.exposeString('status', { nullable: true }),
  }),
})

export interface IEvaluationBlock {
  blockIx?: number | null
  blockStatus: DB.SessionBlockStatus
  tabData: ITabData[]
}
export const EvaluationBlock = builder
  .objectRef<IEvaluationBlock>('EvaluationBlock')
  .implement({
    fields: (t) => ({
      blockIx: t.exposeInt('blockIx', { nullable: true }),
      blockStatus: t.expose('blockStatus', { type: SessionBlockStatus }),
      tabData: t.expose('tabData', { type: [TabData] }),
    }),
  })

export interface ISessionEvaluation {
  id: string
  displayName: string
  status: DB.SessionStatus
  isGamificationEnabled: boolean
  blocks: IEvaluationBlock[]
  instanceResults: IInstanceResult[]
  feedbacks: IFeedback[]
  confusionFeedbacks: DB.ConfusionTimestep[]
}
export const SessionEvaluationRef =
  builder.objectRef<ISessionEvaluation>('SessionEvaluation')
export const SessionEvaluation = SessionEvaluationRef.implement({
  fields: (t) => ({
    id: t.exposeString('id'),
    displayName: t.exposeString('displayName'),
    status: t.field({
      type: SessionStatus,
      resolve: (evaluation) => evaluation.status,
    }),
    isGamificationEnabled: t.exposeBoolean('isGamificationEnabled'),
    blocks: t.field({
      type: [EvaluationBlock],
      resolve: (evaluation) => evaluation.blocks,
    }),
    instanceResults: t.field({
      type: [InstanceResultRef],
      resolve: (evaluation) => evaluation.instanceResults,
    }),
    feedbacks: t.field({
      type: [FeedbackRef],
      resolve: (evaluation) => evaluation.feedbacks,
    }),
    confusionFeedbacks: t.field({
      type: [ConfusionTimestepRef],
      resolve: (evaluation) => evaluation.confusionFeedbacks,
    }),
  }),
})
