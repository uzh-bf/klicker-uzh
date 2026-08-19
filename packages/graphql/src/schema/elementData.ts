import * as DB from '@klicker-uzh/prisma/client'
import {
  type BaseElementData,
  type CaseStudyCaseCriterionSolution as CaseStudyCaseCriterionSolutionType,
  type CaseStudyCaseSolution as CaseStudyCaseSolutionType,
  type CaseStudyCase as CaseStudyCaseType,
  type CaseStudyCriterionLabels as CaseStudyCriterionLabelsType,
  type CaseStudyCriterion as CaseStudyCriterionType,
  type Choice as ChoiceType,
  DisplayMode,
  type ElementInstanceOptions as ElementInstanceOptionsType,
  type ElementOptionsAnswerCollectionEntry as ElementOptionsAnswerCollectionEntryType,
  type ElementOptionsAnswerCollection as ElementOptionsAnswerCollectionType,
  type ElementOptionsCaseStudy as ElementOptionsCaseStudyType,
  type ElementOptionsChoices as ElementOptionsChoicesType,
  type ElementOptionsFreeText as ElementOptionsFreeTextType,
  type ElementOptionsNumerical as ElementOptionsNumericalType,
  type ElementOptionsSelection as ElementOptionsSelectionType,
  type FreeTextRestrictions as FreeTextRestrictionsType,
  type NumericalRestrictions as NumericalRestrictionsType,
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

export function semanticEvaluationForViewer(
  options: ElementOptionsFreeTextType,
  role: DB.UserRole | undefined
) {
  return role === DB.UserRole.USER || role === DB.UserRole.ADMIN
    ? options.semanticEvaluation
    : null
}

function isAuthoringRole(role: DB.UserRole | undefined) {
  return role === DB.UserRole.USER || role === DB.UserRole.ADMIN
}

export function freeTextSolutionsForViewer(
  options: ElementOptionsFreeTextType,
  role: DB.UserRole | undefined
) {
  return options.semanticEvaluation && !isAuthoringRole(role)
    ? null
    : options.solutions
}

export function freeTextExplanationForViewer(
  data: IFreeTextElementData,
  role: DB.UserRole | undefined
) {
  return data.options.semanticEvaluation && !isAuthoringRole(role)
    ? null
    : data.explanation
}

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
      solutions: t.field({
        type: ['String'],
        nullable: true,
        resolve: (options, _, ctx) =>
          freeTextSolutionsForViewer(options, ctx.user?.role),
      }),
      semanticEvaluation: t.field({
        type: 'Json',
        nullable: true,
        resolve: (options, _, ctx) =>
          semanticEvaluationForViewer(options, ctx.user?.role) as never,
      }),
    }),
  })

export const ElementOptionsAnswerCollectionEntry = builder
  .objectRef<ElementOptionsAnswerCollectionEntryType>(
    'ElementOptionsAnswerCollectionEntry'
  )
  .implement({
    fields: (t) => ({
      id: t.exposeInt('id'),
      value: t.exposeString('value'),
    }),
  })

