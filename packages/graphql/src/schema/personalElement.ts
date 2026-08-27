import * as DB from '@klicker-uzh/prisma/client'
import builder from '../builder.js'
import { type PersonalElementSource as PersonalElementSourceValue } from '../services/personalElements.js'
import { ElementType } from './elementData.js'
import { ResponseCorrectness } from './evaluation.js'

export const PersonalElementOrigin = builder.enumType('PersonalElementOrigin', {
  values: Object.values(DB.PersonalElementOrigin),
})

export const PersonalElementSourceRef =
  builder.objectRef<PersonalElementSourceValue>('PersonalElementSource')

export const PersonalElementSource = PersonalElementSourceRef.implement({
  fields: (t) => ({
    sourceId: t.exposeString('sourceId'),
    chunkId: t.exposeString('chunkId'),
    title: t.exposeString('title', { nullable: true }),
    url: t.exposeString('url', { nullable: true }),
    page: t.exposeFloat('page', { nullable: true }),
    metadata: t.expose('metadata', { type: 'Json', nullable: true }),
  }),
})

export const PersonalElementRef =
  builder.objectRef<DB.PersonalElement>('PersonalElement')

export const PersonalElement = builder.objectType(PersonalElementRef, {
  fields: (t) => ({
    id: t.exposeID('id'),
    courseId: t.exposeID('courseId'),
    type: t.expose('type', { type: ElementType }),
    version: t.exposeInt('version'),
    name: t.exposeString('name'),
    content: t.exposeString('content'),
    explanation: t.exposeString('explanation'),
    sources: t.field({
      type: [PersonalElementSource],
      nullable: true,
      resolve: (element) =>
        (element.sources as unknown as PersonalElementSourceValue[] | null) ??
        null,
    }),
    origin: t.expose('origin', { type: PersonalElementOrigin }),
    sourceMessageId: t.exposeString('sourceMessageId', { nullable: true }),
    sourceToolCallId: t.exposeString('sourceToolCallId', { nullable: true }),
    candidateId: t.exposeString('candidateId'),
    eFactor: t.exposeFloat('eFactor'),
    interval: t.exposeInt('interval'),
    correctCountStreak: t.exposeInt('correctCountStreak'),
    correctCount: t.exposeInt('correctCount'),
    partialCorrectCount: t.exposeInt('partialCorrectCount'),
    wrongCount: t.exposeInt('wrongCount'),
    nextDueAt: t.expose('nextDueAt', { type: 'Date', nullable: true }),
    lastAnsweredAt: t.expose('lastAnsweredAt', {
      type: 'Date',
      nullable: true,
    }),
    lastCorrectAt: t.expose('lastCorrectAt', {
      type: 'Date',
      nullable: true,
    }),
    lastPartialCorrectAt: t.expose('lastPartialCorrectAt', {
      type: 'Date',
      nullable: true,
    }),
    lastWrongAt: t.expose('lastWrongAt', { type: 'Date', nullable: true }),
    lastResponseCorrectness: t.expose('lastResponseCorrectness', {
      type: ResponseCorrectness,
      nullable: true,
    }),
    createdAt: t.expose('createdAt', { type: 'Date' }),
    updatedAt: t.expose('updatedAt', { type: 'Date' }),
  }),
})
