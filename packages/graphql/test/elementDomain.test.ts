import {
  gradeQuestionFreeText,
  gradeQuestionNumerical,
  gradeQuestionSC,
  gradeQuestionSelection,
} from '@klicker-uzh/grading'
import { ElementType } from '@klicker-uzh/prisma/client'
import {
  canonicalizeElementAuthoringOptions,
  canonicalizeElementDomain,
  canonicalizeElementDomainUpdate,
  canonicalizeElementOptions,
  createCanonicalElementOptionsSchema,
  ElementDomainValidationError,
} from '../src/lib/elementDomain.js'

const choice = (ix: number, correct: boolean) => ({
  ix,
  value: `Choice ${ix}`,
  correct,
})

const choiceOptions = {
  displayMode: 'LIST',
  hasSampleSolution: true,
  hasAnswerFeedbacks: false,
  choices: [choice(0, true), choice(1, false)],
}

const caseStudyOptions = {
  hasSampleSolution: true,
  criteria: [
    {
      id: 'criterion-1',
      name: ' Quality ',
      order: 0,
      min: 0,
      max: 5,
      step: 1,
    },
  ],
  cases: [
    {
      id: 'case-1',
      title: ' Case 1 ',
      description: 'Case description',
      order: 0,
      solutions: [
        {
          itemId: 10,
          criteriaSolutions: [{ criterionId: 'criterion-1', min: 4, max: 5 }],
        },
        {
          itemId: 20,
          criteriaSolutions: [{ criterionId: 'criterion-1', min: 1, max: 2 }],
        },
      ],
    },
  ],
}

const canonicalOptionsCases: Array<{
  type: ElementType
  options: any
  relations?: any
}> = [
  { type: ElementType.SC, options: choiceOptions },
  {
    type: ElementType.MC,
    options: {
      ...choiceOptions,
      choices: [choice(0, true), choice(1, true), choice(2, false)],
    },
  },
  {
    type: ElementType.KPRIM,
    options: {
      ...choiceOptions,
      choices: [
        choice(0, false),
        choice(1, false),
        choice(2, false),
        choice(3, false),
      ],
    },
  },
  {
    type: ElementType.NUMERICAL,
    options: {
      hasSampleSolution: true,
      restrictions: { min: -10, max: 10 },
      exactSolutions: [0],
    },
  },
  {
    type: ElementType.FREE_TEXT,
    options: {
      hasSampleSolution: true,
      restrictions: { maxLength: 20 },
      solutions: ['Answer'],
    },
  },
  {
    type: ElementType.SELECTION,
    options: { hasSampleSolution: false, numberOfInputs: 1 },
    relations: {
      answerCollectionId: 1,
      poolIds: [10, 20],
      selectedIds: [],
    },
  },
  {
    type: ElementType.CASE_STUDY,
    options: caseStudyOptions,
    relations: {
      answerCollectionId: 1,
      poolIds: [10, 20, 30],
      selectedIds: [10, 20],
      caseSolutionReferenceKey: 'itemId',
    },
  },
  { type: ElementType.CONTENT, options: {} },
  { type: ElementType.FLASHCARD, options: {} },
]

function expectInvalid(callback: () => unknown) {
  expect(callback).toThrow(ElementDomainValidationError)
}

