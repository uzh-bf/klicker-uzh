import * as DB from '@klicker-uzh/prisma'

import builder from '../builder'
import { QuestionData } from './questionData'

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

export const Session = builder.prismaObject('Session', {
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

    numOfBlocks: t.int({
      resolve: (session) => session.numOfBlocks,
      nullable: true,
    }),
    numOfQuestions: t.int({
      resolve: (session) => session.numOfQuestions,
      nullable: true,
    }),

    activeBlock: t.relation('activeBlock'),
    blocks: t.relation('blocks'),
    feedbacks: t.relation('feedbacks'),
    confusionFeedbacks: t.relation('confusionFeedbacks'),
    course: t.relation('course'),

    linkTo: t.exposeString('linkTo', { nullable: true }),

    createdAt: t.expose('createdAt', { type: 'Date' }),
    updatedAt: t.expose('updatedAt', { type: 'Date', nullable: true }),
    startedAt: t.expose('startedAt', { type: 'Date', nullable: true }),
    finishedAt: t.expose('finishedAt', { type: 'Date', nullable: true }),
  }),
})

export const SessionBlock = builder.prismaObject('SessionBlock', {
  fields: (t) => ({
    id: t.exposeInt('id'),

    status: t.expose('status', { type: SessionBlockStatus }),
    order: t.exposeInt('order', { nullable: true }),
    expiresAt: t.expose('expiresAt', { type: 'Date', nullable: true }),
    timeLimit: t.exposeInt('timeLimit', { nullable: true }),
    randomSelection: t.exposeInt('randomSelection', { nullable: true }),
    execution: t.exposeInt('execution', { nullable: true }),

    instances: t.relation('instances'),
  }),
})

export const Feedback = builder.prismaObject('Feedback', {
  fields: (t) => ({
    id: t.exposeInt('id'),
    isPublished: t.exposeBoolean('isPublished'),
    isPinned: t.exposeBoolean('isPinned'),
    isResolved: t.exposeBoolean('isResolved'),
    content: t.exposeString('content'),
    votes: t.exposeInt('votes'),
    responses: t.relation('responses'),
    resolvedAt: t.expose('resolvedAt', { type: 'Date', nullable: true }),
    createdAt: t.expose('createdAt', { type: 'Date' }),
  }),
})

export const FeedbackResponse = builder.prismaObject('FeedbackResponse', {
  fields: (t) => ({
    id: t.exposeInt('id'),
    content: t.exposeString('content'),
    positiveReactions: t.exposeInt('positiveReactions'),
    negativeReactions: t.exposeInt('negativeReactions'),

    createdAt: t.expose('createdAt', { type: 'Date' }),
  }),
})

export const ConfusionTimestep = builder.prismaObject('ConfusionTimestep', {
  fields: (t) => ({
    id: t.exposeInt('id'),

    speed: t.exposeInt('speed'),
    difficulty: t.exposeInt('difficulty'),

    numberOfParticipants: t.int({
      resolve: (block) => block.numberOfParticipants,
      nullable: true,
    }),

    createdAt: t.expose('createdAt', { type: 'Date' }),
  }),
})

interface Statistics {
  max: number
  min: number
  mean: number
  median: number
  q1: number
  q3: number
  sd: number
}

const Statistics = builder.objectRef<Statistics>('Statistics').implement({
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

interface InstanceResult {
  id: string

  blockIx?: number
  instanceIx: number
  participants: number
  results: object
  status: DB.SessionBlockStatus

  questionData: any
  statistics: Statistics
}

export const InstanceResult = builder
  .objectRef<InstanceResult>('InstanceResult')
  .implement({
    fields: (t) => ({
      id: t.exposeString('id'),

      blockIx: t.exposeInt('blockIx', { nullable: true }),
      instanceIx: t.exposeInt('instanceIx'),
      participants: t.exposeInt('participants'),
      results: t.expose('results', { type: 'Json' }),
      status: t.expose('status', { type: SessionBlockStatus }),

      questionData: t.expose('questionData', { type: QuestionData }),
      statistics: t.expose('statistics', { type: Statistics }),
    }),
  })

export const QuestionResponse = builder.prismaObject('QuestionResponse', {
  fields: (t) => ({
    id: t.exposeInt('id'),
  }),
})

export const QuestionResponseDetail = builder.prismaObject(
  'QuestionResponseDetail',
  {
    fields: (t) => ({
      id: t.exposeInt('id'),
    }),
  }
)

interface TabData {
  id: string
  questionIx?: number | null
  name: string
  status?: string | null
}

const TabData = builder.objectRef<TabData>('TabData').implement({
  fields: (t) => ({
    id: t.exposeString('id'),
    questionIx: t.exposeInt('questionIx', { nullable: true }),
    name: t.exposeString('name'),
    status: t.exposeString('status', { nullable: true }),
  }),
})

interface EvaluationBlock {
  blockIx?: number | null
  blockStatus: DB.SessionBlockStatus
  tabData: TabData[]
}

const EvaluationBlock = builder
  .objectRef<EvaluationBlock>('EvaluationBlock')
  .implement({
    fields: (t) => ({
      blockIx: t.exposeInt('blockIx', { nullable: true }),
      blockStatus: t.expose('blockStatus', { type: SessionBlockStatus }),
      tabData: t.expose('tabData', { type: [TabData] }),
    }),
  })

interface SessionEvaluation {
  id: string
  status: DB.SessionStatus
  isGamificationEnabled: boolean
  blocks: EvaluationBlock[]
  instanceResults: InstanceResult[]
  feedbacks: DB.Feedback[]
  confusionFeedbacks: DB.ConfusionTimestep[]
}

export const SessionEvaluation = builder
  .objectRef<SessionEvaluation>('SessionEvaluation')
  .implement({
    fields: (t) => ({
      id: t.exposeString('id'),
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
        type: [InstanceResult],
        resolve: (evaluation) => evaluation.instanceResults,
      }),
      feedbacks: t.field({
        type: [Feedback],
        resolve: (evaluation) => evaluation.feedbacks,
      }),
      confusionFeedbacks: t.field({
        type: [ConfusionTimestep],
        resolve: (evaluation) => evaluation.confusionFeedbacks,
      }),
    }),
  })
