import { ElementType } from '@klicker-uzh/prisma/client'
import {
  computeAnswerCollectionDidacticFingerprint,
  computeElementDidacticFingerprint,
  IMPORT_EXPORT_FINGERPRINT_VERSION,
  OMITTED_AUTO_LOAD_MEDIA_IDENTITY,
  preparePlainTextFingerprintValues,
  type ElementDidacticFingerprintInput,
} from '../src/lib/importExportFingerprintCanonicalization.js'

const HASH_A = 'a'.repeat(64)
const HASH_B = 'b'.repeat(64)

function elementInput(
  type: ElementType,
  options: Record<string, unknown> = {}
): ElementDidacticFingerprintInput {
  return {
    type,
    content: 'Authored content',
    explanation: 'Authored explanation',
    options,
    pointsMultiplier: 2,
    basePoints: true,
  }
}

const allElementTypes: Array<{
  type: ElementType
  options: Record<string, unknown>
  relations?: Pick<
    ElementDidacticFingerprintInput,
    'relationValueById' | 'answerPoolValues' | 'selectedAnswerValues'
  >
}> = [
  {
    type: ElementType.SC,
    options: {
      displayMode: 'LIST',
      hasSampleSolution: true,
      hasAnswerFeedbacks: true,
      choices: [
        { ix: 0, value: 'A', correct: true, feedback: 'Correct' },
        { ix: 1, value: 'B', correct: false, feedback: 'Try again' },
      ],
    },
  },
  {
    type: ElementType.MC,
    options: {
      displayMode: 'LIST',
      hasSampleSolution: true,
      hasAnswerFeedbacks: false,
      choices: [
        { ix: 0, value: 'A', correct: true },
        { ix: 1, value: 'B', correct: true },
        { ix: 2, value: 'C', correct: false },
      ],
    },
  },
  {
    type: ElementType.KPRIM,
    options: {
      displayMode: 'LIST',
      hasSampleSolution: true,
      hasAnswerFeedbacks: false,
      choices: [
        { ix: 0, value: 'A', correct: true },
        { ix: 1, value: 'B', correct: false },
        { ix: 2, value: 'C', correct: true },
        { ix: 3, value: 'D', correct: false },
      ],
    },
  },
  {
    type: ElementType.NUMERICAL,
    options: {
      hasSampleSolution: true,
      unit: 'kg',
      restrictions: { min: 0, max: 10 },
      solutionRanges: [{ min: 4, max: 5 }],
    },
  },
  {
    type: ElementType.FREE_TEXT,
    options: {
      hasSampleSolution: true,
      restrictions: { maxLength: 100 },
      solutions: ['First solution', 'Second solution'],
    },
  },
  {
    type: ElementType.SELECTION,
    options: {
      hasSampleSolution: true,
      numberOfInputs: 1,
      answerCollection: { id: 10 },
      correctAnswers: [101],
    },
    relations: {
      answerPoolValues: ['Alpha', 'Beta'],
      selectedAnswerValues: ['Alpha'],
    },
  },
  {
    type: ElementType.CASE_STUDY,
    options: {
      hasSampleSolution: true,
      criteria: [
        {
          id: 'criterion-db',
          name: 'Quality',
          order: 0,
          min: 0,
          max: 5,
          step: 1,
        },
      ],
      cases: [
        {
          id: 'case-db',
          title: 'Case',
          description: 'Description',
          order: 0,
          solutions: [
            {
              itemId: 101,
              criteriaSolutions: [
                { criterionId: 'criterion-db', min: 4, max: 5 },
              ],
            },
          ],
        },
      ],
    },
    relations: {
      relationValueById: new Map([[101, 'Alpha']]),
      answerPoolValues: ['Alpha', 'Beta'],
      selectedAnswerValues: ['Alpha'],
    },
  },
  { type: ElementType.CONTENT, options: {} },
  { type: ElementType.FLASHCARD, options: {} },
]

