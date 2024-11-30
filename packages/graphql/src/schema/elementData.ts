import * as DB from '@klicker-uzh/prisma'
import {
  DisplayMode,
  type BaseElementData,
  type Choice as ChoiceType,
  type NumericalSolutionRange as NumericalSolutionRangeType,
} from '@klicker-uzh/types'
import builder from '../builder.js'

export const ElementType = builder.enumType('ElementType', {
  values: Object.values(DB.ElementType),
})

export const ElementStatus = builder.enumType('ElementStatus', {
  values: Object.values(DB.ElementStatus),
})

export const ElementInstanceType = builder.enumType('ElementInstanceType', {
  values: Object.values(DB.ElementInstanceType),
})

export const ElementDisplayMode = builder.enumType('ElementDisplayMode', {
  values: Object.values(DisplayMode),
})

// ----- QUESTION OPTIONS -----
// #region
export const Choice = builder.objectRef<ChoiceType>('Choice').implement({
  fields: (t) => ({
    ix: t.exposeInt('ix'),
    correct: t.exposeBoolean('correct', { nullable: true }),
    feedback: t.exposeString('feedback', { nullable: true }),
    value: t.exposeString('value'),
  }),
})

export interface IChoiceQuestionOptions {
  displayMode: DisplayMode
  hasSampleSolution?: boolean
  hasAnswerFeedbacks?: boolean
  choices: ChoiceType[]
}
export const ChoiceQuestionOptions = builder
  .objectRef<IChoiceQuestionOptions>('ChoiceQuestionOptions')
  .implement({
    fields: (t) => ({
      displayMode: t.expose('displayMode', { type: ElementDisplayMode }),
      hasSampleSolution: t.exposeBoolean('hasSampleSolution', {
        nullable: true,
      }),
      hasAnswerFeedbacks: t.exposeBoolean('hasAnswerFeedbacks', {
        nullable: true,
      }),
      choices: t.expose('choices', { type: [Choice] }),
    }),
  })

export interface INumericalRestrictions {
  min?: number
  max?: number
}
export const NumericalRestrictions = builder
  .objectRef<INumericalRestrictions>('NumericalRestrictions')
  .implement({
    fields: (t) => ({
      min: t.exposeFloat('min', { nullable: true }),
      max: t.exposeFloat('max', { nullable: true }),
    }),
  })

export const NumericalSolutionRange = builder
  .objectRef<NumericalSolutionRangeType>('NumericalSolutionRange')
  .implement({
    fields: (t) => ({
      min: t.exposeFloat('min', { nullable: true }),
      max: t.exposeFloat('max', { nullable: true }),
    }),
  })

export interface INumericalQuestionOptions {
  hasSampleSolution?: boolean
  hasAnswerFeedbacks?: boolean
  accuracy?: number | null
  placeholder?: string | null
  unit?: string | null
  restrictions?: INumericalRestrictions | null
  solutionRanges?: NumericalSolutionRangeType[] | null
}
export const NumericalQuestionOptions = builder
  .objectRef<INumericalQuestionOptions>('NumericalQuestionOptions')
  .implement({
    fields: (t) => ({
      hasSampleSolution: t.exposeBoolean('hasSampleSolution', {
        nullable: true,
      }),
      hasAnswerFeedbacks: t.exposeBoolean('hasAnswerFeedbacks', {
        nullable: true,
      }),
      accuracy: t.exposeInt('accuracy', { nullable: true }),
      placeholder: t.exposeString('placeholder', { nullable: true }),
      unit: t.exposeString('unit', { nullable: true }),
      restrictions: t.expose('restrictions', {
        type: NumericalRestrictions,
        nullable: true,
      }),
      solutionRanges: t.expose('solutionRanges', {
        type: [NumericalSolutionRange],
        nullable: true,
      }),
    }),
  })