describe('canonical element domain', () => {
  it.each(canonicalOptionsCases)('accepts canonical options for $type', ({
    type,
    options,
    relations,
  }) => {
    expect(() =>
      canonicalizeElementOptions({ type, options, relations })
    ).not.toThrow()
  })

  it('normalizes positional choices and strips disabled scoring fields', () => {
    const canonical = canonicalizeElementOptions({
      type: ElementType.MC,
      options: {
        displayMode: 'GRID',
        hasSampleSolution: false,
        hasAnswerFeedbacks: true,
        choices: [
          { ix: 1, value: 'B', correct: true, feedback: 'Feedback B' },
          { ix: 0, value: 'A', correct: false, feedback: 'Feedback A' },
        ],
      },
    })

    expect(canonical.options).toEqual({
      displayMode: 'GRID',
      hasSampleSolution: false,
      hasAnswerFeedbacks: false,
      choices: [
        { ix: 0, value: 'A', correct: undefined, feedback: undefined },
        { ix: 1, value: 'B', correct: undefined, feedback: undefined },
      ],
    })
  })

  it('rejects invalid choice indexes and per-type solution cardinality', () => {
    expectInvalid(() =>
      canonicalizeElementOptions({
        type: ElementType.SC,
        options: {
          ...choiceOptions,
          choices: [choice(0, true), choice(0, false)],
        },
      })
    )
    expectInvalid(() =>
      canonicalizeElementOptions({
        type: ElementType.SC,
        options: {
          ...choiceOptions,
          choices: [choice(0, true), choice(1, true)],
        },
      })
    )
    expectInvalid(() =>
      canonicalizeElementOptions({
        type: ElementType.MC,
        options: {
          ...choiceOptions,
          choices: [choice(0, false), choice(1, false)],
        },
      })
    )
    expectInvalid(() =>
      canonicalizeElementOptions({
        type: ElementType.KPRIM,
        options: {
          ...choiceOptions,
          choices: [choice(0, true), choice(1, false), choice(2, false)],
        },
      })
    )
  })

  it('normalizes numerical zero and validates every finite bound', () => {
    const exact = canonicalizeElementOptions({
      type: ElementType.NUMERICAL,
      options: {
        hasSampleSolution: true,
        unit: ' CHF ',
        accuracy: 0,
        restrictions: { min: -0, max: 10 },
        exactSolutions: [-0],
      },
    })
    expect(exact.options).toMatchObject({
      unit: 'CHF',
      accuracy: 0,
      restrictions: { min: 0, max: 10 },
      exactSolutions: [0],
    })
    expect(Object.is((exact.options.exactSolutions as number[])[0], -0)).toBe(
      false
    )

    const zeroRange = canonicalizeElementOptions({
      type: ElementType.NUMERICAL,
      options: {
        hasSampleSolution: true,
        solutionRanges: [{ min: -0, max: 0 }],
      },
    })
    expect(zeroRange.options).toMatchObject({
      solutionRanges: [{ min: 0, max: 0 }],
    })

    for (const options of [
      {
        hasSampleSolution: true,
        exactSolutions: [Number.POSITIVE_INFINITY],
      },
      {
        hasSampleSolution: true,
        solutionRanges: [{ min: 2, max: 1 }],
      },
      {
        hasSampleSolution: true,
        restrictions: { min: 0, max: 1 },
        exactSolutions: [2],
      },
      {
        hasSampleSolution: true,
        solutionRanges: [{ min: 0, max: 1 }],
        exactSolutions: [0],
      },
    ]) {
      expectInvalid(() =>
        canonicalizeElementOptions({ type: ElementType.NUMERICAL, options })
      )
    }
  })

  it('normalizes every free-text solution and enforces reachable restrictions', () => {
    const canonical = canonicalizeElementOptions({
      type: ElementType.FREE_TEXT,
      options: {
        hasSampleSolution: true,
        restrictions: { maxLength: 8 },
        solutions: [' Answer '],
      },
    })
    expect(canonical.options).toMatchObject({ solutions: ['Answer'] })

    for (const options of [
      { hasSampleSolution: true, solutions: ['Valid', '   '] },
      {
        hasSampleSolution: true,
        restrictions: { maxLength: 4 },
        solutions: ['Answer'],
      },
      {
        hasSampleSolution: false,
        restrictions: { maxLength: 0 },
      },
    ]) {
      expectInvalid(() =>
        canonicalizeElementOptions({ type: ElementType.FREE_TEXT, options })
      )
    }
  })

  it('preserves free-text Unicode scoring semantics during canonicalization', () => {
    const decomposedSolution = 'e\u0301'
    const canonical = canonicalizeElementOptions({
      type: ElementType.FREE_TEXT,
      options: {
        hasSampleSolution: true,
        solutions: [` ${decomposedSolution} `],
      },
    })

    expect(canonical.options.solutions).toEqual([decomposedSolution])
    expect(
      gradeQuestionFreeText({
        response: decomposedSolution,
        solutions: canonical.options.solutions,
      })
    ).toBe(1)
  })

  it('enforces selection integers, pool bounds, uniqueness, and membership', () => {
    const canonical = canonicalizeElementAuthoringOptions(
      ElementType.SELECTION,
      {
        hasSampleSolution: true,
        answerCollection: 7,
        numberOfInputs: 2,
        correctAnswers: [10, 20, 30],
      },
      { poolIds: [10, 20, 30, 40] }
    )
    expect(canonical.relations).toEqual({
      answerCollectionId: 7,
      selectedIds: [10, 20, 30],
    })

    expect(
      canonicalizeElementAuthoringOptions(
        ElementType.SELECTION,
        {
          hasSampleSolution: false,
          answerCollection: 7,
          numberOfInputs: 1,
          correctAnswers: [99, 99],
        },
        { poolIds: [10, 20] }
      ).relations
    ).toEqual({ answerCollectionId: 7, selectedIds: [] })
    expect(
      canonicalizeElementOptions({
        type: ElementType.SELECTION,
        options: { hasSampleSolution: false, numberOfInputs: 1 },
        relations: {
          answerCollectionId: 'collection-1',
          poolIds: ['entry-1'],
          selectedIds: ['foreign-entry', 'foreign-entry'],
        },
      }).relations
    ).toEqual({ answerCollectionId: 'collection-1', selectedIds: [] })

    for (const options of [
      {
        hasSampleSolution: true,
        answerCollection: 7,
        numberOfInputs: 1.5,
        correctAnswers: [10, 20],
      },
      {
        hasSampleSolution: true,
        answerCollection: 7,
        numberOfInputs: 3,
        correctAnswers: [10, 20, 30],
      },
      {
        hasSampleSolution: true,
        answerCollection: 7,
        numberOfInputs: 1,
        correctAnswers: [10, 10],
      },
      {
        hasSampleSolution: true,
        answerCollection: 7,
        numberOfInputs: 1,
        correctAnswers: [99],
      },
    ]) {
      expectInvalid(() =>
        canonicalizeElementAuthoringOptions(ElementType.SELECTION, options, {
          poolIds: [10, 20],
        })
      )
    }
  })

  it('enforces case-study identifiers, bounds, and exact solution coverage', () => {
    const canonical = canonicalizeElementAuthoringOptions(
      ElementType.CASE_STUDY,
      {
        ...caseStudyOptions,
        answerCollection: 7,
        collectionItemIds: [10, 20],
      },
      { poolIds: [10, 20, 30] }
    )
    expect(canonical.options).toMatchObject({
      criteria: [{ id: 'criterion-1', name: 'Quality' }],
      cases: [{ id: 'case-1', title: 'Case 1' }],
    })

    const invalidOptions = [
      {
        ...caseStudyOptions,
        criteria: [{ ...caseStudyOptions.criteria[0], id: '__proto__' }],
      },
      {
        ...caseStudyOptions,
        criteria: [{ ...caseStudyOptions.criteria[0], step: 0 }],
      },
      {
        ...caseStudyOptions,
        criteria: [
          { ...caseStudyOptions.criteria[0], min: 0, max: 10, step: 5 },
        ],
        cases: [
          {
            ...caseStudyOptions.cases[0],
            solutions: caseStudyOptions.cases[0]!.solutions.map((solution) => ({
              ...solution,
              criteriaSolutions: [
                { criterionId: 'criterion-1', min: 1, max: 2 },
              ],
            })),
          },
        ],
      },
      {
        ...caseStudyOptions,
        criteria: [
          {
            ...caseStudyOptions.criteria[0],
            min: 0,
            max: 1e30,
            step: 1e20,
          },
        ],
        cases: [
          {
            ...caseStudyOptions.cases[0],
            solutions: caseStudyOptions.cases[0]!.solutions.map((solution) => ({
              ...solution,
              criteriaSolutions: [
                { criterionId: 'criterion-1', min: 1, max: 2 },
              ],
            })),
          },
        ],
      },
      {
        ...caseStudyOptions,
        cases: [
          {
            ...caseStudyOptions.cases[0],
            solutions: [caseStudyOptions.cases[0]!.solutions[0]!],
          },
        ],
      },
      {
        ...caseStudyOptions,
        cases: [
          {
            ...caseStudyOptions.cases[0],
            solutions: [
              {
                ...caseStudyOptions.cases[0]!.solutions[0]!,
                criteriaSolutions: [
                  { criterionId: 'criterion-1', min: -1, max: 5 },
                ],
              },
              caseStudyOptions.cases[0]!.solutions[1]!,
            ],
          },
        ],
      },
    ]

    for (const options of invalidOptions) {
      expectInvalid(() =>
        canonicalizeElementAuthoringOptions(
          ElementType.CASE_STUDY,
          {
            ...options,
            answerCollection: 7,
            collectionItemIds: [10, 20],
          } as any,
          { poolIds: [10, 20, 30] }
        )
      )
    }
  })

  it('canonicalizes non-question semantics and requires flashcard explanations', () => {
    const content = canonicalizeElementDomain({
      type: ElementType.CONTENT,
      content: 'Content',
      explanation: 'Optional explanation',
      basePoints: true,
      pointsMultiplier: 2,
      options: {},
    })
    expect(content).toMatchObject({ basePoints: false, pointsMultiplier: 2 })

    const flashcard = canonicalizeElementDomain({
      type: ElementType.FLASHCARD,
      content: 'Front',
      explanation: 'Back',
      basePoints: true,
      pointsMultiplier: 1,
      options: {},
    })
    expect(flashcard.basePoints).toBe(false)

    expectInvalid(() =>
      canonicalizeElementDomain({
        type: ElementType.FLASHCARD,
        content: 'Front',
        explanation: '   ',
        basePoints: false,
        pointsMultiplier: 1,
        options: {},
      })
    )
    expectInvalid(() =>
      canonicalizeElementDomain({
        type: ElementType.CONTENT,
        content: 'Content',
        basePoints: false,
        pointsMultiplier: 1,
        options: { arbitrary: true },
      })
    )
  })

  it('validates the complete canonical domain for full and partial authoring updates', () => {
    for (const { type, options, relations } of canonicalOptionsCases) {
      const explanation =
        type === ElementType.FLASHCARD ? 'Flashcard back' : 'Explanation'
      const direct = canonicalizeElementDomain({
        type,
        content: 'Authored content',
        explanation,
        basePoints: true,
        pointsMultiplier: 2,
        options,
        relations,
      })
      const authored = canonicalizeElementDomainUpdate({
        type,
        content: 'Authored content',
        explanation,
        basePoints: true,
        pointsMultiplier: 2,
        options,
        relations,
      })

      expect(authored).toEqual(direct)
    }

    const previous = {
      content: 'Persisted content',
      explanation: 'Persisted explanation',
      basePoints: true,
      pointsMultiplier: 3,
    }
    expect(
      canonicalizeElementDomainUpdate({
        type: ElementType.SC,
        explanation: null,
        options: choiceOptions,
        previous,
      })
    ).toMatchObject({
      content: 'Persisted content',
      explanation: null,
      basePoints: true,
      pointsMultiplier: 3,
    })

    expectInvalid(() =>
      canonicalizeElementDomainUpdate({
        type: ElementType.CONTENT,
        content: '   ',
        options: {},
      })
    )
    expectInvalid(() =>
      canonicalizeElementDomainUpdate({
        type: ElementType.SC,
        content: undefined,
        options: choiceOptions,
      })
    )
  })

  it('applies authoring-only non-question defaults before canonicalization', () => {
    expect(
      canonicalizeElementDomainUpdate({
        type: ElementType.CONTENT,
        content: 'Content',
        options: {},
      })
    ).toMatchObject({ basePoints: false, pointsMultiplier: 1 })
    expect(
      canonicalizeElementDomainUpdate({
        type: ElementType.FLASHCARD,
        content: 'Front',
        explanation: 'Back',
        options: {},
      })
    ).toMatchObject({ basePoints: false, pointsMultiplier: 1 })
  })

  it('provides strict package trust-boundary schemas for all nine types', () => {
    for (const { type, options } of canonicalOptionsCases) {
      const packageOptions =
        type === ElementType.CASE_STUDY
          ? {
              ...options,
              cases: options.cases.map((caseItem: any) => ({
                ...caseItem,
                solutions: caseItem.solutions.map((solution: any) => {
                  const { itemId, ...rest } = solution
                  return { ...rest, itemRef: `entry-${itemId}` }
                }),
              })),
            }
          : options
      const schema = createCanonicalElementOptionsSchema(
        type,
        type === ElementType.CASE_STUDY ? 'itemRef' : 'itemId'
      )

      expect(schema.safeParse(packageOptions).success, type).toBe(true)
      expect(
        schema.safeParse({ ...packageOptions, unexpected: true }).success,
        type
      ).toBe(false)
    }
  })

  it('does not convert unexpected canonical adapter failures into authored-data errors', () => {
    const unexpected = new Error('unexpected canonical adapter failure')
    const proxiedOptions = new Proxy(choiceOptions, {
      ownKeys() {
        throw unexpected
      },
    })

    expect(() =>
      createCanonicalElementOptionsSchema(ElementType.SC).parse(proxiedOptions)
    ).toThrow(unexpected)
  })

  it('keeps authoring and package adapters equivalent for every valid type', () => {
    for (const { type, options, relations } of canonicalOptionsCases) {
      const direct = canonicalizeElementOptions({ type, options, relations })
      const authored =
        type === ElementType.SELECTION
          ? canonicalizeElementAuthoringOptions(
              type,
              {
                ...options,
                answerCollection: relations.answerCollectionId,
                correctAnswers: relations.selectedIds,
              },
              { poolIds: relations.poolIds }
            )
          : type === ElementType.CASE_STUDY
            ? canonicalizeElementAuthoringOptions(
                type,
                {
                  ...options,
                  answerCollection: relations.answerCollectionId,
                  collectionItemIds: relations.selectedIds,
                },
                { poolIds: relations.poolIds }
              )
            : canonicalizeElementAuthoringOptions(type, options)

      expect(authored).toEqual(direct)
    }
  })

  it('rejects the same invalid payloads through authoring and package adapters', () => {
    const invalidCases: Array<{
      type: ElementType
      options: any
      relations?: any
      authoringOptions?: any
    }> = [
      {
        type: ElementType.SC,
        options: { ...choiceOptions, unexpected: true },
      },
      {
        type: ElementType.MC,
        options: {
          ...choiceOptions,
          choices: [choice(0, false), choice(1, false)],
        },
      },
      {
        type: ElementType.KPRIM,
        options: {
          ...choiceOptions,
          choices: [choice(0, true), choice(1, false)],
        },
      },
      {
        type: ElementType.NUMERICAL,
        options: {
          hasSampleSolution: true,
          exactSolutions: [Number.POSITIVE_INFINITY],
        },
      },
      {
        type: ElementType.FREE_TEXT,
        options: { hasSampleSolution: true, solutions: ['   '] },
      },
      {
        type: ElementType.SELECTION,
        options: { hasSampleSolution: false, numberOfInputs: 0 },
        relations: {
          answerCollectionId: 1,
          poolIds: [10],
          selectedIds: [],
        },
        authoringOptions: {
          hasSampleSolution: false,
          answerCollection: 1,
          numberOfInputs: 0,
          correctAnswers: [],
        },
      },
      {
        type: ElementType.CASE_STUDY,
        options: {
          ...caseStudyOptions,
          criteria: [{ ...caseStudyOptions.criteria[0], id: 'constructor' }],
        },
        relations: {
          answerCollectionId: 1,
          poolIds: [10, 20],
          selectedIds: [10, 20],
          caseSolutionReferenceKey: 'itemId',
        },
      },
      { type: ElementType.CONTENT, options: { unexpected: true } },
      { type: ElementType.FLASHCARD, options: { unexpected: true } },
    ]

    for (const { type, options, relations, authoringOptions } of invalidCases) {
      expectInvalid(() =>
        canonicalizeElementOptions({ type, options, relations })
      )
      expectInvalid(() =>
        type === ElementType.SELECTION
          ? canonicalizeElementAuthoringOptions(type, authoringOptions, {
              poolIds: relations.poolIds,
            })
          : type === ElementType.CASE_STUDY
            ? canonicalizeElementAuthoringOptions(
                type,
                {
                  ...options,
                  answerCollection: relations.answerCollectionId,
                  collectionItemIds: relations.selectedIds,
                },
                { poolIds: relations.poolIds }
              )
            : canonicalizeElementAuthoringOptions(type, options)
      )
    }
  })

  it('preserves representative grading behavior after canonicalization', () => {
    const rawChoices = {
      ...choiceOptions,
      choices: [choice(1, false), choice(0, true)],
    }
    const canonicalChoices = canonicalizeElementOptions({
      type: ElementType.SC,
      options: rawChoices,
    }).options as typeof rawChoices
    const choiceResponse = [
      { ix: 0, selected: true },
      { ix: 1, selected: false },
    ]
    expect(
      gradeQuestionSC({
        responseCount: 2,
        response: choiceResponse,
        solution: rawChoices.choices
          .filter((entry) => entry.correct)
          .map((entry) => entry.ix),
      })
    ).toBe(
      gradeQuestionSC({
        responseCount: 2,
        response: choiceResponse,
        solution: canonicalChoices.choices
          .filter((entry) => entry.correct)
          .map((entry) => entry.ix),
      })
    )

    const rawNumerical = {
      hasSampleSolution: true,
      restrictions: { min: -0, max: 10 },
      exactSolutions: [-0],
    }
    const canonicalNumerical = canonicalizeElementOptions({
      type: ElementType.NUMERICAL,
      options: rawNumerical,
    }).options as typeof rawNumerical
    expect(gradeQuestionNumerical({ response: 0, ...rawNumerical })).toBe(
      gradeQuestionNumerical({ response: 0, ...canonicalNumerical })
    )

    const rawFreeText = {
      hasSampleSolution: true,
      solutions: [' Answer '],
    }
    const canonicalFreeText = canonicalizeElementOptions({
      type: ElementType.FREE_TEXT,
      options: rawFreeText,
    }).options as typeof rawFreeText
    expect(gradeQuestionFreeText({ response: 'answer', ...rawFreeText })).toBe(
      gradeQuestionFreeText({ response: 'answer', ...canonicalFreeText })
    )

    const rawSelection = {
      hasSampleSolution: true,
      answerCollection: 1,
      numberOfInputs: 2,
      correctAnswers: [10, 20, 30],
    }
    const canonicalSelection = canonicalizeElementAuthoringOptions(
      ElementType.SELECTION,
      rawSelection,
      { poolIds: [10, 20, 30, 40] }
    )
    expect(
      gradeQuestionSelection({
        numberOfInputs: rawSelection.numberOfInputs,
        response: [10, 40],
        correctAnswers: rawSelection.correctAnswers,
      })
    ).toBe(
      gradeQuestionSelection({
        numberOfInputs: canonicalSelection.options.numberOfInputs as number,
        response: [10, 40],
        correctAnswers: canonicalSelection.relations.selectedIds as number[],
      })
    )
  })
})
