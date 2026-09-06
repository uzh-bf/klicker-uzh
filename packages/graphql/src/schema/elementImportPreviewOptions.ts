import * as DB from '@klicker-uzh/prisma/client'
import builder from '../builder.js'
import type {
  ElementImportPackagePreviewOptionsByElementType,
  ElementImportPackagePreviewOptionsSource,
} from '../services/elementImportPreviewModel.js'
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

type PreviewOptionsWrapper<Type extends DB.ElementType> = {
  type: Type
  options: ElementImportPackagePreviewOptionsByElementType[Type]
}

export type ElementImportPackagePreviewOptionsValue = {
  [Type in DB.ElementType]: PreviewOptionsWrapper<Type>
}[DB.ElementType]

export function createElementImportPackagePreviewOptions(
  element: ElementImportPackagePreviewOptionsSource
): ElementImportPackagePreviewOptionsValue {
  return element
}

export const ElementImportPackagePreviewSCOptions = builder
  .objectRef<PreviewOptionsWrapper<typeof DB.ElementType.SC>>(
    'ElementImportPackagePreviewSCOptions'
  )
  .implement({
    fields: (t) => ({
      type: t.field({
        type: ElementType,
        resolve: ({ type }) => type,
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
  .objectRef<PreviewOptionsWrapper<typeof DB.ElementType.MC>>(
    'ElementImportPackagePreviewMCOptions'
  )
  .implement({
    fields: (t) => ({
      type: t.field({
        type: ElementType,
        resolve: ({ type }) => type,
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
  .objectRef<PreviewOptionsWrapper<typeof DB.ElementType.KPRIM>>(
    'ElementImportPackagePreviewKPRIMOptions'
  )
  .implement({
    fields: (t) => ({
      type: t.field({
        type: ElementType,
        resolve: ({ type }) => type,
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
  .objectRef<PreviewOptionsWrapper<typeof DB.ElementType.NUMERICAL>>(
    'ElementImportPackagePreviewNumericalOptions'
  )
  .implement({
    fields: (t) => ({
      type: t.field({
        type: ElementType,
        resolve: ({ type }) => type,
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
  .objectRef<PreviewOptionsWrapper<typeof DB.ElementType.FREE_TEXT>>(
    'ElementImportPackagePreviewFreeTextOptions'
  )
  .implement({
    fields: (t) => ({
      type: t.field({
        type: ElementType,
        resolve: ({ type }) => type,
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
  .objectRef<PreviewOptionsWrapper<typeof DB.ElementType.CONTENT>>(
    'ElementImportPackagePreviewContentOptions'
  )
  .implement({
    fields: (t) => ({
      type: t.field({
        type: ElementType,
        resolve: ({ type }) => type,
      }),
    }),
  })

export const ElementImportPackagePreviewFlashcardOptions = builder
  .objectRef<PreviewOptionsWrapper<typeof DB.ElementType.FLASHCARD>>(
    'ElementImportPackagePreviewFlashcardOptions'
  )
  .implement({
    fields: (t) => ({
      type: t.field({
        type: ElementType,
        resolve: ({ type }) => type,
      }),
    }),
  })

export const ElementImportPackagePreviewSelectionOptions = builder
  .objectRef<PreviewOptionsWrapper<typeof DB.ElementType.SELECTION>>(
    'ElementImportPackagePreviewSelectionOptions'
  )
  .implement({
    fields: (t) => ({
      type: t.field({
        type: ElementType,
        resolve: ({ type }) => type,
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
  .objectRef<PreviewOptionsWrapper<typeof DB.ElementType.CASE_STUDY>>(
    'ElementImportPackagePreviewCaseStudyOptions'
  )
  .implement({
    fields: (t) => ({
      type: t.field({
        type: ElementType,
        resolve: ({ type }) => type,
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
    resolveType: ({ type }) => {
      switch (type) {
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
