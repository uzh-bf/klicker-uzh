import * as DB from '@klicker-uzh/prisma/client'
import type {
  ElementSourceLocator as ElementSourceLocatorValue,
  ElementSourceReference as ElementSourceReferenceValue,
} from '@klicker-uzh/types'
import builder from '../builder.js'
import {
  type DiscardedDuplicateCard as DiscardedDuplicateCardValue,
  type PersonalElementGenerationContext as PersonalElementGenerationContextValue,
  type PreparedCardPlanEntry as PreparedCardPlanEntryValue,
  type PreparedCardPlan as PreparedCardPlanValue,
  readElementSourceReferences,
} from '../services/personalElements.js'
import { ElementType } from './elementData.js'
import { ResponseCorrectness } from './evaluation.js'
import { LocaleType } from './user.js'

export const PersonalElementOrigin = builder.enumType('PersonalElementOrigin', {
  values: Object.values(DB.PersonalElementOrigin),
})

export const ElementSourceKind = builder.enumType('ElementSourceKind', {
  values: ['DOCUMENT', 'WEB'] as const,
})

export const ElementSourceLocatorType = builder.enumType(
  'ElementSourceLocatorType',
  {
    values: ['PAGE_RANGE', 'WEB_ANCHOR'] as const,
  }
)

export const ElementSourceLocatorRef =
  builder.objectRef<ElementSourceLocatorValue>('ElementSourceLocator')

export const ElementSourceLocator = ElementSourceLocatorRef.implement({
  fields: (t) => ({
    type: t.expose('type', { type: ElementSourceLocatorType }),
    pageFrom: t.int({
      nullable: true,
      resolve: (locator) =>
        locator.type === 'PAGE_RANGE' ? locator.pageFrom : null,
    }),
    pageTo: t.int({
      nullable: true,
      resolve: (locator) =>
        locator.type === 'PAGE_RANGE' ? locator.pageTo : null,
    }),
    labelFrom: t.string({
      nullable: true,
      resolve: (locator) =>
        locator.type === 'PAGE_RANGE' ? (locator.labelFrom ?? null) : null,
    }),
    labelTo: t.string({
      nullable: true,
      resolve: (locator) =>
        locator.type === 'PAGE_RANGE' ? (locator.labelTo ?? null) : null,
    }),
    url: t.string({
      nullable: true,
      resolve: (locator) =>
        locator.type === 'WEB_ANCHOR' ? locator.url : null,
    }),
    label: t.string({
      nullable: true,
      resolve: (locator) =>
        locator.type === 'WEB_ANCHOR' ? (locator.label ?? null) : null,
    }),
  }),
})

export const ElementSourceReferenceRef =
  builder.objectRef<ElementSourceReferenceValue>('ElementSourceReference')

export const ElementSourceReference = ElementSourceReferenceRef.implement({
  fields: (t) => ({
    sourceId: t.exposeString('sourceId'),
    kind: t.expose('kind', { type: ElementSourceKind }),
    title: t.exposeString('title'),
    canonicalUrl: t.exposeString('canonicalUrl', { nullable: true }),
    chunkIds: t.exposeStringList('chunkIds'),
    locators: t.expose('locators', { type: [ElementSourceLocator] }),
  }),
})

export const ElementSourceLocatorInput = builder.inputType(
  'ElementSourceLocatorInput',
  {
    fields: (t) => ({
      type: t.field({ type: ElementSourceLocatorType, required: true }),
      pageFrom: t.int({ required: false }),
      pageTo: t.int({ required: false }),
      labelFrom: t.string({ required: false }),
      labelTo: t.string({ required: false }),
      url: t.string({ required: false }),
      label: t.string({ required: false }),
    }),
  }
)

export const PersonalElementSourceInput = builder.inputType(
  'PersonalElementSourceInput',
  {
    fields: (t) => ({
      sourceId: t.string({ required: true }),
      kind: t.field({ type: ElementSourceKind, required: false }),
      title: t.string({ required: false }),
      canonicalUrl: t.string({ required: false }),
      chunkIds: t.stringList({ required: false }),
      locators: t.field({
        type: [ElementSourceLocatorInput],
        required: false,
      }),
      chunkId: t.string({ required: false }),
      url: t.string({ required: false }),
      page: t.int({ required: false }),
      metadata: t.field({ type: 'Json', required: false }),
    }),
  }
)

export const CardGenerationLeaseInput = builder.inputType(
  'CardGenerationLeaseInput',
  {
    fields: (t) => ({
      courseId: t.string({ required: true }),
      planMessageId: t.string({ required: true }),
      planToolCallId: t.string({ required: true }),
      attemptToken: t.string({ required: true }),
    }),
  }
)

export const PersonalElementCandidateLinkageInput = builder.inputType(
  'PersonalElementCandidateLinkageInput',
  {
    fields: (t) => ({
      courseId: t.string({ required: true }),
      messageId: t.string({ required: true }),
      toolCallId: t.string({ required: true }),
      candidateId: t.string({ required: true }),
    }),
  }
)

export const PersonalElementRevisionLinkageInput = builder.inputType(
  'PersonalElementRevisionLinkageInput',
  {
    fields: (t) => ({
      courseId: t.string({ required: true }),
      messageId: t.string({ required: true }),
      toolCallId: t.string({ required: true }),
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
    }),
  }
)

export const CardGenerationLease = builder
  .objectRef<DB.CardGenerationLease>('CardGenerationLease')
  .implement({
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

export const PrepareCardPlanInput = builder.inputType('PrepareCardPlanInput', {
  fields: (t) => ({
    courseId: t.string({ required: true }),
    topic: t.string({ required: true }),
    cards: t.field({ type: [CardPlanEntryInput], required: true }),
  }),
})

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
    planId: t.exposeString('planId'),
    courseLanguage: t.expose('courseLanguage', { type: LocaleType }),
    existingTitles: t.exposeStringList('existingTitles'),
    cards: t.expose('cards', { type: [PreparedCardPlanEntry] }),
    discardedDuplicates: t.expose('discardedDuplicates', {
      type: [DiscardedDuplicateCard],
    }),
  }),
})

export const PersonalElementGenerationContextRef =
  builder.objectRef<PersonalElementGenerationContextValue>(
    'PersonalElementGenerationContext'
  )

export const PersonalElementGenerationContext =
  PersonalElementGenerationContextRef.implement({
    fields: (t) => ({
      courseLanguage: t.expose('courseLanguage', { type: LocaleType }),
      existingTitles: t.exposeStringList('existingTitles'),
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
      type: [ElementSourceReference],
      nullable: true,
      resolve: (element) =>
        element.sources ? readElementSourceReferences(element.sources) : null,
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
