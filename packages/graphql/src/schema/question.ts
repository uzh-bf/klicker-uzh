import * as DB from '@klicker-uzh/prisma'
import type {
  IInstanceEvaluationChoices,
  IInstanceEvaluationContent,
  IInstanceEvaluationFlashcard,
  IInstanceEvaluationFreeText,
  IInstanceEvaluationNumerical,
  IQuestionFeedback,
} from '@klicker-uzh/types'
import builder from '../builder.js'
import { ElementFeedbackRef } from './analytics.js'
import { ElementData, ElementInstanceOptions } from './elementData.js'
import {
  ChoiceQuestionOptions,
  ChoicesQuestionData,
  ContentQuestionData,
  ElementDisplayMode,
  ElementInstanceType,
  ElementStatus,
  ElementType,
  FlashcardQuestionData,
  FreeTextQuestionData,
  FreeTextQuestionOptions,
  NumericalQuestionData,
  NumericalQuestionOptions,
  NumericalSolutionRange,
  QuestionData,
  type IChoiceQuestionOptions,
  type IChoicesQuestionData,
  type IContentQuestionData,
  type IFlashcardQuestionData,
  type IFreeTextQuestionData,
  type IFreeTextQuestionOptions,
  type INumericalQuestionData,
  type INumericalQuestionOptions,
} from './questionData.js'
import {
  SingleQuestionResponseChoices,
  SingleQuestionResponseContent,
  SingleQuestionResponseFlashcard,
  SingleQuestionResponseValue,
} from './session.js'

export const ChoiceInput = builder.inputType('ChoiceInput', {
  fields: (t) => ({
    ix: t.int({ required: true }),
    value: t.string({ required: true }),
    correct: t.boolean({ required: false }),
    feedback: t.string({ required: false }),
  }),
})

export const OptionsChoicesInput = builder.inputType('OptionsChoicesInput', {
  fields: (t) => ({
    displayMode: t.field({ required: false, type: ElementDisplayMode }),
    hasSampleSolution: t.boolean({ required: false }),
    hasAnswerFeedbacks: t.boolean({ required: false }),
    choices: t.field({
      type: [ChoiceInput],
    }),
  }),
})

export const NumericalRestrictionsInput = builder.inputType(
  'NumericalRestrictionsInput',
  {
    fields: (t) => ({
      hasSampleSolution: t.boolean({ required: false }),
      hasAnswerFeedbacks: t.boolean({ required: false }),
      min: t.float({ required: false }),
      max: t.float({ required: false }),
    }),
  }
)

export const SolutionRangeInput = builder.inputType('SolutionRangeInput', {
  fields: (t) => ({
    min: t.float({ required: false }),
    max: t.float({ required: false }),
  }),
})

export const OptionsNumericalInput = builder.inputType(
  'OptionsNumericalInput',
  {
    fields: (t) => ({
      hasSampleSolution: t.boolean({ required: false }),
      hasAnswerFeedbacks: t.boolean({ required: false }),
      accuracy: t.int({ required: false }),
      unit: t.string({ required: false }),
      restrictions: t.field({
        type: NumericalRestrictionsInput,
        required: false,
      }),
      solutionRanges: t.field({
        type: [SolutionRangeInput],
        required: false,
      }),
      feedback: t.string({ required: false }),
    }),
  }
)

export const FreeTextRestrictionsInput = builder.inputType(
  'FreeTextRestrictionsInput',
  {
    fields: (t) => ({
      maxLength: t.int({ required: false }),
      minLength: t.int({ required: false }),
      pattern: t.string({ required: false }),
    }),
  }
)

export const OptionsFreeTextInput = builder.inputType('OptionsFreeTextInput', {
  fields: (t) => ({
    hasSampleSolution: t.boolean({ required: false }),
    hasAnswerFeedbacks: t.boolean({ required: false }),
    placeholder: t.string({ required: false }),
    restrictions: t.field({
      type: FreeTextRestrictionsInput,
      required: false,
    }),
    solutions: t.stringList({ required: false }),
    feedback: t.string({ required: false }),
  }),
})