export const ElementOptionsAnswerCollection = builder
  .objectRef<ElementOptionsAnswerCollectionType>(
    'ElementOptionsAnswerCollection'
  )
  .implement({
    fields: (t) => ({
      id: t.exposeInt('id'),
      entries: t.expose('entries', {
        type: [ElementOptionsAnswerCollectionEntry],
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
      numberOfInputs: t.exposeInt('numberOfInputs', { nullable: true }),
      answerCollection: t.expose('answerCollection', {
        type: ElementOptionsAnswerCollection,
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

export const CaseStudyCriterionLabels = builder
  .objectRef<CaseStudyCriterionLabelsType>('CaseStudyCriterionLabels')
  .implement({
    fields: (t) => ({
      min: t.exposeString('min'),
      mid: t.exposeString('mid', { nullable: true }),
      max: t.exposeString('max'),
    }),
  })

export const CaseStudyCriterion = builder
  .objectRef<CaseStudyCriterionType>('CaseStudyCriterion')
  .implement({
    fields: (t) => ({
      id: t.exposeString('id'),
      name: t.exposeString('name'),
      order: t.exposeInt('order', { nullable: true }),
      min: t.exposeFloat('min'),
      max: t.exposeFloat('max'),
      step: t.exposeFloat('step'),
      unit: t.exposeString('unit', { nullable: true }),
      labels: t.expose('labels', {
        type: CaseStudyCriterionLabels,
        nullable: true,
      }),
    }),
  })

export const CaseStudyCaseCriterionSolution = builder
  .objectRef<CaseStudyCaseCriterionSolutionType>(
    'CaseStudyCaseCriterionSolution'
  )
  .implement({
    fields: (t) => ({
      criterionId: t.exposeString('criterionId'),
      min: t.exposeFloat('min'),
      max: t.exposeFloat('max'),
    }),
  })

export const CaseStudyCaseSolution = builder
  .objectRef<CaseStudyCaseSolutionType>('CaseStudyCaseSolution')
  .implement({
    fields: (t) => ({
      itemId: t.exposeInt('itemId'),
      criteriaSolutions: t.expose('criteriaSolutions', {
        type: [CaseStudyCaseCriterionSolution],
      }),
    }),
  })

export const CaseStudyCase = builder
  .objectRef<CaseStudyCaseType>('CaseStudyCase')
  .implement({
    fields: (t) => ({
      id: t.exposeString('id'),
      title: t.exposeString('title'),
      description: t.exposeString('description'),
      order: t.exposeInt('order', { nullable: true }),
      solutions: t.expose('solutions', {
        type: [CaseStudyCaseSolution],
        nullable: true,
      }),
    }),
  })

export const CaseStudyElementOptions = builder
  .objectRef<ElementOptionsCaseStudyType>('CaseStudyElementOptions')
  .implement({
    fields: (t) => ({
      hasSampleSolution: t.exposeBoolean('hasSampleSolution', {
        nullable: true,
      }),
      // element fetching only
      answerCollectionId: t.exposeInt('answerCollectionId', { nullable: true }),
      // element fetching only
      collectionItemIds: t.exposeIntList('collectionItemIds', {
        nullable: true,
      }),
      // element instance only
      items: t.expose('items', {
        type: [ElementOptionsAnswerCollectionEntry],
        nullable: true,
      }),
      criteria: t.expose('criteria', {
        type: [CaseStudyCriterion],
      }),
      cases: t.expose('cases', { type: [CaseStudyCase] }),
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
  basePoints: t.exposeBoolean('basePoints'),
  pointsMultiplier: t.exposeInt('pointsMultiplier'),
})

export const ElementInstanceOptions = builder
  .objectRef<ElementInstanceOptionsType>('ElementInstanceOptions')
  .implement({
    fields: (t) => ({
      basePoints: t.exposeBoolean('basePoints', { nullable: true }),
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
      explanation: t.field({
        type: 'String',
        nullable: true,
        resolve: (data, _, ctx) =>
          freeTextExplanationForViewer(data, ctx.user?.role),
      }),
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

export interface ICaseStudyElementData extends BaseElementData {
  options: ElementOptionsCaseStudyType
}
export const CaseStudyElementData = builder
  .objectRef<ICaseStudyElementData>('CaseStudyElementData')
  .implement({
    fields: (t) => ({
      ...sharedElementData(t),
      options: t.expose('options', { type: CaseStudyElementOptions }),
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
    CaseStudyElementData,
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
      case DB.ElementType.CASE_STUDY:
        return CaseStudyElementData
      case DB.ElementType.FLASHCARD:
        return FlashcardElementData
      case DB.ElementType.CONTENT:
        return ContentElementData
    }
  },
})
// #endregion
