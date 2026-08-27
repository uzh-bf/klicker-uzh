import * as DB from '@klicker-uzh/prisma/client'
import builder from '../builder.js'
import {
  type DiscardedDuplicateCard as DiscardedDuplicateCardValue,
  type PersonalElementSource as PersonalElementSourceValue,
  type PreparedCardPlan as PreparedCardPlanValue,
  type PreparedCardPlanEntry as PreparedCardPlanEntryValue,
} from '../services/personalElements.js'
import { ElementType } from './elementData.js'
import { ResponseCorrectness } from './evaluation.js'
import { LocaleType } from './user.js'

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

export const PersonalElementSourceInput = builder.inputType(
  'PersonalElementSourceInput',
  {
    fields: (t) => ({
      sourceId: t.string({ required: true }),
      chunkId: t.string({ required: true }),
      title: t.string({ required: false }),
      url: t.string({ required: false }),
      page: t.float({ required: false }),
      metadata: t.field({ type: 'Json', required: false }),
    }),
  }
)

export const CardGenerationLeaseInput = builder.inputType(
  'CardGenerationLeaseInput',
  {
    fields: (t) => ({
      planMessageId: t.string({ required: true }),
      planToolCallId: t.string({ required: true }),
      attemptToken: t.string({ required: true }),
    }),
  }
)

export const PersonalElementCandidateInput = builder.inputType(
  'PersonalElementCandidateInput',
  {
    fields: (t) => ({
      candidateId: t.string({ required: true }),
      name: t.string({ required: true }),
      content: t.string({ required: true }),
      explanation: t.string({ required: true }),
      sources: t.field({
        type: [PersonalElementSourceInput],
        required: true,
      }),
      sourceMessageId: t.string({ required: true }),
      sourceToolCallId: t.string({ required: true }),
      origin: t.field({ type: PersonalElementOrigin, required: false }),
    }),
  }
)

export const CreatePersonalElementsInput = builder.inputType(
  'CreatePersonalElementsInput',
  {
    fields: (t) => ({
      courseId: t.string({ required: true }),
      candidates: t.field({
        type: [PersonalElementCandidateInput],
        required: true,
      }),
    }),
  }
)

export const UpdatePersonalElementInput = builder.inputType(
  'UpdatePersonalElementInput',
  {
    fields: (t) => ({
      id: t.string({ required: true }),
      expectedVersion: t.int({ required: true }),
      name: t.string({ required: false }),
      content: t.string({ required: false }),
      explanation: t.string({ required: false }),
      sources: t.field({
        type: [PersonalElementSourceInput],
        required: false,
      }),
    }),
  }
)

export const CardGenerationLeaseRef =
  builder.objectRef<DB.CardGenerationLease>('CardGenerationLease')

export const CardGenerationLease = CardGenerationLeaseRef.implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    attemptToken: t.exposeString('attemptToken'),
  }),
})

export const CardPlanEntryInput = builder.inputType('CardPlanEntryInput', {
  fields: (t) => ({
    type: t.field({ type: ElementType, required: true }),
    title: t.string({ required: true }),
    intent: t.string({ required: true }),
    query: t.string({ required: true }),
  }),
})

export const PrepareCardPlanInput = builder.inputType(
  'PrepareCardPlanInput',
  {
    fields: (t) => ({
      courseId: t.string({ required: true }),
      topic: t.string({ required: true }),
      cards: t.field({ type: [CardPlanEntryInput], required: true }),
    }),
  }
)

export const ValidateCardCandidateInput = builder.inputType(
  'ValidateCardCandidateInput',
  {
    fields: (t) => ({
      courseId: t.string({ required: true }),
      candidateId: t.string({ required: true }),
      title: t.string({ required: true }),
      front: t.string({ required: true }),
      back: t.string({ required: true }),
      sources: t.field({
        type: [PersonalElementSourceInput],
        required: true,
      }),
      sourceMessageId: t.string({ required: true }),
      sourceToolCallId: t.string({ required: true }),
    }),
  }
)

export const DiscardedDuplicateCardRef =
  builder.objectRef<DiscardedDuplicateCardValue>('DiscardedDuplicateCard')

export const DiscardedDuplicateCard = DiscardedDuplicateCardRef.implement({
  fields: (t) => ({
    title: t.exposeString('title'),
    matchedTitle: t.exposeString('matchedTitle'),
    similarity: t.exposeFloat('similarity'),
  }),
})

export const PreparedCardPlanEntryRef =
  builder.objectRef<PreparedCardPlanEntryValue>('PreparedCardPlanEntry')

export const PreparedCardPlanEntry = PreparedCardPlanEntryRef.implement({
  fields: (t) => ({
    type: t.expose('type', { type: ElementType }),
    candidateId: t.exposeString('candidateId'),
    title: t.exposeString('title'),
    intent: t.exposeString('intent'),
    query: t.exposeString('query'),
  }),
})

export const PreparedCardPlanRef =
  builder.objectRef<PreparedCardPlanValue>('PreparedCardPlan')

export const PreparedCardPlan = PreparedCardPlanRef.implement({
  fields: (t) => ({
    courseLanguage: t.expose('courseLanguage', { type: LocaleType }),
    existingTitles: t.exposeStringList('existingTitles'),
    cards: t.expose('cards', { type: [PreparedCardPlanEntry] }),
    discardedDuplicates: t.expose('discardedDuplicates', {
      type: [DiscardedDuplicateCard],
    }),
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
