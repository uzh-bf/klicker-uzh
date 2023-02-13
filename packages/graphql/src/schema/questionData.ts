import * as DB from '@klicker-uzh/prisma'
import builder from '../builder'

// ----- QUESTION DATA INTERFACE -----
export interface BaseQuestionData {
  id: number
  name: string
  type: string
  content: string
  pointsMultiplier: number
}
export const QuestionDataRef =
  builder.interfaceRef<BaseQuestionData>('QuestionData')
export const QuestionData = QuestionDataRef.implement({
  fields: (t) => ({
    id: t.exposeInt('id'),
    name: t.exposeString('name'),
    type: t.exposeString('type'),
    content: t.exposeString('content'),
    pointsMultiplier: t.exposeInt('pointsMultiplier'),
  }),
  resolveType(value) {
    switch (value.type) {
      case DB.QuestionType.SC:
      case DB.QuestionType.MC:
      case DB.QuestionType.KPRIM:
        return 'ChoicesQuestionData'
      case DB.QuestionType.NUMERICAL:
        return 'NumericalQuestionData'
      case DB.QuestionType.FREE_TEXT:
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
  choices: IChoice[]
}
export const ChoiceQuestionOptions = builder
  .objectRef<IChoiceQuestionOptions>('ChoiceQuestionOptions')
  .implement({
    fields: (t) => ({
      choices: t.expose('choices', { type: [Choice] }),
    }),
  })

export interface IChoicesQuestionData extends BaseQuestionData {
  options: IChoiceQuestionOptions
}
export const ChoicesQuestionData = builder
  .objectRef<IChoicesQuestionData>('ChoicesQuestionData')
  .implement({
    interfaces: [QuestionData],
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
  accuracy?: number
  placeholder?: string
  unit?: string
  restrictions: INumericalRestrictions
  solutionRanges: INumericalSolutionRange[]
}
export const NumericalQuestionOptions = builder
  .objectRef<INumericalQuestionOptions>('NumericalQuestionOptions')
  .implement({
    fields: (t) => ({
      accuracy: t.exposeInt('accuracy', { nullable: true }),
      placeholder: t.exposeString('placeholder', { nullable: true }),
      unit: t.exposeString('unit', { nullable: true }),
      restrictions: t.expose('restrictions', {
        type: NumericalRestrictions,
      }),
      solutionRanges: t.expose('solutionRanges', {
        type: [NumericalSolutionRange],
      }),
    }),
  })

export interface INumericalQuestionData extends BaseQuestionData {
  options: INumericalQuestionOptions
}
export const NumericalQuestionData = builder
  .objectRef<INumericalQuestionData>('NumericalQuestionData')
  .implement({
    interfaces: [QuestionData],
    fields: (t) => ({
      options: t.expose('options', { type: NumericalQuestionOptions }),
    }),
  })

// ----- FREE-TEXT QUESTIONS -----
export interface IFreeTextRestrictions {
  maxLength?: number
}
export const FreeTextRestrictions = builder
  .objectRef<IFreeTextRestrictions>('FreeTextRestrictions')
  .implement({
    fields: (t) => ({
      maxLength: t.exposeInt('maxLength', { nullable: true }),
    }),
  })

export interface IFreeTextQuestionOptions {
  restrictions: IFreeTextRestrictions
  solutions: string[]
}
export const FreeTextQuestionOptions = builder
  .objectRef<IFreeTextQuestionOptions>('FreeTextQuestionOptions')
  .implement({
    fields: (t) => ({
      restrictions: t.expose('restrictions', { type: FreeTextRestrictions }),
      solutions: t.exposeStringList('solutions'),
    }),
  })

export interface IFreeTextQuestionData extends BaseQuestionData {
  options: IFreeTextQuestionOptions
}
export const FreeTextQuestionData = builder
  .objectRef<IFreeTextQuestionData>('FreeTextQuestionData')
  .implement({
    interfaces: [QuestionData],
    fields: (t) => ({
      options: t.expose('options', { type: FreeTextQuestionOptions }),
    }),
  })
