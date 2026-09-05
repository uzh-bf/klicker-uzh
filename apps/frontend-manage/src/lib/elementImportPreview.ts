import {
  ElementStatus,
  ElementType,
  type ImportExportWarningCode,
  type ValidateElementImportPackageMutation,
} from '@klicker-uzh/graphql/dist/ops.js'
import type {
  ElementFormTypes,
  ElementFormTypesCaseStudySolutions,
} from '~/components/elements/manipulation/types'

type PackagePreview = NonNullable<
  ValidateElementImportPackageMutation['validateElementImportPackage']
>

export type PackagePreviewElement = PackagePreview['elements'][number]

export type PackagePreviewElementMeta = {
  alreadyImported: boolean
  existingElementId?: number | null
  existingElementName?: string | null
  answerCollectionRef?: string | null
}

export type ElementImportReviewModel = {
  importToken: string
  warnings: readonly ImportExportWarningCode[]
  elements: Record<string, ElementFormTypes>
  elementMeta: Record<string, PackagePreviewElementMeta>
  answerCollectionEntries: Record<
    string,
    readonly { id: number; value: string }[]
  >
  answerCollections: PackagePreview['answerCollections']
}

function sharedQuestionFields(element: PackagePreviewElement) {
  return {
    name: element.name,
    status: ElementStatus.Review,
    content: element.content,
    pointsMultiplier: String(element.pointsMultiplier),
    basePoints: element.basePoints,
    tags: [],
  }
}

function assertNever(value: never): never {
  void value
  throw new Error('Unsupported element import preview options.')
}

