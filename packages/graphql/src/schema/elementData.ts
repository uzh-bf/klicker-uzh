import * as DB from '@klicker-uzh/prisma'
import {
  DisplayMode,
  type BaseElementData,
  type Choice as ChoiceType,
  type ElementOptionsChoices as ElementOptionsChoicesType,
  type ElementOptionsFreeText as ElementOptionsFreeTextType,
  type ElementOptionsNumerical as ElementOptionsNumericalType,
  type ElementOptionsSelection as ElementOptionsSelectionType,
  type FreeTextRestrictions as FreeTextRestrictionsType,
  type NumericalRestrictions as NumericalRestrictionsType,
  type NumericalSolutionRange as NumericalSolutionRangeType,
  type SelectionAnswerCollectionEntry as SelectionAnswerCollectionEntryType,
  type SelectionAnswerCollection as SelectionAnswerCollectionType,
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

// ----- ELEMENT OPTIONS -----
// #region
export const Choice = builder.objectRef<ChoiceType>('Choice').implement({
  fields: (t) => ({
    ix: t.exposeInt('ix'),
    correct: t.exposeBoolean('correct', { nullable: true }),
    feedback: t.exposeString('feedback', { nullable: true }),
    value: t.exposeString('value'),
  }),
})

export const ChoiceElementOptions = builder
  .objectRef<ElementOptionsChoicesType>('ChoiceElementOptions')
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

export const NumericalRestrictions = builder
  .objectRef<NumericalRestrictionsType>('NumericalRestrictions')
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

export const NumericalElementOptions = builder
  .objectRef<ElementOptionsNumericalType>('NumericalElementOptions')
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
      exactSolutions: t.exposeFloatList('exactSolutions', { nullable: true }),
    }),
  })

export const FreeTextRestrictions = builder
  .objectRef<FreeTextRestrictionsType>('FreeTextRestrictions')
  .implement({
    fields: (t) => ({
      maxLength: t.exposeInt('maxLength', { nullable: true }),
    }),
  })

export const FreeTextElementOptions = builder
  .objectRef<ElementOptionsFreeTextType>('FreeTextElementOptions')
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

export const SelectionAnswerCollectionEntry = builder
  .objectRef<SelectionAnswerCollectionEntryType>(
    'SelectionAnswerCollectionEntry'
  )
  .implement({
    fields: (t) => ({
      id: t.exposeInt('id'),
      value: t.exposeString('value'),
    }),
  })

export const SelectionAnswerCollection = builder
  .objectRef<SelectionAnswerCollectionType>('SelectionAnswerCollection')
  .implement({
    fields: (t) => ({
      id: t.exposeInt('id'),
      entries: t.expose('entries', {
        type: [SelectionAnswerCollectionEntry],
        nullable: true,
      }),
    }),
  })

export const SelectionElementOptions = builder
  .objectRef<ElementOptionsSelectionType>('SelectionElementOptions')
  .implement({
    fields: (t) => ({
      hasSampleSolution: t.exposeBoolean('hasSampleSolution', {
        nullable: true,
      }),
      hasAnswerFeedbacks: t.exposeBoolean('hasAnswerFeedbacks', {
        nullable: true,
      }),
      numberOfInputs: t.exposeInt('numberOfInputs', { nullable: true }),
      answerCollection: t.expose('answerCollection', {
        type: SelectionAnswerCollection,
        nullable: true,
      }),
      answerCollectionSolutionIds: t.exposeIntList(
        'answerCollectionSolutionIds',
        {
          nullable: true,
        }
      ),
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
  options: ElementOptionsChoicesType
}
export const ChoicesElementData = builder
  .objectRef<IChoicesElementData>('ChoicesElementData')
  .implement({
    fields: (t) => ({
      ...sharedElementData(t),
      options: t.expose('options', { type: ChoiceElementOptions }),
    }),
  })

export interface INumericalElementData extends BaseElementData {
  options: ElementOptionsNumericalType
}
export const NumericalElementData = builder
  .objectRef<INumericalElementData>('NumericalElementData')
  .implement({
    fields: (t) => ({
      ...sharedElementData(t),
      options: t.expose('options', { type: NumericalElementOptions }),
    }),
  })

export interface IFreeTextElementData extends BaseElementData {
  options: ElementOptionsFreeTextType
}
export const FreeTextElementData = builder
  .objectRef<IFreeTextElementData>('FreeTextElementData')
  .implement({
    fields: (t) => ({
      ...sharedElementData(t),
      options: t.expose('options', { type: FreeTextElementOptions }),
    }),
  })

export interface ISelectionElementData extends BaseElementData {
  options: ElementOptionsSelectionType
}
export const SelectionElementData = builder
  .objectRef<ISelectionElementData>('SelectionElementData')
  .implement({
    fields: (t) => ({
      ...sharedElementData(t),
      options: t.expose('options', { type: SelectionElementOptions }),
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
    SelectionElementData,
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
      case DB.ElementType.SELECTION:
        return SelectionElementData
      case DB.ElementType.FLASHCARD:
        return FlashcardElementData
      case DB.ElementType.CONTENT:
        return ContentElementData
    }
  },
})
// #endregion