// TODO: remove after migration to new element structure
export const ResponseInput = builder.inputType('ResponseInput', {
  // directives: {
  //   oneOf: {},
  // },
  fields: (t) => ({
    choices: t.intList({ required: false }),
    value: t.string({ required: false }),
  }),
})

// ----- INSTANCE EVALUATION INTERFACE -----
export const QuestionFeedback = builder
  .objectRef<IQuestionFeedback>('QuestionFeedback')
  .implement({
    fields: (t) => ({
      ix: t.exposeInt('ix'),
      feedback: t.exposeString('feedback', { nullable: true }),
      correct: t.exposeBoolean('correct', { nullable: true }),
      value: t.exposeString('value'),
    }),
  })

function sharedEvaluationProps(t) {
  return {
    instanceId: t.exposeInt('instanceId'),
    elementType: t.expose('elementType', { type: ElementType }),

    score: t.exposeFloat('score'),
    xp: t.exposeInt('xp', { nullable: true }),
    pointsMultiplier: t.exposeInt('pointsMultiplier'),
    explanation: t.exposeString('explanation', { nullable: true }),
    feedbacks: t.expose('feedbacks', {
      type: [QuestionFeedback],
      nullable: true,
    }),

    numAnswers: t.exposeInt('numAnswers', { nullable: true }),
    pointsAwarded: t.exposeFloat('pointsAwarded', { nullable: true }),
    percentile: t.exposeFloat('percentile', { nullable: true }),
    newPointsFrom: t.expose('newPointsFrom', {
      type: 'Date',
      nullable: true,
    }),
    xpAwarded: t.exposeInt('xpAwarded', { nullable: true }),
    newXpFrom: t.expose('newXpFrom', {
      type: 'Date',
      nullable: true,
    }),
    correctness: t.exposeFloat('correctness', { nullable: true }),
  }
}

export const ChoicesInstanceEvaluation = builder
  .objectRef<IInstanceEvaluationChoices>('ChoicesInstanceEvaluation')
  .implement({
    fields: (t) => ({
      ...sharedEvaluationProps(t),
      // ? differing number of keys - no graphql representation available
      choices: t.expose('choices', { type: 'Json', nullable: true }),
      lastResponse: t.expose('lastResponse', {
        type: SingleQuestionResponseChoices,
        nullable: true,
      }),
    }),
  })

export const NumericalInstanceEvaluation = builder
  .objectRef<IInstanceEvaluationNumerical>('NumericalInstanceEvaluation')
  .implement({
    fields: (t) => ({
      ...sharedEvaluationProps(t),
      // ? differing number of keys - no graphql representation available
      answers: t.expose('answers', {
        type: 'Json',
        nullable: true,
      }),
      solutionRanges: t.expose('solutionRanges', {
        type: [NumericalSolutionRange],
        nullable: true,
      }),
      lastResponse: t.expose('lastResponse', {
        type: SingleQuestionResponseValue,
        nullable: true,
      }),
    }),
  })

export const FreeTextInstanceEvaluation = builder
  .objectRef<IInstanceEvaluationFreeText>('FreeTextInstanceEvaluation')
  .implement({
    fields: (t) => ({
      ...sharedEvaluationProps(t),
      // ? differing number of keys - no graphql representation available
      answers: t.expose('answers', {
        type: 'Json',
        nullable: true,
      }),
      solutions: t.exposeStringList('solutions', { nullable: true }),
      lastResponse: t.expose('lastResponse', {
        type: SingleQuestionResponseValue,
        nullable: true,
      }),
    }),
  })

export const FlashcardInstanceEvaluation = builder
  .objectRef<IInstanceEvaluationFlashcard>('FlashcardInstanceEvaluation')
  .implement({
    fields: (t) => ({
      ...sharedEvaluationProps(t),
      lastResponse: t.expose('lastResponse', {
        type: SingleQuestionResponseFlashcard,
        nullable: true,
      }),
    }),
  })

