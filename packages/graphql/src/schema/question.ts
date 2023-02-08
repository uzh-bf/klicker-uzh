import builder from '../builder'

export const Question = builder.prismaObject('Question', {
  fields: (t) => ({
    id: t.exposeInt('id'),
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
