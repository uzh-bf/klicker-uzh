import * as DB from '@klicker-uzh/prisma'
import {
  type BaseQuestionData,
  type Choice as ChoiceType,
  type NumericalSolutionRange as NumericalSolutionRangeType,
  DisplayMode,
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
