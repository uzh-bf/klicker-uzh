import * as DB from '@klicker-uzh/prisma'
import builder from '../builder'
import { BaseElementData, DisplayMode } from '../types/app'

export const ElementType = builder.enumType('ElementType', {
  values: Object.values(DB.ElementType),
})

export const ElementInstanceType = builder.enumType('ElementInstanceType', {
  values: Object.values(DB.ElementInstanceType),
})

export const ElementDisplayMode = builder.enumType('ElementDisplayMode', {
  values: Object.values(DisplayMode),
})

// ----- QUESTION DATA INTERFACE -----
export const QuestionDataRef =
  builder.interfaceRef<BaseElementData>('QuestionData')
export const QuestionData = QuestionDataRef.implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    elementId: t.exposeInt('elementId', { nullable: true }),
    questionId: t.exposeInt('questionId', { nullable: true }),
    name: t.exposeString('name'),
    type: t.expose('type', { type: ElementType }),
    content: t.exposeString('content'),
    explanation: t.exposeString('explanation', { nullable: true }),
    pointsMultiplier: t.exposeInt('pointsMultiplier', { nullable: true }),
  }),
  resolveType(value) {
    switch (value.type) {
      case DB.ElementType.SC:
      case DB.ElementType.MC:
      case DB.ElementType.KPRIM:
        return 'ChoicesQuestionData'
      case DB.ElementType.NUMERICAL:
        return 'NumericalQuestionData'
      case DB.ElementType.FREE_TEXT:
        return 'FreeTextQuestionData'
      default:
        return null
    }
  },
})

// ----- CHOICE QUESTIONS -----
export interface IChoice {
  ix: number
  correct?: boolean
  feedback?: string
  value: string
}
export const Choice = builder.objectRef<IChoice>('Choice').implement({
  fields: (t) => ({
    ix: t.exposeInt('ix'),
    correct: t.exposeBoolean('correct', { nullable: true }),
    feedback: t.exposeString('feedback', { nullable: true }),
    value: t.exposeString('value'),
  }),
})

export interface IChoiceQuestionOptions {
  displayMode: DisplayMode
  hasSampleSolution: boolean
  hasAnswerFeedbacks: boolean
  choices: IChoice[]
}
export const ChoiceQuestionOptions = builder
  .objectRef<IChoiceQuestionOptions>('ChoiceQuestionOptions')
  .implement({
    fields: (t) => ({
      displayMode: t.expose('displayMode', { type: ElementDisplayMode }),
      hasSampleSolution: t.exposeBoolean('hasSampleSolution'),
      hasAnswerFeedbacks: t.exposeBoolean('hasAnswerFeedbacks'),
      choices: t.expose('choices', { type: [Choice] }),
    }),
  })

export interface IChoicesQuestionData extends BaseElementData {
  options: IChoiceQuestionOptions
}
export const ChoicesQuestionData = builder
  .objectRef<IChoicesQuestionData>('ChoicesQuestionData')
  .implement({
    interfaces: [QuestionDataRef],
    fields: (t) => ({
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

export interface INumericalSolutionRange {
  min?: number
  max?: number
}
export const NumericalSolutionRange = builder
  .objectRef<INumericalSolutionRange>('NumericalSolutionRange')
  .implement({
    fields: (t) => ({
      min: t.exposeFloat('min', { nullable: true }),
      max: t.exposeFloat('max', { nullable: true }),
    }),
  })

export interface INumericalQuestionOptions {
  hasSampleSolution: boolean
  hasAnswerFeedbacks: boolean
  accuracy?: number | null
  placeholder?: string | null
  unit?: string | null
  restrictions?: INumericalRestrictions | null
  solutionRanges?: INumericalSolutionRange[] | null
}
export const NumericalQuestionOptions = builder
  .objectRef<INumericalQuestionOptions>('NumericalQuestionOptions')
  .implement({
    fields: (t) => ({
      hasSampleSolution: t.exposeBoolean('hasSampleSolution'),
      hasAnswerFeedbacks: t.exposeBoolean('hasAnswerFeedbacks'),
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

export interface INumericalQuestionData extends BaseElementData {
  options: INumericalQuestionOptions
}
export const NumericalQuestionData = builder
  .objectRef<INumericalQuestionData>('NumericalQuestionData')
  .implement({
    interfaces: [QuestionDataRef],
    fields: (t) => ({
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
  hasSampleSolution: boolean
  hasAnswerFeedbacks: boolean
  restrictions?: IFreeTextRestrictions | null
  solutions?: string[] | null
}
export const FreeTextQuestionOptions = builder
  .objectRef<IFreeTextQuestionOptions>('FreeTextQuestionOptions')
  .implement({
    fields: (t) => ({
      hasSampleSolution: t.exposeBoolean('hasSampleSolution'),
      hasAnswerFeedbacks: t.exposeBoolean('hasAnswerFeedbacks'),
      restrictions: t.expose('restrictions', {
        type: FreeTextRestrictions,
        nullable: true,
      }),
      solutions: t.exposeStringList('solutions', { nullable: true }),
    }),
  })

export interface IFreeTextQuestionData extends BaseElementData {
  options: IFreeTextQuestionOptions
}
export const FreeTextQuestionData = builder
  .objectRef<IFreeTextQuestionData>('FreeTextQuestionData')
  .implement({
    interfaces: [QuestionDataRef],
    fields: (t) => ({
      options: t.expose('options', { type: FreeTextQuestionOptions }),
    }),
  })