describe('version 1 didactic fingerprint canonicalization', () => {
  it.each(allElementTypes)(
    'fingerprints canonical $type payloads',
    (fixture) => {
      const result = computeElementDidacticFingerprint({
        ...elementInput(fixture.type, fixture.options),
        ...fixture.relations,
      })

      expect(result).toEqual({
        version: IMPORT_EXPORT_FINGERPRINT_VERSION,
        fingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
      })
    }
  )

  it('is deterministic across object-key and normalized set ordering', () => {
    const first = computeElementDidacticFingerprint({
      ...elementInput(ElementType.SELECTION, {
        numberOfInputs: 1,
        hasSampleSolution: true,
      }),
      answerPoolValues: ['Beta', 'Alpha'],
      selectedAnswerValues: ['Beta', 'Alpha'],
    })
    const second = computeElementDidacticFingerprint({
      ...elementInput(ElementType.SELECTION, {
        hasSampleSolution: true,
        numberOfInputs: 1,
      }),
      answerPoolValues: ['Alpha', 'Beta'],
      selectedAnswerValues: ['Alpha', 'Beta'],
    })

    expect(second).toEqual(first)
  })

  it('reuses a prepared answer-pool payload without changing version 1 identity', () => {
    const answerPoolValues = ['Gamma', 'Alpha', 'Beta']
    const preparedAnswerPoolValues =
      preparePlainTextFingerprintValues(answerPoolValues)
    expect(preparedAnswerPoolValues).not.toBeNull()
    expect(preparedAnswerPoolValues?.values).toEqual(['Alpha', 'Beta', 'Gamma'])

    const directCollection = computeAnswerCollectionDidacticFingerprint({
      entries: answerPoolValues.map((value) => ({ value })),
    })
    const preparedCollection = computeAnswerCollectionDidacticFingerprint({
      entries: answerPoolValues.map((value) => ({ value })),
      preparedValues: preparedAnswerPoolValues,
    })
    expect(preparedCollection).toEqual(directCollection)

    const directElement = computeElementDidacticFingerprint({
      ...elementInput(ElementType.SELECTION, {
        hasSampleSolution: true,
        numberOfInputs: 1,
      }),
      answerPoolValues,
      selectedAnswerValues: ['Alpha'],
    })
    const preparedElement = computeElementDidacticFingerprint({
      ...elementInput(ElementType.SELECTION, {
        hasSampleSolution: true,
        numberOfInputs: 1,
      }),
      preparedAnswerPoolValues,
      selectedAnswerValues: ['Alpha'],
    })
    expect(preparedElement).toEqual(directElement)
  })

  it('treats equivalent free-text and numerical solution sets as unordered', () => {
    const freeText = computeElementDidacticFingerprint({
      ...elementInput(ElementType.FREE_TEXT, {
        hasSampleSolution: true,
        restrictions: { maxLength: 100 },
        solutions: ['Alpha', 'Beta', 'Alpha'],
      }),
    })
    const reorderedFreeText = computeElementDidacticFingerprint({
      ...elementInput(ElementType.FREE_TEXT, {
        hasSampleSolution: true,
        restrictions: { maxLength: 100 },
        solutions: ['Beta', 'Alpha'],
      }),
    })
    const numerical = computeElementDidacticFingerprint({
      ...elementInput(ElementType.NUMERICAL, {
        hasSampleSolution: true,
        restrictions: { min: 0, max: 10 },
        solutionRanges: [
          { min: 4, max: 5 },
          { min: 1, max: 2 },
          { min: 4, max: 5 },
        ],
      }),
    })
    const reorderedNumerical = computeElementDidacticFingerprint({
      ...elementInput(ElementType.NUMERICAL, {
        hasSampleSolution: true,
        restrictions: { min: 0, max: 10 },
        solutionRanges: [
          { min: 1, max: 2 },
          { min: 4, max: 5 },
        ],
      }),
    })

    expect(reorderedFreeText).toEqual(freeText)
    expect(reorderedNumerical).toEqual(numerical)
  })

  it('includes every didactic field that can change teaching or scoring', () => {
    const base = {
      ...elementInput(ElementType.SC, {
        hasSampleSolution: true,
        hasAnswerFeedbacks: true,
        choices: [
          { ix: 0, value: 'Alpha', correct: true, feedback: 'Correct' },
          { ix: 1, value: 'Beta', correct: false, feedback: 'Incorrect' },
        ],
      }),
      answerPoolValues: ['Alpha', 'Beta'],
      selectedAnswerValues: ['Alpha'],
    }
    const fingerprint = computeElementDidacticFingerprint(base)
    const variants = [
      { ...base, type: ElementType.MC },
      { ...base, content: 'Changed content' },
      { ...base, explanation: 'Changed explanation' },
      { ...base, pointsMultiplier: 3 },
      { ...base, basePoints: false },
      { ...base, answerPoolValues: ['Alpha', 'Gamma'] },
      { ...base, selectedAnswerValues: ['Beta'] },
      {
        ...base,
        options: {
          ...base.options,
          choices: [
            { ix: 0, value: 'Alpha', correct: false, feedback: 'Changed' },
            { ix: 1, value: 'Beta', correct: true, feedback: 'Incorrect' },
          ],
        },
      },
    ]

    for (const variant of variants) {
      expect(computeElementDidacticFingerprint(variant)).not.toEqual(
        fingerprint
      )
    }
  })

  it('excludes workflow, ownership, transport, and collection metadata', () => {
    const base = {
      ...elementInput(ElementType.SELECTION, {
        hasSampleSolution: true,
        numberOfInputs: 1,
        answerCollection: { id: 10, entries: [] },
        correctAnswers: [101],
      }),
      answerPoolValues: ['Alpha', 'Beta'],
      selectedAnswerValues: ['Alpha'],
    }
    const withExcludedMetadata = {
      ...base,
      id: 999,
      name: 'Renamed element',
      status: 'READY',
      tags: ['Private'],
      ownerId: 'owner-id',
      permissions: ['OWNER'],
      createdAt: new Date(0),
      updatedAt: new Date(),
      filename: 'source.json',
      answerCollectionName: 'Renamed collection',
      answerCollectionDescription: 'Changed metadata',
      answerCollectionVersion: 42,
      options: {
        ...base.options,
        answerCollection: { id: 999, entries: [{ id: 123 }] },
        correctAnswers: [999],
      },
    } as ElementDidacticFingerprintInput

    expect(computeElementDidacticFingerprint(withExcludedMetadata)).toEqual(
      computeElementDidacticFingerprint(base)
    )
  })

  it('fingerprints answer collections by normalized values only', () => {
    const entriesWithTransportIds = [
      { value: 'Beta', ref: 'package-entry-b', id: 10 },
      { value: 'Alpha', ref: 'package-entry-a', id: 20 },
    ]
    const first = computeAnswerCollectionDidacticFingerprint({
      entries: entriesWithTransportIds,
      name: 'Collection A',
      description: 'Description A',
      version: 1,
    } as any)
    const sameValues = computeAnswerCollectionDidacticFingerprint({
      entries: [{ value: 'Alpha' }, { value: 'Beta' }],
      name: 'Collection B',
      description: 'Description B with ![image](https://example.com/a.png)',
      version: 99,
    } as any)
    const changedValues = computeAnswerCollectionDidacticFingerprint({
      entries: [{ value: 'Alpha' }, { value: 'Gamma' }],
    })

    expect(sameValues).toEqual(first)
    expect(changedValues).not.toEqual(first)
  })

  it('normalizes verified media by SHA-256, not URL or filename', () => {
    const packageHref = 'klicker-package-media://media-a'
    const storedHref =
      'https://storage.invalid/owner/imported/a-different-filename.png'
    const packageFingerprint = computeElementDidacticFingerprint({
      ...elementInput(ElementType.CONTENT),
      content: `![diagram](<${packageHref}>)`,
      media: {
        verifiedByHref: new Map([
          [packageHref, { sha256: HASH_A, filename: 'package-name.png' }],
        ]),
      },
    })
    const storedFingerprint = computeElementDidacticFingerprint({
      ...elementInput(ElementType.CONTENT),
      content: `![diagram](<${storedHref}>)`,
      media: {
        verifiedByHref: new Map([
          [storedHref, { sha256: HASH_A, filename: 'renamed.png' }],
        ]),
      },
    })
    const changedMedia = computeElementDidacticFingerprint({
      ...elementInput(ElementType.CONTENT),
      content: `![diagram](<${storedHref}>)`,
      media: {
        verifiedByHref: new Map([[storedHref, { sha256: HASH_B }]]),
      },
    })

    expect(storedFingerprint).toEqual(packageFingerprint)
    expect(changedMedia).not.toEqual(packageFingerprint)
  })

  it('uses one omission identity for external auto-loading media', () => {
    const first = computeElementDidacticFingerprint({
      ...elementInput(ElementType.CONTENT),
      content: '![external](https://one.example/image.png)',
    })
    const second = computeElementDidacticFingerprint({
      ...elementInput(ElementType.CONTENT),
      content: '![external](https://two.example/different.png)',
    })
    const explicitMarker = computeElementDidacticFingerprint({
      ...elementInput(ElementType.CONTENT),
      content: `![external](<${OMITTED_AUTO_LOAD_MEDIA_IDENTITY}>)`,
    })

    expect(second).toEqual(first)
    expect(explicitMarker).toEqual(first)
  })

  it('keeps image-shaped plain grading strings as authored identity', () => {
    const first = computeElementDidacticFingerprint({
      ...elementInput(ElementType.FREE_TEXT, {
        hasSampleSolution: true,
        solutions: ['![literal](https://one.example/answer.png)'],
      }),
    })
    const second = computeElementDidacticFingerprint({
      ...elementInput(ElementType.FREE_TEXT, {
        hasSampleSolution: true,
        solutions: ['![literal](https://two.example/answer.png)'],
      }),
    })

    expect(first).not.toBeNull()
    expect(second).not.toEqual(first)
  })

  it('keeps ordinary external links as authored content', () => {
    const first = computeElementDidacticFingerprint({
      ...elementInput(ElementType.CONTENT),
      content: '[source](https://one.example/document)',
    })
    const second = computeElementDidacticFingerprint({
      ...elementInput(ElementType.CONTENT),
      content: '[source](https://two.example/document)',
    })

    expect(second).not.toEqual(first)
  })

  it('keeps verified ordinary links and plain entry URLs as authored content', () => {
    const firstHref = 'https://storage.invalid/owner/imported/first.png'
    const secondHref = 'https://storage.invalid/owner/imported/second.png'
    const firstElement = computeElementDidacticFingerprint({
      ...elementInput(ElementType.CONTENT),
      content: `[source](<${firstHref}>)`,
      media: {
        verifiedByHref: new Map([[firstHref, { sha256: HASH_A }]]),
      },
    })
    const secondElement = computeElementDidacticFingerprint({
      ...elementInput(ElementType.CONTENT),
      content: `[source](<${secondHref}>)`,
      media: {
        verifiedByHref: new Map([[secondHref, { sha256: HASH_A }]]),
      },
    })
    const firstCollection = computeAnswerCollectionDidacticFingerprint({
      entries: [{ value: `Source: ${firstHref}` }],
      media: {
        verifiedByHref: new Map([[firstHref, { sha256: HASH_A }]]),
      },
    })
    const secondCollection = computeAnswerCollectionDidacticFingerprint({
      entries: [{ value: `Source: ${secondHref}` }],
      media: {
        verifiedByHref: new Map([[secondHref, { sha256: HASH_A }]]),
      },
    })

    expect(secondElement).not.toEqual(firstElement)
    expect(secondCollection).not.toEqual(firstCollection)
  })

  it('returns null for unresolved media, invalid hashes, or package refs', () => {
    const href = 'https://storage.invalid/owner/unhashed.png'

    expect(
      computeElementDidacticFingerprint({
        ...elementInput(ElementType.CONTENT),
        content: `![image](<${href}>)`,
        media: { unresolvedHrefs: new Set([href]) },
      })
    ).toBeNull()
    expect(
      computeElementDidacticFingerprint({
        ...elementInput(ElementType.CONTENT),
        content: '![image](klicker-package-media://media-a)',
        media: {
          verifiedByHref: new Map([
            ['klicker-package-media://media-a', { sha256: 'invalid' }],
          ]),
        },
      })
    ).toBeNull()
    expect(
      computeElementDidacticFingerprint({
        ...elementInput(ElementType.CONTENT),
        content: '![image](klicker-package-media://missing)',
      })
    ).toBeNull()
    expect(
      computeElementDidacticFingerprint({
        ...elementInput(ElementType.CONTENT),
        content: '[download](klicker-package-media://transport-only)',
        media: {
          verifiedByHref: new Map([
            ['klicker-package-media://transport-only', { sha256: HASH_A }],
          ]),
        },
      })
    ).toBeNull()
    expect(
      computeAnswerCollectionDidacticFingerprint({
        entries: [{ value: 'klicker-package-media://transport-only' }],
      })
    ).toBeNull()
  })

  it('returns null instead of embedding unknown relation IDs or refs', () => {
    const optionsWithId = {
      hasSampleSolution: true,
      criteria: [
        { id: 'criterion', name: 'Quality', order: 0, min: 0, max: 5, step: 1 },
      ],
      cases: [
        {
          id: 'case',
          title: 'Case',
          description: 'Description',
          order: 0,
          solutions: [
            {
              itemId: 404,
              criteriaSolutions: [{ criterionId: 'criterion', min: 0, max: 1 }],
            },
          ],
        },
      ],
    }
    const optionsWithRef = {
      ...optionsWithId,
      cases: [
        {
          ...(optionsWithId.cases[0] as Record<string, unknown>),
          solutions: [
            {
              itemRef: 'missing-ref',
              criteriaSolutions: [{ criterionId: 'criterion', min: 0, max: 1 }],
            },
          ],
        },
      ],
    }

    expect(
      computeElementDidacticFingerprint({
        ...elementInput(ElementType.CASE_STUDY, optionsWithId),
        relationValueById: new Map(),
      })
    ).toBeNull()
    expect(
      computeElementDidacticFingerprint({
        ...elementInput(ElementType.CASE_STUDY, optionsWithRef),
        relationValueByRef: new Map(),
      })
    ).toBeNull()
  })

  it('matches package and persisted representations of the same case study', () => {
    const packageHref = 'klicker-package-media://case-image'
    const storedHref = 'https://storage.invalid/owner/imported/case.png'
    const packageInput: ElementDidacticFingerprintInput = {
      ...elementInput(ElementType.CASE_STUDY, {
        hasSampleSolution: true,
        criteria: [
          {
            id: 'package-quality',
            name: 'Quality',
            order: 0,
            min: 0,
            max: 5,
            step: 1,
          },
        ],
        cases: [
          {
            id: 'package-case',
            title: 'Case',
            description: `Description ![image](<${packageHref}>)`,
            order: 0,
            solutions: [
              {
                itemRef: 'entry-beta',
                criteriaSolutions: [
                  { criterionId: 'package-quality', min: 1, max: 2 },
                ],
              },
              {
                itemRef: 'entry-alpha',
                criteriaSolutions: [
                  { criterionId: 'package-quality', min: 4, max: 5 },
                ],
              },
            ],
          },
        ],
      }),
      answerPoolValues: ['Beta', 'Alpha'],
      selectedAnswerValues: ['Beta', 'Alpha'],
      relationValueByRef: new Map([
        ['entry-alpha', 'Alpha'],
        ['entry-beta', 'Beta'],
      ]),
      media: {
        verifiedByHref: new Map([[packageHref, { sha256: HASH_A }]]),
      },
    }
    const persistedInput: ElementDidacticFingerprintInput = {
      ...elementInput(ElementType.CASE_STUDY, {
        hasSampleSolution: true,
        criteria: [
          {
            id: 'db-criterion-987',
            name: 'Quality',
            order: 0,
            min: 0,
            max: 5,
            step: 1,
          },
        ],
        cases: [
          {
            id: 'db-case-654',
            title: 'Case',
            description: `Description ![image](<${storedHref}>)`,
            order: 0,
            solutions: [
              {
                itemId: 202,
                criteriaSolutions: [
                  { criterionId: 'db-criterion-987', min: 1, max: 2 },
                ],
              },
              {
                itemId: 101,
                criteriaSolutions: [
                  { criterionId: 'db-criterion-987', min: 4, max: 5 },
                ],
              },
            ],
          },
        ],
      }),
      answerPoolValues: ['Alpha', 'Beta'],
      selectedAnswerValues: ['Alpha', 'Beta'],
      relationValueById: new Map([
        [101, 'Alpha'],
        [202, 'Beta'],
      ]),
      media: {
        verifiedByHref: new Map([[storedHref, { sha256: HASH_A }]]),
      },
    }

    expect(computeElementDidacticFingerprint(persistedInput)).toEqual(
      computeElementDidacticFingerprint(packageInput)
    )
  })
})
