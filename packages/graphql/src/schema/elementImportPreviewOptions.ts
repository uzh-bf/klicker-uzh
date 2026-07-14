import * as DB from '@klicker-uzh/prisma/client'
import type {
  ElementOptionsCaseStudy,
  ElementOptionsChoices,
  ElementOptionsFreeText,
  ElementOptionsNumerical,
  ElementOptionsSelection,
} from '@klicker-uzh/types'
import builder from '../builder.js'
import {
  CaseStudyCase,
  CaseStudyCriterion,
  Choice,
  ElementDisplayMode,
  ElementType,
  FreeTextRestrictions,
  NumericalRestrictions,
  NumericalSolutionRange,
} from './elementData.js'

type CanonicalChoiceOptions = Omit<
  ElementOptionsChoices,
  'hasSampleSolution' | 'hasAnswerFeedbacks'
> & {
  hasSampleSolution: boolean
  hasAnswerFeedbacks: boolean
}

type CanonicalNumericalOptions = Omit<
  ElementOptionsNumerical,
  'hasSampleSolution' | 'hasAnswerFeedbacks'
> & {
  hasSampleSolution: boolean
}

type CanonicalFreeTextOptions = Omit<
  ElementOptionsFreeText,
  'hasSampleSolution' | 'hasAnswerFeedbacks'
> & {
  hasSampleSolution: boolean
}

type CanonicalSelectionOptions = Omit<
  ElementOptionsSelection,
  | 'hasSampleSolution'
  | 'hasAnswerFeedbacks'
  | 'answerCollection'
  | 'answerCollectionSolutionIds'
> & {
  hasSampleSolution: boolean
}

type CanonicalCaseStudyOptions = Omit<
  ElementOptionsCaseStudy,
  | 'hasSampleSolution'
  | 'hasAnswerFeedbacks'
  | 'answerCollectionId'
  | 'collectionItemIds'
  | 'items'
> & {
  hasSampleSolution: boolean
}

type PreviewOptionsByElementType = {
  [DB.ElementType.SC]: CanonicalChoiceOptions
  [DB.ElementType.MC]: CanonicalChoiceOptions
  [DB.ElementType.KPRIM]: CanonicalChoiceOptions
  [DB.ElementType.NUMERICAL]: CanonicalNumericalOptions
  [DB.ElementType.FREE_TEXT]: CanonicalFreeTextOptions
  [DB.ElementType.CONTENT]: Record<string, never>
  [DB.ElementType.FLASHCARD]: Record<string, never>
  [DB.ElementType.SELECTION]: CanonicalSelectionOptions
  [DB.ElementType.CASE_STUDY]: CanonicalCaseStudyOptions
}

type PreviewOptionsWrapper<Type extends DB.ElementType> = {
  elementType: Type
  options: PreviewOptionsByElementType[Type]
}

export type ElementImportPackagePreviewOptionsValue = {
  [Type in DB.ElementType]: PreviewOptionsWrapper<Type>
}[DB.ElementType]

type ElementImportPackagePreviewOptionsSource = {
  type: DB.ElementType
  options: Record<string, unknown>
}

function wrapPreviewOptions<Type extends DB.ElementType>(
  elementType: Type,
  options: Record<string, unknown>
): PreviewOptionsWrapper<Type> {
  return {
    elementType,
    options: options as PreviewOptionsByElementType[Type],
  }
}

export function createElementImportPackagePreviewOptions(
  element: ElementImportPackagePreviewOptionsSource
): ElementImportPackagePreviewOptionsValue {
  switch (element.type) {
    case DB.ElementType.SC:
      return wrapPreviewOptions(DB.ElementType.SC, element.options)
    case DB.ElementType.MC:
      return wrapPreviewOptions(DB.ElementType.MC, element.options)
    case DB.ElementType.KPRIM:
      return wrapPreviewOptions(DB.ElementType.KPRIM, element.options)
    case DB.ElementType.NUMERICAL:
      return wrapPreviewOptions(DB.ElementType.NUMERICAL, element.options)
    case DB.ElementType.FREE_TEXT:
      return wrapPreviewOptions(DB.ElementType.FREE_TEXT, element.options)
    case DB.ElementType.CONTENT:
      return wrapPreviewOptions(DB.ElementType.CONTENT, element.options)
    case DB.ElementType.FLASHCARD:
      return wrapPreviewOptions(DB.ElementType.FLASHCARD, element.options)
    case DB.ElementType.SELECTION:
      return wrapPreviewOptions(DB.ElementType.SELECTION, element.options)
    case DB.ElementType.CASE_STUDY:
      return wrapPreviewOptions(DB.ElementType.CASE_STUDY, element.options)
  }
}