export interface IFreeTextRestrictions {
  maxLength?: number | null
}
export const FreeTextRestrictions = builder
  .objectRef<IFreeTextRestrictions>('FreeTextRestrictions')
  .implement({
    fields: (t) => ({
      maxLength: t.exposeInt('maxLength', { nullable: true }),
    }),
  })

export interface IFreeTextQuestionOptions {
  hasSampleSolution?: boolean
  hasAnswerFeedbacks?: boolean
  restrictions?: IFreeTextRestrictions | null
  solutions?: string[] | null
}
export const FreeTextQuestionOptions = builder
  .objectRef<IFreeTextQuestionOptions>('FreeTextQuestionOptions')
  .implement({
    fields: (t) => ({
      hasSampleSolution: t.exposeBoolean('hasSampleSolution', {
        nullable: true,
      }),
      hasAnswerFeedbacks: t.exposeBoolean('hasAnswerFeedbacks', {
        nullable: true,
      }),
      restrictions: t.expose('restrictions', {
        type: FreeTextRestrictions,
        nullable: true,
      }),
      solutions: t.exposeStringList('solutions', { nullable: true }),
    }),
  })
// #endregion

// ----- ELEMENT DATA INTERFACE -----
// #region
const sharedElementData = (t: any) => ({
  id: t.exposeID('id'),
  elementId: t.exposeInt('elementId'),
  name: t.exposeString('name'),
  type: t.expose('type', { type: ElementType }),
  content: t.exposeString('content'),
  explanation: t.exposeString('explanation', { nullable: true }),
  pointsMultiplier: t.exposeInt('pointsMultiplier'),
})

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

export interface IChoicesElementData extends BaseElementData {
  options: IChoiceQuestionOptions
}
export const ChoicesElementData = builder
  .objectRef<IChoicesElementData>('ChoicesElementData')
  .implement({
    fields: (t) => ({
      ...sharedElementData(t),
      options: t.expose('options', { type: ChoiceQuestionOptions }),
    }),
  })

export interface INumericalElementData extends BaseElementData {
  options: INumericalQuestionOptions
}
export const NumericalElementData = builder
  .objectRef<INumericalElementData>('NumericalElementData')
  .implement({
    fields: (t) => ({
      ...sharedElementData(t),
      options: t.expose('options', { type: NumericalQuestionOptions }),
    }),
  })

export interface IFreeTextElementData extends BaseElementData {
  options: IFreeTextQuestionOptions
}
export const FreeTextElementData = builder
  .objectRef<IFreeTextElementData>('FreeTextElementData')
  .implement({
    fields: (t) => ({
      ...sharedElementData(t),
      options: t.expose('options', { type: FreeTextQuestionOptions }),
    }),
  })

export interface IFlashcardElementData extends BaseElementData {}
export const FlashcardElementData = builder
  .objectRef<IFlashcardElementData>('FlashcardElementData')
  .implement({
    fields: (t) => ({
      ...sharedElementData(t),
    }),
  })

export interface IContentElementData extends BaseElementData {}
export const ContentElementData = builder
  .objectRef<IContentElementData>('ContentElementData')
  .implement({
    fields: (t) => ({
      ...sharedElementData(t),
    }),
  })

export const ElementData = builder.unionType('ElementData', {
  types: [
    ChoicesElementData,
    NumericalElementData,
    FreeTextElementData,
    FlashcardElementData,
    ContentElementData,
  ],
  resolveType: (element) => {
    switch (element.type) {
      case DB.ElementType.SC:
      case DB.ElementType.MC:
      case DB.ElementType.KPRIM:
        return ChoicesElementData
      case DB.ElementType.NUMERICAL:
        return NumericalElementData
      case DB.ElementType.FREE_TEXT:
        return FreeTextElementData
      case DB.ElementType.FLASHCARD:
        return FlashcardElementData
      case DB.ElementType.CONTENT:
        return ContentElementData
    }
  },
})
// #endregion
