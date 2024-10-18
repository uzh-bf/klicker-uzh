import * as DB from '@klicker-uzh/prisma'
import builder from '../builder.js'
import { BaseElementData } from '../types/app.js'
import {
  ChoiceQuestionOptions,
  ElementType,
  FreeTextQuestionOptions,
  IChoiceQuestionOptions,
  IFreeTextQuestionOptions,
  INumericalQuestionOptions,
  NumericalQuestionOptions,
} from './questionData.js'

export interface IElementInstanceOptions {
  pointsMultiplier?: number
  resetTimeDays?: number
}
export const ElementInstanceOptions = builder
  .objectRef<IElementInstanceOptions>('ElementInstanceOptions')
  .implement({
    fields: (t) => ({
      pointsMultiplier: t.exposeInt('pointsMultiplier', { nullable: true }),
      resetTimeDays: t.exposeInt('resetTimeDays', { nullable: true }),
    }),
  })

// ----- ELEMENT DATA INTERFACE -----
export const ElementDataRef =
  builder.interfaceRef<BaseElementData>('ElementData')
export const ElementData = ElementDataRef.implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    elementId: t.exposeInt('elementId'),
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

export interface IFlashcardElementData extends BaseElementData {}
export const FlashcardElementData = builder
  .objectRef<IFlashcardElementData>('FlashcardElementData')
  .implement({
    interfaces: [ElementData],
  })

export interface IContentElementData extends BaseElementData {}
export const ContentElementData = builder
  .objectRef<IContentElementData>('ContentElementData')
  .implement({
    interfaces: [ElementData],
  })