export const ElementImportPackagePreviewSCOptions = builder
  .objectRef<
    PreviewOptionsWrapper<typeof DB.ElementType.SC>
  >('ElementImportPackagePreviewSCOptions')
  .implement({
    fields: (t) => ({
      type: t.field({
        type: ElementType,
        resolve: ({ elementType }) => elementType,
      }),
      displayMode: t.field({
        type: ElementDisplayMode,
        resolve: ({ options }) => options.displayMode,
      }),
      hasSampleSolution: t.boolean({
        resolve: ({ options }) => options.hasSampleSolution,
      }),
      hasAnswerFeedbacks: t.boolean({
        resolve: ({ options }) => options.hasAnswerFeedbacks,
      }),
      choices: t.field({
        type: [Choice],
        resolve: ({ options }) => options.choices,
      }),
    }),
  })

export const ElementImportPackagePreviewMCOptions = builder
  .objectRef<
    PreviewOptionsWrapper<typeof DB.ElementType.MC>
  >('ElementImportPackagePreviewMCOptions')
  .implement({
    fields: (t) => ({
      type: t.field({
        type: ElementType,
        resolve: ({ elementType }) => elementType,
      }),
      displayMode: t.field({
        type: ElementDisplayMode,
        resolve: ({ options }) => options.displayMode,
      }),
      hasSampleSolution: t.boolean({
        resolve: ({ options }) => options.hasSampleSolution,
      }),
      hasAnswerFeedbacks: t.boolean({
        resolve: ({ options }) => options.hasAnswerFeedbacks,
      }),
      choices: t.field({
        type: [Choice],
        resolve: ({ options }) => options.choices,
      }),
    }),
  })

export const ElementImportPackagePreviewKPRIMOptions = builder
  .objectRef<
    PreviewOptionsWrapper<typeof DB.ElementType.KPRIM>
  >('ElementImportPackagePreviewKPRIMOptions')
  .implement({
    fields: (t) => ({
      type: t.field({
        type: ElementType,
        resolve: ({ elementType }) => elementType,
      }),
      displayMode: t.field({
        type: ElementDisplayMode,
        resolve: ({ options }) => options.displayMode,
      }),
      hasSampleSolution: t.boolean({
        resolve: ({ options }) => options.hasSampleSolution,
      }),
      hasAnswerFeedbacks: t.boolean({
        resolve: ({ options }) => options.hasAnswerFeedbacks,
      }),
      choices: t.field({
        type: [Choice],
        resolve: ({ options }) => options.choices,
      }),
    }),
  })

export const ElementImportPackagePreviewNumericalOptions = builder
  .objectRef<
    PreviewOptionsWrapper<typeof DB.ElementType.NUMERICAL>
  >('ElementImportPackagePreviewNumericalOptions')
  .implement({
    fields: (t) => ({
      type: t.field({
        type: ElementType,
        resolve: ({ elementType }) => elementType,
      }),
      hasSampleSolution: t.boolean({
        resolve: ({ options }) => options.hasSampleSolution,
      }),
      accuracy: t.int({
        nullable: true,
        resolve: ({ options }) => options.accuracy,
      }),
      placeholder: t.string({
        nullable: true,
        resolve: ({ options }) => options.placeholder,
      }),
      unit: t.string({
        nullable: true,
        resolve: ({ options }) => options.unit,
      }),
      restrictions: t.field({
        type: NumericalRestrictions,
        nullable: true,
        resolve: ({ options }) => options.restrictions,
      }),
      solutionRanges: t.field({
        type: [NumericalSolutionRange],
        nullable: true,
        resolve: ({ options }) => options.solutionRanges,
      }),
      exactSolutions: t.floatList({
        nullable: true,
        resolve: ({ options }) => options.exactSolutions,
      }),
    }),
  })