export function convertPackagePreviewElementToFormValues(
  element: PackagePreviewElement
): ElementFormTypes {
  const shared = sharedQuestionFields(element)
  const explanation = element.explanation ?? ''

  switch (element.options.__typename) {
    case 'ElementImportPackagePreviewSCOptions':
      return {
        ...shared,
        type: ElementType.Sc,
        explanation,
        options: {
          displayMode: element.options.displayMode,
          hasSampleSolution: element.options.hasSampleSolution,
          hasAnswerFeedbacks: element.options.hasAnswerFeedbacks,
          choices: element.options.choices.map((choice) => ({
            id: String(choice.ix),
            ix: choice.ix,
            value: choice.value,
            correct: choice.correct,
            feedback: choice.feedback,
          })),
        },
      }
    case 'ElementImportPackagePreviewMCOptions':
      return {
        ...shared,
        type: ElementType.Mc,
        explanation,
        options: {
          displayMode: element.options.displayMode,
          hasSampleSolution: element.options.hasSampleSolution,
          hasAnswerFeedbacks: element.options.hasAnswerFeedbacks,
          choices: element.options.choices.map((choice) => ({
            id: String(choice.ix),
            ix: choice.ix,
            value: choice.value,
            correct: choice.correct,
            feedback: choice.feedback,
          })),
        },
      }
    case 'ElementImportPackagePreviewKPRIMOptions':
      return {
        ...shared,
        type: ElementType.Kprim,
        explanation,
        options: {
          displayMode: element.options.displayMode,
          hasSampleSolution: element.options.hasSampleSolution,
          hasAnswerFeedbacks: element.options.hasAnswerFeedbacks,
          choices: element.options.choices.map((choice) => ({
            id: String(choice.ix),
            ix: choice.ix,
            value: choice.value,
            correct: choice.correct,
            feedback: choice.feedback,
          })),
        },
      }
    case 'ElementImportPackagePreviewNumericalOptions': {
      const hasSampleSolution = element.options.hasSampleSolution
      const solutionRanges = hasSampleSolution
        ? element.options.solutionRanges
        : undefined
      const exactSolutions = hasSampleSolution
        ? element.options.exactSolutions
        : undefined

      return {
        ...shared,
        type: ElementType.Numerical,
        explanation,
        options: {
          hasSampleSolution,
          accuracy: element.options.accuracy,
          placeholder: element.options.placeholder,
          unit: element.options.unit,
          restrictions: element.options.restrictions,
          solutionType:
            solutionRanges != null
              ? 'range'
              : exactSolutions != null
                ? 'exact'
                : undefined,
          solutionRanges,
          exactSolutions,
        },
      }
    }
    case 'ElementImportPackagePreviewFreeTextOptions':
      return {
        ...shared,
        type: ElementType.FreeText,
        explanation,
        options: {
          hasSampleSolution: element.options.hasSampleSolution,
          restrictions: element.options.restrictions,
          solutions: element.options.hasSampleSolution
            ? element.options.solutions
            : undefined,
        },
      }
    case 'ElementImportPackagePreviewContentOptions':
      return {
        ...shared,
        type: ElementType.Content,
      }
    case 'ElementImportPackagePreviewFlashcardOptions':
      return {
        ...shared,
        type: ElementType.Flashcard,
        explanation,
      }
    case 'ElementImportPackagePreviewSelectionOptions':
      return {
        ...shared,
        type: ElementType.Selection,
        explanation,
        options: {
          itemSelectionMode: 'existing',
          hasSampleSolution: element.options.hasSampleSolution,
          numberOfInputs: String(element.options.numberOfInputs),
          answerCollection:
            typeof element.answerCollectionId === 'number'
              ? String(element.answerCollectionId)
              : undefined,
          manuallyCreatedItems: [],
          correctAnswers: element.options.hasSampleSolution
            ? element.answerCollectionItemIds
            : [],
        },
      }
    case 'ElementImportPackagePreviewCaseStudyOptions': {
      const options = element.options
      return {
        ...shared,
        type: ElementType.CaseStudy,
        explanation,
        options: {
          itemSelectionMode: 'existing',
          hasSampleSolution: options.hasSampleSolution,
          answerCollection:
            typeof element.answerCollectionId === 'number'
              ? String(element.answerCollectionId)
              : undefined,
          selectedItems: element.answerCollectionItemIds,
          manuallyCreatedItems: [],
          criteria: options.criteria.map((criterion) => ({
            id: criterion.id,
            mode: criterion.labels ? 'steps' : 'range',
            name: criterion.name,
            min: criterion.min,
            max: criterion.max,
            step: String(criterion.step),
            unit: criterion.unit,
            labels: criterion.labels,
          })),
          cases: options.cases.map((caseItem) => ({
            id: caseItem.id,
            title: caseItem.title,
            description: caseItem.description,
            solutions:
              options.hasSampleSolution && caseItem.solutions
                ? (Object.fromEntries(
                    caseItem.solutions.map((solution) => [
                      `itemId-${solution.itemId}`,
                      Object.fromEntries(
                        solution.criteriaSolutions.map((criterion) => [
                          criterion.criterionId,
                          {
                            min: String(criterion.min),
                            max: String(criterion.max),
                          },
                        ])
                      ),
                    ])
                  ) as ElementFormTypesCaseStudySolutions)
                : undefined,
          })),
        },
      }
    }
    default:
      return assertNever(element.options)
  }
}

export function createElementImportReviewModel(
  preview: PackagePreview & { importToken: string }
): ElementImportReviewModel {
  const answerCollectionEntriesByRef = new Map(
    preview.answerCollections.map((collection) => [
      collection.ref,
      collection.entries,
    ])
  )
  const elements: Record<string, ElementFormTypes> = {}
  const elementMeta: Record<string, PackagePreviewElementMeta> = {}
  const answerCollectionEntries: ElementImportReviewModel['answerCollectionEntries'] =
    {}

  for (const element of preview.elements) {
    elements[element.ref] = convertPackagePreviewElementToFormValues(element)
    elementMeta[element.ref] = {
      alreadyImported: element.alreadyImported,
      existingElementId: element.existingElementId,
      existingElementName: element.existingElementName,
      answerCollectionRef: element.answerCollectionRef,
    }
    answerCollectionEntries[element.ref] =
      (element.answerCollectionRef
        ? answerCollectionEntriesByRef.get(element.answerCollectionRef)
        : undefined) ?? []
  }

  return {
    importToken: preview.importToken,
    warnings: preview.warnings,
    elements,
    elementMeta,
    answerCollectionEntries,
    answerCollections: preview.answerCollections,
  }
}
