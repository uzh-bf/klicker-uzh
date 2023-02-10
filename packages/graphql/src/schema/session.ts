import {
  AccessMode,
  SessionBlockStatus as BlockStatus,
  SessionStatus as Status,
} from '@klicker-uzh/prisma'

import builder from '../builder'

export const SessionStatus = builder.enumType('SessionStatus', {
  values: Object.values(Status),
})

export const SessionBlockStatus = builder.enumType('SessionBlockStatus', {
  values: Object.values(BlockStatus),
})

export const SessionAccessMode = builder.enumType('SessionAccessMode', {
  values: Object.values(AccessMode),
})

export const Session = builder.prismaObject('Session', {
  fields: (t) => ({
    id: t.exposeID('id'),

    isAudienceInteractionActive: t.exposeBoolean('isAudienceInteractionActive'),
    isModerationEnabled: t.exposeBoolean('isModerationEnabled'),
    isGamificationEnabled: t.exposeBoolean('isGamificationEnabled'),

    namespace: t.exposeString('namespace'),
    name: t.exposeString('name'),
    description: t.exposeString('description', { nullable: true }),
    displayName: t.exposeString('displayName'),
    linkToJoin: t.exposeString('linkTo', { nullable: true }),
    pinCode: t.exposeInt('pinCode', { nullable: true }),

    // numOfBlocks: t.exposeInt('numOfBlocks'),
    // numOfQuestions: t.exposeInt('numOfQuestions'),
    pointsMultiplier: t.exposeInt('pointsMultiplier'),

    status: t.expose('status', { type: SessionStatus }),
    accessMode: t.expose('accessMode', { type: SessionAccessMode }),

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
    resolvedAt: t.expose('resolvedAt', { type: 'Date' }),
    createdAt: t.expose('createdAt', { type: 'Date' }),
  }),
})

export const FeedbackResponse = builder.prismaObject('FeedbackResponse', {
  fields: (t) => ({
    id: t.exposeInt('id'),
    content: t.exposeString('content'),
    positiveReactions: t.exposeInt('positiveReactions'),
    negativeReactions: t.exposeInt('negativeReactions'),
  }),
})

export const ConfusionTimestep = builder.prismaObject('ConfusionTimestep', {
  fields: (t) => ({
    id: t.exposeInt('id'),
  }),
})

export const LearningElement = builder.prismaObject('LearningElement', {
  fields: (t) => ({
    id: t.exposeID('id'),
  }),
})

export const MicroSession = builder.prismaObject('MicroSession', {
  fields: (t) => ({
    id: t.exposeID('id'),
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
