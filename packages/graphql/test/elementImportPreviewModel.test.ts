import { ElementType } from '@klicker-uzh/prisma/client'
import { computeElementDidacticFingerprint } from '../src/lib/importExportFingerprintCanonicalization.js'
import {
  createElementImportPreviewModel,
  createElementImportPreviewOperationCounters,
  decorateElementImportPreviewWithDuplicateMatches,
  type ElementImportPreviewPackage,
} from '../src/services/elementImportPreviewModel.js'

function createCollection(ref: string, entryCount: number) {
  return {
    ref,
    name: `Collection ${ref}`,
    description: '',
    entries: Array.from({ length: entryCount }, (_, index) => ({
      ref: `${ref}-entry-${index + 1}`,
      value: `${ref} value ${index + 1}`,
    })),
  }
}

function createMaximumPreviewPackage(): ElementImportPreviewPackage {
  const answerCollections = [
    createCollection('collection-1', 2_000),
    createCollection('collection-2', 2_000),
    createCollection('collection-3', 1_000),
  ]
  const sharedEntryRefs = answerCollections[0]!.entries
    .slice(0, 50)
    .map(({ ref }) => ref)
  return {
    answerCollections,
    elements: Array.from({ length: 100 }, (_, index) => ({
      ref: `element-${index + 1}`,
      name: `Selection ${index + 1}`,
      content: `Select the applicable answers ${index + 1}`,
      type: ElementType.SELECTION,
      options: {
        hasSampleSolution: true,
        numberOfInputs: 1,
      },
      pointsMultiplier: 1,
      basePoints: true,
      explanation: null,
      answerCollectionRef: answerCollections[0]!.ref,
      answerCollectionItemRefs: sharedEntryRefs,
    })),
    media: [],
  }
}

describe('element import preview model', () => {
  it('indexes the supported maximum once and overlays duplicate matches without rebuilding', () => {
    const counters = createElementImportPreviewOperationCounters()
    const maximumPackage = createMaximumPreviewPackage()
    const model = createElementImportPreviewModel(maximumPackage, counters)

    expect(counters).toEqual({
      modelBuilds: 1,
      collectionsIndexed: 3,
      entriesIndexed: 5_000,
      elementsBuilt: 100,
      collectionLookups: 100,
      selectedRefLookups: 5_000,
      caseSolutionRefLookups: 0,
      collectionFingerprintPasses: 3,
      elementFingerprintPasses: 100,
      duplicateOverlayVisits: 0,
    })
    expect(model.preview.answerCollections).toHaveLength(3)
    expect(model.preview.elements).toHaveLength(100)
    expect(model.preview.elements[0]).not.toHaveProperty(
      'answerCollectionItems'
    )
    expect(model.preview.elements[0]?.answerCollectionItemIds).toHaveLength(50)
    expect(model.preview.elements[0]?.options).toEqual({
      hasSampleSolution: true,
      numberOfInputs: 1,
    })
    expect(model.preview.elements[0]?.options).not.toHaveProperty(
      'correctAnswers'
    )
    expect(Object.isFrozen(maximumPackage.elements[0]!.options)).toBe(false)
    expect(Object.isFrozen(model)).toBe(true)
    expect(Object.isFrozen(model.preview.elements)).toBe(true)
    expect(Object.isFrozen(model.preview.elements[0])).toBe(true)

    const firstElementFingerprint = model.elementFingerprintCandidates[0]?.[0]
    const firstCollectionFingerprint = model.answerCollectionFingerprints[0]
    expect(firstElementFingerprint).toEqual(expect.any(String))
    expect(firstCollectionFingerprint).toEqual(expect.any(String))

    const decorated = decorateElementImportPreviewWithDuplicateMatches(
      model,
      {
        elementMatchByFingerprint: new Map([
          [firstElementFingerprint!, { id: 101, name: 'Existing element' }],
        ]),
        answerCollectionMatchByFingerprint: new Map([
          [
            firstCollectionFingerprint!,
            { id: 202, name: 'Existing collection' },
          ],
        ]),
      },
      counters
    )

    expect(counters.modelBuilds).toBe(1)
    expect(counters.collectionFingerprintPasses).toBe(3)
    expect(counters.elementFingerprintPasses).toBe(100)
    expect(counters.duplicateOverlayVisits).toBe(103)
    expect(decorated.elements[0]).toMatchObject({
      alreadyImported: true,
      existingElementId: 101,
    })
    expect(decorated.answerCollections[0]).toMatchObject({
      alreadyImported: true,
      existingAnswerCollectionId: 202,
    })
    expect(model.preview.elements[0]).toMatchObject({
      alreadyImported: false,
      existingElementId: null,
    })
  })

  it('maps case-study refs for review while preserving the package-form fingerprint', () => {
    const collection = {
      ref: 'collection-1',
      name: 'Case study pool',
      description: '',
      entries: [
        { ref: 'entry-alpha', value: 'Alpha' },
        { ref: 'entry-beta', value: 'Beta' },
      ],
    }
    const element = {
      ref: 'case-study-1',
      name: 'Case study',
      content: 'Evaluate both alternatives.',
      type: ElementType.CASE_STUDY,
      options: {
        hasSampleSolution: true,
        criteria: [
          {
            id: 'criterion-1',
            name: 'Quality',
            order: 0,
            min: 0,
            max: 5,
            step: 1,
          },
        ],
        cases: [
          {
            id: 'case-1',
            title: 'Case 1',
            description: 'Description',
            order: 0,
            solutions: [
              {
                itemRef: 'entry-alpha',
                criteriaSolutions: [
                  { criterionId: 'criterion-1', min: 4, max: 5 },
                ],
              },
              {
                itemRef: 'entry-beta',
                criteriaSolutions: [
                  { criterionId: 'criterion-1', min: 1, max: 2 },
                ],
              },
            ],
          },
        ],
      },
      pointsMultiplier: 1,
      basePoints: true,
      explanation: null,
      answerCollectionRef: collection.ref,
      answerCollectionItemRefs: collection.entries.map(({ ref }) => ref),
    }
    const model = createElementImportPreviewModel({
      answerCollections: [collection],
      elements: [element],
      media: [],
    })
    const preview = model.preview.elements[0]!

    expect(preview.answerCollectionItemIds).toEqual([1, 2])
    expect(preview.options).toMatchObject({
      cases: [
        {
          solutions: [{ itemId: 1 }, { itemId: 2 }],
        },
      ],
    })
    expect(JSON.stringify(preview.options)).not.toContain('itemRef')

    const databaseFormFingerprint = computeElementDidacticFingerprint({
      type: element.type,
      content: element.content,
      explanation: element.explanation,
      options: preview.options,
      pointsMultiplier: element.pointsMultiplier,
      basePoints: element.basePoints,
      answerPoolValues: collection.entries.map(({ value }) => value),
      selectedAnswerValues: collection.entries.map(({ value }) => value),
      relationValueById: new Map([
        [1, 'Alpha'],
        [2, 'Beta'],
      ]),
    })
    expect(model.elementFingerprintCandidates[0]).toEqual([
      databaseFormFingerprint!.fingerprint,
    ])
    expect(Object.isFrozen(element.options)).toBe(false)
  })
})