export const ContentInstanceEvaluation = builder
  .objectRef<IInstanceEvaluationContent>('ContentInstanceEvaluation')
  .implement({
    fields: (t) => ({
      ...sharedEvaluationProps(t),
      lastResponse: t.expose('lastResponse', {
        type: SingleQuestionResponseContent,
        nullable: true,
      }),
    }),
  })

export const InstanceEvaluation = builder.unionType('InstanceEvaluation', {
  types: [
    ChoicesInstanceEvaluation,
    NumericalInstanceEvaluation,
    FreeTextInstanceEvaluation,
    FlashcardInstanceEvaluation,
    ContentInstanceEvaluation,
  ],
  resolveType: (element) => {
    switch (element.elementType) {
      case DB.ElementType.SC:
      case DB.ElementType.MC:
      case DB.ElementType.KPRIM:
        return ChoicesInstanceEvaluation
      case DB.ElementType.NUMERICAL:
        return NumericalInstanceEvaluation
      case DB.ElementType.FREE_TEXT:
        return FreeTextInstanceEvaluation
      case DB.ElementType.FLASHCARD:
        return FlashcardInstanceEvaluation
      case DB.ElementType.CONTENT:
        return ContentInstanceEvaluation
    }
  },
})

// ----- ELEMENT INTERFACE -----
// #region
const sharedElementProps = (t: any) => ({
  id: t.exposeInt('id'),

  version: t.exposeInt('version'),
  name: t.exposeString('name'),
  status: t.expose('status', { type: ElementStatus }),
  type: t.expose('type', { type: ElementType }),
  content: t.exposeString('content'),
  explanation: t.exposeString('explanation', { nullable: true }),

  pointsMultiplier: t.exposeInt('pointsMultiplier'),

  questionData: t.field({
    type: QuestionData,
    resolve: (q) => q.questionData,
    nullable: true,
  }),

  isArchived: t.exposeBoolean('isArchived'),
  isDeleted: t.exposeBoolean('isDeleted'),

  createdAt: t.expose('createdAt', { type: 'Date' }),
  updatedAt: t.expose('updatedAt', { type: 'Date' }),

  tags: t.expose('tags', {
    type: [TagRef],
    nullable: true,
  }),
})

interface IBaseElementProps extends Omit<DB.Element, 'ownerId' | 'originalId'> {
  tags?: ITag[] | null
}
export interface IChoicesElement extends IBaseElementProps {
  options: IChoiceQuestionOptions
  questionData?: IChoicesQuestionData | null
}
export const ChoicesElement = builder
  .objectRef<IChoicesElement>('ChoicesElement')
  .implement({
    fields: (t) => ({
      ...sharedElementProps(t),
      options: t.expose('options', { type: ChoiceQuestionOptions }),
      questionData: t.expose('questionData', {
        type: ChoicesQuestionData,
        nullable: true,
      }),
    }),
  })

export interface INumericalElement extends IBaseElementProps {
  options: INumericalQuestionOptions
  questionData?: INumericalQuestionData | null
}
export const NumericalElement = builder
  .objectRef<INumericalElement>('NumericalElement')
  .implement({
    fields: (t) => ({
      ...sharedElementProps(t),
      options: t.expose('options', { type: NumericalQuestionOptions }),
      questionData: t.expose('questionData', {
        type: NumericalQuestionData,
        nullable: true,
      }),
    }),
  })

export interface IFreeTextElement extends IBaseElementProps {
  options: IFreeTextQuestionOptions
  questionData?: IFreeTextQuestionData | null
}
export const FreeTextElement = builder
  .objectRef<IFreeTextElement>('FreeTextElement')
  .implement({
    fields: (t) => ({
      ...sharedElementProps(t),
      options: t.expose('options', { type: FreeTextQuestionOptions }),
      questionData: t.expose('questionData', {
        type: FreeTextQuestionData,
        nullable: true,
      }),
    }),
  })

