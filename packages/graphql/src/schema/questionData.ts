import * as DB from '@klicker-uzh/prisma'
import builder from '../builder'

// ----- QUESTION DATA INTERFACE -----
interface BaseQuestionData {
  id: number
  name: string
  type: string
  content: string
  pointsMultiplier: number
}

const QuestionDataRef = builder.interfaceRef<BaseQuestionData>('QuestionData')

export const QuestionData = builder.interfaceType(QuestionDataRef, {
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
interface Choice {
  ix: number
  correct?: boolean
  feedback?: string
  value: string
}

const ChoiceRef = builder.objectRef<Choice>('Choice')

const Choice = builder.objectType(ChoiceRef, {
  fields: (t) => ({
    ix: t.exposeInt('ix'),
    correct: t.exposeBoolean('correct', { nullable: true }),
    feedback: t.exposeString('feedback', { nullable: true }),
    value: t.exposeString('value'),
  }),
})

interface ChoiceQuestionOptions {
  choices: Choice[]
}

const ChoiceQuestionOptionsRef = builder.objectRef<ChoiceQuestionOptions>(
  'ChoiceQuestionOptions'
)

const ChoiceQuestionOptions = builder.objectType(ChoiceQuestionOptionsRef, {
  fields: (t) => ({
    choices: t.expose('choices', { type: [Choice] }),
  }),
})

interface ChoicesQuestionData extends BaseQuestionData {
  options: ChoiceQuestionOptions
}

const ChoicesQuestionDataRef = builder.objectRef<ChoicesQuestionData>(
  'ChoicesQuestionData'
)

const ChoicesQuestionData = builder.objectType(ChoicesQuestionDataRef, {
  interfaces: [QuestionData],
  fields: (t) => ({
    options: t.expose('options', { type: ChoiceQuestionOptionsRef }),
  }),
})

// ----- NUMERICAL QUESTIONS -----
interface NumericalRestrictions {
  min?: number
  max?: number
}

const NumericalRestrictionsRef = builder.objectRef<NumericalRestrictions>(
  'NumericalRestrictions'
)

const NumericalRestrictions = builder.objectType(NumericalRestrictionsRef, {
  fields: (t) => ({
    min: t.exposeInt('min', { nullable: true }),
    max: t.exposeInt('max', { nullable: true }),
  }),
})

interface NumericalSolutionRange {
  min?: number
  max?: number
}

const NumericalSolutionRangeRef = builder.objectRef<NumericalSolutionRange>(
  'NumericalSolutionRange'
)

const NumericalSolutionRange = builder.objectType(NumericalSolutionRangeRef, {
  fields: (t) => ({
    min: t.exposeInt('min', { nullable: true }),
    max: t.exposeInt('max', { nullable: true }),
  }),
})

interface NumericalQuestionOptions {
  accuracy?: number
  placeholder?: string
  unit?: string
  restrictions: NumericalRestrictions
  solutionRanges: NumericalSolutionRange[]
}

const NumericalQuestionOptionsRef = builder.objectRef<NumericalQuestionOptions>(
  'NumericalQuestionOptions'
)

const NumericalQuestionOptions = builder.objectType(
  NumericalQuestionOptionsRef,
  {
    fields: (t) => ({
      accuracy: t.exposeInt('accuracy', { nullable: true }),
      placeholder: t.exposeString('placeholder', { nullable: true }),
      unit: t.exposeString('unit', { nullable: true }),
      restrictions: t.expose('restrictions', { type: NumericalRestrictions }),
      solutionRanges: t.expose('solutionRanges', {
        type: [NumericalSolutionRange],
      }),
    }),
  }
)

interface NumericalQuestionData extends BaseQuestionData {
  options: NumericalQuestionOptions
}

const NumericalQuestionDataRef = builder.objectRef<NumericalQuestionData>(
  'NumericalQuestionData'
)

const NumericalQuestionData = builder.objectType(NumericalQuestionDataRef, {
  interfaces: [QuestionData],
  fields: (t) => ({
    options: t.expose('options', { type: NumericalQuestionOptionsRef }),
  }),
})

// ----- FREE-TEXT QUESTIONS -----
interface FreeTextRestrictions {
  maxLength?: number
}

const FreeTextRestrictionsRef = builder.objectRef<FreeTextRestrictions>(
  'FreeTextRestrictions'
)

const FreeTextRestrictions = builder.objectType(FreeTextRestrictionsRef, {
  fields: (t) => ({
    maxLength: t.exposeInt('maxLength', { nullable: true }),
  }),
})

interface FreeTextQuestionOptions {
  restrictions: FreeTextRestrictions
  solutions: string[]
}

const FreeTextQuestionOptionsRef = builder.objectRef<FreeTextQuestionOptions>(
  'FreeTextQuestionOptions'
)

const FreeTextQuestionOptions = builder.objectType(FreeTextQuestionOptionsRef, {
  fields: (t) => ({
    restrictions: t.expose('restrictions', { type: FreeTextRestrictions }),
    solutions: t.exposeStringList('solutions'),
  }),
})

interface FreeTextQuestionData extends BaseQuestionData {
  options: FreeTextQuestionOptions
}

const FreeTextQuestionDataRef = builder.objectRef<FreeTextQuestionData>(
  'FreeTextQuestionData'
)

const FreeTextQuestionData = builder.objectType(FreeTextQuestionDataRef, {
  interfaces: [QuestionData],
  fields: (t) => ({
    options: t.expose('options', { type: FreeTextQuestionOptionsRef }),
  }),
})
