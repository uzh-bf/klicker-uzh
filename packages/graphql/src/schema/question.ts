import builder from '../builder'

export const Question = builder.prismaObject('Question', {
  fields: (t) => ({
    id: t.exposeInt('id'),

    name: t.exposeString('name'),
    type: t.exposeString('type'),
    content: t.exposeString('content'),

    options: t.expose('options', { type: 'Json' }),
    pointsMultiplier: t.exposeInt('pointsMultiplier'),

    isArchived: t.exposeBoolean('isArchived'),
    isDeleted: t.exposeBoolean('isDeleted'),

    hasSampleSolution: t.exposeBoolean('hasSampleSolution'),
    hasAnswerFeedbacks: t.exposeBoolean('hasAnswerFeedbacks'),

    createdAt: t.expose('createdAt', { type: 'Date' }),
    updatedAt: t.expose('updatedAt', { type: 'Date' }),

    tags: t.relation('tags'),
  }),
})

export const QuestionInstance = builder.prismaObject('QuestionInstance', {
  fields: (t) => ({
    id: t.exposeInt('id'),
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
  }),
})

export const AttachmentInstance = builder.prismaObject('AttachmentInstance', {
  fields: (t) => ({
    id: t.exposeID('id'),
  }),
})