export interface IFlashcardElement extends IBaseElementProps {
  questionData?: IFlashcardQuestionData | null
}
export const FlashcardElement = builder
  .objectRef<IFlashcardElement>('FlashcardElement')
  .implement({
    fields: (t) => ({
      ...sharedElementProps(t),
      questionData: t.expose('questionData', {
        type: FlashcardQuestionData,
        nullable: true,
      }),
    }),
  })

export interface IContentElement extends IBaseElementProps {
  questionData?: IContentQuestionData | null
}
export const ContentElement = builder
  .objectRef<IContentElement>('ContentElement')
  .implement({
    fields: (t) => ({
      ...sharedElementProps(t),
      questionData: t.expose('questionData', {
        type: ContentQuestionData,
        nullable: true,
      }),
    }),
  })

export const Element = builder.unionType('Element', {
  types: [
    ChoicesElement,
    NumericalElement,
    FreeTextElement,
    FlashcardElement,
    ContentElement,
  ],
  resolveType: (element) => {
    switch (element.type) {
      case DB.ElementType.SC:
      case DB.ElementType.MC:
      case DB.ElementType.KPRIM:
        return ChoicesElement
      case DB.ElementType.NUMERICAL:
        return NumericalElement
      case DB.ElementType.FREE_TEXT:
        return FreeTextElement
      case DB.ElementType.FLASHCARD:
        return FlashcardElement
      case DB.ElementType.CONTENT:
        return ContentElement
    }
  },
})
// #endregion

export interface IQuestionOrElementInstance {
  questionInstance?: DB.QuestionInstance | null
  elementInstance?: DB.ElementInstance | null
}
export const QuestionOrElementInstanceRef =
  builder.objectRef<IQuestionOrElementInstance>('QuestionOrElementInstance')
export const QuestionOrElementInstance = QuestionOrElementInstanceRef.implement(
  {
    fields: (t) => ({
      questionInstance: t.expose('questionInstance', {
        type: QuestionInstanceRef,
        nullable: true,
      }),
      elementInstance: t.expose('elementInstance', {
        type: ElementInstanceRef,
        nullable: true,
      }),
    }),
  }
)

export const QuestionInstanceRef =
  builder.objectRef<DB.QuestionInstance>('QuestionInstance')
export const QuestionInstance = QuestionInstanceRef.implement({
  fields: (t) => ({
    id: t.exposeInt('id'),
    pointsMultiplier: t.exposeInt('pointsMultiplier', { nullable: true }),

    questionData: t.field({
      type: QuestionData,
      resolve: (q) => q.questionData,
      nullable: true,
    }),
  }),
})

export interface IElementInstance extends DB.ElementInstance {
  feedbacks?: DB.ElementFeedback[] | null
}
export const ElementInstanceRef =
  builder.objectRef<IElementInstance>('ElementInstance')
export const ElementInstance = ElementInstanceRef.implement({
  fields: (t) => ({
    id: t.exposeInt('id'),

    type: t.expose('type', { type: ElementInstanceType }),
    elementType: t.expose('elementType', { type: ElementType }),

    elementData: t.field({
      type: ElementData,
      resolve: (q) => q.elementData,
    }),

    options: t.expose('options', {
      type: ElementInstanceOptions,
      nullable: true,
    }),

    feedbacks: t.expose('feedbacks', {
      type: [ElementFeedbackRef],
      nullable: true,
    }),
  }),
})

export interface ITag
  extends Omit<DB.Tag, 'originalId' | 'ownerId' | 'createdAt' | 'updatedAt'> {}
export const TagRef = builder.objectRef<ITag>('Tag')
export const Tag = TagRef.implement({
  fields: (t) => ({
    id: t.exposeInt('id'),
    name: t.exposeString('name'),
    order: t.exposeInt('order'),
  }),
})
