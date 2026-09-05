import {
  ElementDisplayMode,
  ElementStatus,
  ElementType,
  ImportExportWarningCode,
} from '@klicker-uzh/graphql/dist/ops.js'
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  convertPackagePreviewElementToFormValues,
  createElementImportReviewModel,
  type PackagePreviewElement,
} from '../src/lib/elementImportPreview.ts'

type PreviewOptions = PackagePreviewElement['options']

function previewElement(
  type: ElementType,
  options: PreviewOptions,
  overrides: Partial<PackagePreviewElement> = {}
): PackagePreviewElement {
  return {
    ref: `element-${type}`,
    name: `${type} element`,
    content: `Content for ${type}`,
    type,
    options,
    pointsMultiplier: 2,
    basePoints: true,
    explanation: 'Explanation',
    status: ElementStatus.Ready,
    alreadyImported: false,
    answerCollectionId: 17,
    answerCollectionRef: 'collection-1',
    answerCollectionItemIds: [11],
    ...overrides,
  }
}

const previews: Array<{
  expectedType: ElementType
  element: PackagePreviewElement
}> = [
  {
    expectedType: ElementType.Sc,
    element: previewElement(ElementType.Sc, {
      __typename: 'ElementImportPackagePreviewSCOptions',
      type: ElementType.Sc,
      displayMode: ElementDisplayMode.List,
      hasSampleSolution: false,
      hasAnswerFeedbacks: false,
      choices: [{ ix: 0, value: 'A', correct: null, feedback: null }],
    }),
  },
  {
    expectedType: ElementType.Mc,
    element: previewElement(ElementType.Mc, {
      __typename: 'ElementImportPackagePreviewMCOptions',
      type: ElementType.Mc,
      displayMode: ElementDisplayMode.Grid,
      hasSampleSolution: true,
      hasAnswerFeedbacks: true,
      choices: [{ ix: 0, value: 'A', correct: true, feedback: 'Yes' }],
    }),
  },
  {
    expectedType: ElementType.Kprim,
    element: previewElement(ElementType.Kprim, {
      __typename: 'ElementImportPackagePreviewKPRIMOptions',
      type: ElementType.Kprim,
      displayMode: ElementDisplayMode.List,
      hasSampleSolution: true,
      hasAnswerFeedbacks: false,
      choices: [{ ix: 0, value: 'A', correct: false, feedback: null }],
    }),
  },
  {
    expectedType: ElementType.Numerical,
    element: previewElement(ElementType.Numerical, {
      __typename: 'ElementImportPackagePreviewNumericalOptions',
      type: ElementType.Numerical,
      hasSampleSolution: true,
      accuracy: 2,
      placeholder: 'π ≈ 3,14',
      unit: 'rad',
      restrictions: { min: -10, max: 10 },
      solutionRanges: [{ min: 3.13, max: 3.15 }],
      exactSolutions: null,
    }),
  },
  {
    expectedType: ElementType.FreeText,
    element: previewElement(ElementType.FreeText, {
      __typename: 'ElementImportPackagePreviewFreeTextOptions',
      type: ElementType.FreeText,
      hasSampleSolution: false,
      restrictions: { maxLength: 100 },
      solutions: null,
    }),
  },
  {
    expectedType: ElementType.Content,
    element: previewElement(ElementType.Content, {
      __typename: 'ElementImportPackagePreviewContentOptions',
      type: ElementType.Content,
    }),
  },
  {
    expectedType: ElementType.Flashcard,
    element: previewElement(ElementType.Flashcard, {
      __typename: 'ElementImportPackagePreviewFlashcardOptions',
      type: ElementType.Flashcard,
    }),
  },
  {
    expectedType: ElementType.Selection,
    element: previewElement(ElementType.Selection, {
      __typename: 'ElementImportPackagePreviewSelectionOptions',
      type: ElementType.Selection,
      hasSampleSolution: false,
      numberOfInputs: 2,
    }),
  },
  {
    expectedType: ElementType.CaseStudy,
    element: previewElement(ElementType.CaseStudy, {
      __typename: 'ElementImportPackagePreviewCaseStudyOptions',
      type: ElementType.CaseStudy,
      hasSampleSolution: true,
      criteria: [
        {
          id: 'criterion-1',
          name: 'Quality',
          order: 0,
          min: 0,
          max: 5,
          step: 1,
          unit: 'pt',
          labels: { min: 'Low', mid: 'Medium', max: 'High' },
        },
      ],
      cases: [
        {
          id: 'case-1',
          title: 'Case',
          description: 'Description',
          order: 0,
          solutions: [
            {
              itemId: 11,
              criteriaSolutions: [
                { criterionId: 'criterion-1', min: 2, max: 4 },
              ],
            },
          ],
        },
      ],
    }),
  },
]

test('converts all nine typed preview branches to review-safe form values', () => {
  assert.equal(previews.length, 9)

  for (const { element, expectedType } of previews) {
    const converted = convertPackagePreviewElementToFormValues(element)
    assert.equal(converted.type, expectedType)
    assert.equal(converted.status, ElementStatus.Review)
    assert.deepEqual(converted.tags, [])
  }
})

test('preserves Unicode numerical placeholders and typed solution ranges', () => {
  const converted = convertPackagePreviewElementToFormValues(
    previews[3]!.element
  )
  assert.equal(converted.type, ElementType.Numerical)
  if (converted.type === ElementType.Numerical) {
    assert.equal(converted.options.placeholder, 'π ≈ 3,14')
    assert.equal(converted.options.solutionType, 'range')
    assert.deepEqual(converted.options.solutionRanges, [
      { min: 3.13, max: 3.15 },
    ])
  }
})

test('omits scoring keys when no sample solution is present', () => {
  const choice = convertPackagePreviewElementToFormValues(previews[0]!.element)
  assert.equal(choice.type, ElementType.Sc)
  if (choice.type === ElementType.Sc) {
    assert.equal(choice.options.hasSampleSolution, false)
    assert.equal(choice.options.choices[0]?.correct, null)
  }

  const selection = convertPackagePreviewElementToFormValues(
    previews[7]!.element
  )
  assert.equal(selection.type, ElementType.Selection)
  if (selection.type === ElementType.Selection) {
    assert.deepEqual(selection.options.correctAnswers, [])
  }
})

test('keeps complete answer pools while mapping selected case-study solutions', () => {
  const preview: Parameters<typeof createElementImportReviewModel>[0] = {
    importToken: 'token',
    warnings: [ImportExportWarningCode.ImportStatusNormalizedToReview],
    errors: [],
    elements: [previews[8]!.element],
    answerCollections: [
      {
        ref: 'collection-1',
        name: 'Pool',
        description: 'Complete pool',
        alreadyImported: false,
        entries: [
          { id: 11, value: 'Selected' },
          { id: 12, value: 'Unselected' },
        ],
      },
    ],
  }

  const model = createElementImportReviewModel(preview)
  assert.deepEqual(
    model.answerCollectionEntries[previews[8]!.element.ref]?.map(
      (entry) => entry.id
    ),
    [11, 12]
  )

  const converted = model.elements[previews[8]!.element.ref]
  assert.equal(converted?.type, ElementType.CaseStudy)
  if (converted?.type === ElementType.CaseStudy) {
    assert.deepEqual(converted.options.cases[0]?.solutions, {
      'itemId-11': { 'criterion-1': { min: '2', max: '4' } },
    })
  }
})