export const ElementImportPackagePreviewFreeTextOptions = builder
  .objectRef<
    PreviewOptionsWrapper<typeof DB.ElementType.FREE_TEXT>
  >('ElementImportPackagePreviewFreeTextOptions')
  .implement({
    fields: (t) => ({
      type: t.field({
        type: ElementType,
        resolve: ({ elementType }) => elementType,
      }),
      hasSampleSolution: t.boolean({
        resolve: ({ options }) => options.hasSampleSolution,
      }),
      restrictions: t.field({
        type: FreeTextRestrictions,
        nullable: true,
        resolve: ({ options }) => options.restrictions,
      }),
      solutions: t.stringList({
        nullable: true,
        resolve: ({ options }) => options.solutions,
      }),
    }),
  })

export const ElementImportPackagePreviewContentOptions = builder
  .objectRef<
    PreviewOptionsWrapper<typeof DB.ElementType.CONTENT>
  >('ElementImportPackagePreviewContentOptions')
  .implement({
    fields: (t) => ({
      type: t.field({
        type: ElementType,
        resolve: ({ elementType }) => elementType,
      }),
    }),
  })

export const ElementImportPackagePreviewFlashcardOptions = builder
  .objectRef<
    PreviewOptionsWrapper<typeof DB.ElementType.FLASHCARD>
  >('ElementImportPackagePreviewFlashcardOptions')
  .implement({
    fields: (t) => ({
      type: t.field({
        type: ElementType,
        resolve: ({ elementType }) => elementType,
      }),
    }),
  })

export const ElementImportPackagePreviewSelectionOptions = builder
  .objectRef<
    PreviewOptionsWrapper<typeof DB.ElementType.SELECTION>
  >('ElementImportPackagePreviewSelectionOptions')
  .implement({
    fields: (t) => ({
      type: t.field({
        type: ElementType,
        resolve: ({ elementType }) => elementType,
      }),
      hasSampleSolution: t.boolean({
        resolve: ({ options }) => options.hasSampleSolution,
      }),
      numberOfInputs: t.int({
        resolve: ({ options }) => options.numberOfInputs,
      }),
    }),
  })

export const ElementImportPackagePreviewCaseStudyOptions = builder
  .objectRef<
    PreviewOptionsWrapper<typeof DB.ElementType.CASE_STUDY>
  >('ElementImportPackagePreviewCaseStudyOptions')
  .implement({
    fields: (t) => ({
      type: t.field({
        type: ElementType,
        resolve: ({ elementType }) => elementType,
      }),
      hasSampleSolution: t.boolean({
        resolve: ({ options }) => options.hasSampleSolution,
      }),
      criteria: t.field({
        type: [CaseStudyCriterion],
        resolve: ({ options }) => options.criteria,
      }),
      cases: t.field({
        type: [CaseStudyCase],
        resolve: ({ options }) => options.cases,
      }),
    }),
  })

export const ElementImportPackagePreviewOptions = builder.unionType(
  'ElementImportPackagePreviewOptions',
  {
    types: [
      ElementImportPackagePreviewSCOptions,
      ElementImportPackagePreviewMCOptions,
      ElementImportPackagePreviewKPRIMOptions,
      ElementImportPackagePreviewNumericalOptions,
      ElementImportPackagePreviewFreeTextOptions,
      ElementImportPackagePreviewContentOptions,
      ElementImportPackagePreviewFlashcardOptions,
      ElementImportPackagePreviewSelectionOptions,
      ElementImportPackagePreviewCaseStudyOptions,
    ],
    resolveType: ({ elementType }) => {
      switch (elementType) {
        case DB.ElementType.SC:
          return ElementImportPackagePreviewSCOptions
        case DB.ElementType.MC:
          return ElementImportPackagePreviewMCOptions
        case DB.ElementType.KPRIM:
          return ElementImportPackagePreviewKPRIMOptions
        case DB.ElementType.NUMERICAL:
          return ElementImportPackagePreviewNumericalOptions
        case DB.ElementType.FREE_TEXT:
          return ElementImportPackagePreviewFreeTextOptions
        case DB.ElementType.CONTENT:
          return ElementImportPackagePreviewContentOptions
        case DB.ElementType.FLASHCARD:
          return ElementImportPackagePreviewFlashcardOptions
        case DB.ElementType.SELECTION:
          return ElementImportPackagePreviewSelectionOptions
        case DB.ElementType.CASE_STUDY:
          return ElementImportPackagePreviewCaseStudyOptions
      }
    },
  }
)
