import * as DB from '@klicker-uzh/prisma'
import builder from '../builder'
import { BaseElementData } from '../types/app'
import {
  ChoiceQuestionOptions,
  ElementType,
  FreeTextQuestionOptions,
  IChoiceQuestionOptions,
  IFreeTextQuestionOptions,
  INumericalQuestionOptions,
  NumericalQuestionOptions,
} from './questionData'

// ----- ELEMENT DATA INTERFACE -----
export const ElementDataRef =
  builder.interfaceRef<BaseElementData>('ElementData')
export const ElementData = ElementDataRef.implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    elementId: t.exposeInt('elementId', { nullable: true }), // TODO: remove nullability
    questionId: t.exposeInt('questionId', { nullable: true }), // TODO: remove after migration
    name: t.exposeString('name'),
    type: t.expose('type', { type: ElementType }),
    content: t.exposeString('content'),
    explanation: t.exposeString('explanation', { nullable: true }),
    pointsMultiplier: t.exposeInt('pointsMultiplier'),
  }),
  resolveType(value) {
    switch (value.type) {
      case DB.ElementType.SC:
      case DB.ElementType.MC:
      case DB.ElementType.KPRIM:
        return 'ChoicesElementData'
      case DB.ElementType.NUMERICAL:
        return 'NumericalElementData'
      case DB.ElementType.FREE_TEXT:
        return 'FreeTextElementData'
      case DB.ElementType.FLASHCARD:
        return 'FlashcardElementData'
      case DB.ElementType.CONTENT:
        return 'ContentElementData'
      default:
        return null
    }
  },
})

export interface IChoicesElementData extends BaseElementData {
  options: IChoiceQuestionOptions
}
export const ChoicesElementData = builder
  .objectRef<IChoicesElementData>('ChoicesElementData')
  .implement({
    interfaces: [ElementData],
    fields: (t) => ({
      options: t.expose('options', { type: ChoiceQuestionOptions }),
    }),
  })

export interface INumericalElementData extends BaseElementData {
  options: INumericalQuestionOptions
}
export const NumericalElementData = builder
  .objectRef<INumericalElementData>('NumericalElementData')
  .implement({
    interfaces: [ElementData],
    fields: (t) => ({
      options: t.expose('options', { type: NumericalQuestionOptions }),
    }),
  })

export interface IFreeTextElementData extends BaseElementData {
  options: IFreeTextQuestionOptions
}
export const FreeTextElementData = builder
  .objectRef<IFreeTextElementData>('FreeTextElementData')
  .implement({
    interfaces: [ElementData],
    fields: (t) => ({
      options: t.expose('options', { type: FreeTextQuestionOptions }),
    }),
  })

export interface IFlashcardElementOptions {
  fake: string
}
export const FlashcardElementOptions = builder
  .objectRef<IFlashcardElementOptions>('FlashcardElementOptions')
  .implement({
    fields: (t) => ({
      fake: t.exposeString('fake'),
    }),
  })

export interface IFlashcardElementData extends BaseElementData {
  options: IFlashcardElementOptions
}
export const FlashcardElementData = builder
  .objectRef<IFlashcardElementData>('FlashcardElementData')
  .implement({
    interfaces: [ElementData],
    fields: (t) => ({
      options: t.expose('options', { type: FlashcardElementOptions }),
    }),
  })

export interface IContentElementOptions {
  fake: string
}
export const ContentElementOptions = builder
  .objectRef<IContentElementOptions>('ContentElementOptions')
  .implement({
    fields: (t) => ({
      fake: t.exposeString('fake'),
    }),
  })

export interface IContentElementData extends BaseElementData {
  options: IContentElementOptions
}
export const ContentElementData = builder
  .objectRef<IContentElementData>('ContentElementData')
  .implement({
    interfaces: [ElementData],
    fields: (t) => ({
      options: t.expose('options', { type: ContentElementOptions }),
    }),
  })
