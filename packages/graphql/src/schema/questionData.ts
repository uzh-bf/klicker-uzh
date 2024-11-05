import * as DB from '@klicker-uzh/prisma'
import { type BaseQuestionData } from '@klicker-uzh/types'
import builder from '../builder.js'
import {
  ChoiceQuestionOptions,
  ElementType,
  FreeTextQuestionOptions,
  NumericalQuestionOptions,
  type IChoiceQuestionOptions,
  type IFreeTextQuestionOptions,
  type INumericalQuestionOptions,
} from './elementData.js'

// ----- CHOICE QUESTIONS -----
const sharedQuestionData = (t) => ({
  id: t.exposeID('id'),
  questionId: t.exposeInt('questionId', { nullable: true }),
  name: t.exposeString('name'),
  type: t.expose('type', { type: ElementType }),
  content: t.exposeString('content'),
  explanation: t.exposeString('explanation', { nullable: true }),
  pointsMultiplier: t.exposeInt('pointsMultiplier', { nullable: true }),
})

export interface IChoicesQuestionData extends BaseQuestionData {
  options: IChoiceQuestionOptions
}
export const ChoicesQuestionData = builder
  .objectRef<IChoicesQuestionData>('ChoicesQuestionData')
  .implement({
    fields: (t) => ({
      ...sharedQuestionData(t),
      options: t.expose('options', { type: ChoiceQuestionOptions }),
    }),
  })

// ----- NUMERICAL QUESTIONS -----

export interface INumericalQuestionData extends BaseQuestionData {
  options: INumericalQuestionOptions
}
export const NumericalQuestionData = builder
  .objectRef<INumericalQuestionData>('NumericalQuestionData')
  .implement({
    fields: (t) => ({
      ...sharedQuestionData(t),
      options: t.expose('options', { type: NumericalQuestionOptions }),
    }),
  })

// ----- FREE-TEXT QUESTIONS -----

export interface IFreeTextQuestionData extends BaseQuestionData {
  options: IFreeTextQuestionOptions
}
export const FreeTextQuestionData = builder
  .objectRef<IFreeTextQuestionData>('FreeTextQuestionData')
  .implement({
    fields: (t) => ({
      ...sharedQuestionData(t),
      options: t.expose('options', { type: FreeTextQuestionOptions }),
    }),
  })

// ----- CONTENT ELEMENTS -----
export interface IContentQuestionData extends BaseQuestionData {}
export const ContentQuestionData = builder
  .objectRef<IContentQuestionData>('ContentQuestionData')
  .implement({
    fields: (t) => ({
      ...sharedQuestionData(t),
    }),
  })

// ----- FLASHCARD ELEMENTS -----
export interface IFlashcardQuestionData extends BaseQuestionData {}
export const FlashcardQuestionData = builder
  .objectRef<IFlashcardQuestionData>('FlashcardQuestionData')
  .implement({
    fields: (t) => ({
      ...sharedQuestionData(t),
    }),
  })

// ----- QUESTION DATA INTERFACE -----
export const QuestionData = builder.unionType('QuestionData', {
  types: [
    ChoicesQuestionData,
    NumericalQuestionData,
    FreeTextQuestionData,
    FlashcardQuestionData,
    ContentQuestionData,
  ],
  resolveType: (element) => {
    switch (element.type) {
      case DB.ElementType.SC:
      case DB.ElementType.MC:
      case DB.ElementType.KPRIM:
        return ChoicesQuestionData
      case DB.ElementType.NUMERICAL:
        return NumericalQuestionData
      case DB.ElementType.FREE_TEXT:
        return FreeTextQuestionData
      case DB.ElementType.FLASHCARD:
        return FlashcardQuestionData
      case DB.ElementType.CONTENT:
        return ContentQuestionData
    }
  },
})
