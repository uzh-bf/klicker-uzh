import builder from '../builder'

export const Session = builder.prismaObject('Session', {
  fields: (t) => ({
    id: t.exposeID('id'),
  }),
})

export const SessionBlock = builder.prismaObject('SessionBlock', {
  fields: (t) => ({
    id: t.exposeID('id'),
  }),
})

export const Feedback = builder.prismaObject('Feedback', {
  fields: (t) => ({
    id: t.exposeID('id'),
    isPublished: t.exposeBoolean('isPublished'),
    isPinned: t.exposeBoolean('isPinned'),
    isResolved: t.exposeBoolean('isResolved'),
    content: t.exposeString('content'),
    votes: t.exposeInt('votes'),
    responses: t.relation('responses'),
    resolvedAt: t.expose('resolvedAt', { type: 'Date' }),
  }),
})

export const FeedbackResponse = builder.prismaObject('FeedbackResponse', {
  fields: (t) => ({
    id: t.exposeID('id'),
  }),
})

export const ConfusionTimestep = builder.prismaObject('ConfusionTimestep', {
  fields: (t) => ({
    id: t.exposeID('id'),
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
    id: t.exposeID('id'),
  }),
})

export const QuestionResponseDetail = builder.prismaObject(
  'QuestionResponseDetail',
  {
    fields: (t) => ({
      id: t.exposeID('id'),
    }),
  }
)
