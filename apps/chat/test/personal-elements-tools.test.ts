import { beforeEach, describe, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  listPersonalElements: vi.fn(),
  updatePersonalElement: vi.fn(),
  generateObject: vi.fn(),
}))

vi.mock('../src/lib/server/personalElements/graphqlClient', () => ({
  listPersonalElements: mocks.listPersonalElements,
  updatePersonalElement: mocks.updatePersonalElement,
}))

vi.mock('ai', async () => {
  const actual = await vi.importActual<typeof import('ai')>('ai')
  return { ...actual, generateObject: mocks.generateObject }
})

import {
  buildElementSourceReferences,
  type CardPlan,
  cardPlanInputSchema,
  cardPlanSchema,
  generationCandidateSchema,
  MAX_CARDS,
  normalizeRetrievedChunks,
} from '../src/lib/server/personalElements/contracts'
import {
  createGenerateCardsTool,
  createListPersonalElementsTool,
  createProposeCardPlanTool,
  createRevisePersonalElementTool,
  generationOutputSchema,
  generationResultSchema,
} from '../src/lib/server/personalElements/tools'

const retrieval = {
  sources: [
    {
      file_name: 'Monetary policy',
      source_type: 'document',
      source_url: 'https://example.org/monetary-policy.pdf',
      chunks: [
        {
          chunk_id: 'chunk-1',
          content: 'Synthetic course evidence.',
          page_number: 4,
          labeled_page_number: 'iv',
        },
      ],
    },
  ],
}

const options = {
  participantId: 'participant-1',
  courseId: 'course-1',
  model: {} as never,
  courseLanguage: 'en',
  sourceMessageId: 'assistant-1',
  docQueryTool: {
    execute: vi.fn().mockResolvedValue(retrieval),
  },
  onNestedUsage: vi.fn(),
}

function execute(toolValue: unknown, input: unknown, toolCallId = 'tool-1') {
  return (
    toolValue as {
      execute: (input: unknown, options: { toolCallId: string }) => unknown
    }
  ).execute(input, { toolCallId })
}

function executeStreamingTool(toolValue: unknown) {
  return toolValue as {
    execute: (
      input: unknown,
      options: { toolCallId: string }
    ) => AsyncIterable<unknown>
  }
}

describe('personal-element chat tools', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.generateObject.mockResolvedValue({
      object: {
        status: 'ready',
        card: {
          type: 'FLASHCARD',
          title: 'Revised card',
          front: 'Short answer.',
          back: 'Synthetic explanation.',
          citedChunkIds: ['chunk-1'],
        },
      },
      usage: { inputTokens: 8, outputTokens: 12 },
    })
  })

  test('proposes plan-scoped candidate IDs while keeping UUID plan IDs', async () => {
    const input = {
      topic: 'Monetary policy',
      cards: [
        {
          type: 'FLASHCARD',
          title: 'Rates',
          intent: 'Define rates',
          query: 'rates',
        },
      ],
    }
    const first = (await execute(createProposeCardPlanTool(), input)) as {
      planId: string
      cards: Array<{ candidateId: string }>
    }
    const second = (await execute(createProposeCardPlanTool(), input)) as {
      planId: string
      cards: Array<{ candidateId: string }>
    }

    expect(first.planId).toMatch(/^[0-9a-f-]{36}$/)
    expect(second.planId).toMatch(/^[0-9a-f-]{36}$/)
    expect(first.cards[0]?.candidateId).toBe(`${first.planId}:card-1`)
    expect(second.cards[0]?.candidateId).toBe(`${second.planId}:card-1`)
    expect(first.cards[0]?.candidateId).not.toBe(second.cards[0]?.candidateId)
  })

  test('caps plans at five cards and rejects larger inputs without truncating', () => {
    const card = {
      type: 'FLASHCARD' as const,
      title: 'Card',
      intent: 'Recall the concept',
      query: 'concept',
    }
    expect(
      cardPlanInputSchema.safeParse({
        topic: 'Topic',
        cards: Array.from({ length: MAX_CARDS }, (_, index) => ({
          ...card,
          title: `${card.title} ${index + 1}`,
        })),
      }).success
    ).toBe(true)
    expect(
      cardPlanInputSchema.safeParse({
        topic: 'Topic',
        cards: Array.from({ length: MAX_CARDS + 1 }, (_, index) => ({
          ...card,
          title: `${card.title} ${index + 1}`,
        })),
      }).success
    ).toBe(false)
    expect(
      generationOutputSchema.safeParse({
        status: 'completed',
        planId: '00000000-0000-0000-0000-000000000001',
        completed: MAX_CARDS + 1,
        total: MAX_CARDS + 1,
        candidates: [],
      }).success
    ).toBe(false)
  })

  test('filters potential duplicate titles before approval', async () => {
    const result = (await execute(
      createProposeCardPlanTool({
        existingCardTitles: ['Capital Asset Pricing Model Definition'],
      }),
      {
        topic: 'CAPM',
        cards: [
          {
            type: 'FLASHCARD',
            title: 'CAPM Definition',
            intent: 'Define CAPM',
            query: 'CAPM definition',
          },
          {
            type: 'FLASHCARD',
            title: 'Inflation Drivers',
            intent: 'Explain drivers',
            query: 'inflation drivers',
          },
        ],
      }
    )) as {
      cards: Array<{ title: string }>
      discardedDuplicates: Array<{ title: string }>
    }

    expect(result.cards.map((card) => card.title)).toEqual([
      'Inflation Drivers',
    ])
    expect(result.discardedDuplicates).toEqual([{ title: 'CAPM Definition' }])
  })

  test('rejects a plan made entirely of potential duplicates', async () => {
    await expect(
      execute(
        createProposeCardPlanTool({ existingCardTitles: ['CAPM Definition'] }),
        {
          topic: 'CAPM',
          cards: [
            {
              type: 'FLASHCARD',
              title: 'CAPM Definition',
              intent: 'Define',
              query: 'CAPM',
            },
          ],
        }
      )
    ).resolves.toMatchObject({
      status: 'all_duplicates',
      cards: [],
      discardedDuplicates: [{ title: 'CAPM Definition' }],
    })
  })

  test('loads the saved-title list when the plan tool actually executes', async () => {
    const getExistingCardTitles = vi.fn().mockResolvedValue(['Private card'])

    const result = (await execute(
      createProposeCardPlanTool({ getExistingCardTitles }),
      {
        topic: 'CAPM',
        cards: [
          {
            type: 'FLASHCARD',
            title: 'Private card',
            intent: 'Define CAPM',
            query: 'CAPM',
          },
        ],
      }
    )) as { status: string; cards: unknown[] }

    expect(getExistingCardTitles).toHaveBeenCalledOnce()
    expect(result.status).toBe('all_duplicates')
    expect(result.cards).toEqual([])
  })

  test('rejects a non-substantive back at generation validation', () => {
    expect(
      generationCandidateSchema.safeParse({
        type: 'FLASHCARD',
        title: 'CAPM',
        front: 'Question',
        back: 'x',
        citedChunkIds: ['chunk-1'],
      }).success
    ).toBe(false)
    expect(
      generationCandidateSchema.safeParse({
        type: 'FLASHCARD',
        title: 'CAPM',
        front: 'Question',
        back: 'A substantive answer.',
        citedChunkIds: ['chunk-1'],
      }).success
    ).toBe(true)
  })

  test('requires the flashcard discriminator in generated content', () => {
    const candidate = {
      type: 'FLASHCARD',
      title: 'CAPM',
      front: 'Question',
      back: 'A substantive answer.',
      citedChunkIds: ['chunk-1'],
    }

    expect(generationCandidateSchema.safeParse(candidate).success).toBe(true)
    expect(
      generationCandidateSchema.safeParse({
        ...candidate,
        type: 'MULTIPLE_CHOICE',
      }).success
    ).toBe(false)
  })

  test('rejects non-flashcard plan input and accepted plans', () => {
    const inputCard = {
      type: 'FLASHCARD',
      title: 'CAPM',
      intent: 'Define CAPM',
      query: 'CAPM definition',
    }

    expect(
      cardPlanInputSchema.safeParse({ topic: 'CAPM', cards: [inputCard] })
        .success
    ).toBe(true)
    expect(
      cardPlanInputSchema.safeParse({
        topic: 'CAPM',
        cards: [{ ...inputCard, type: 'MULTIPLE_CHOICE' }],
      }).success
    ).toBe(false)
    expect(
      cardPlanSchema.safeParse({
        planId: '00000000-0000-0000-0000-000000000010',
        topic: 'CAPM',
        cards: [
          {
            ...inputCard,
            type: 'MULTIPLE_CHOICE',
            candidateId: 'plan:card-1',
          },
        ],
      }).success
    ).toBe(false)
  })

  test('keeps page evidence separate from source metadata', () => {
    const normalized = normalizeRetrievedChunks(retrieval)

    expect(normalized.chunks).toEqual([
      {
        sourceId: 'Monetary policy',
        chunkId: 'chunk-1',
        text: 'Synthetic course evidence.',
        kind: 'DOCUMENT',
        title: 'Monetary policy',
        canonicalUrl: 'https://example.org/monetary-policy.pdf',
        page: 4,
        labeledPage: 'iv',
      },
    ])
  })

  test('drops unsafe provider fragments after assembling the exact web target', () => {
    const normalized = normalizeRetrievedChunks({
      sources: [
        {
          source_id: 'course-page',
          source_type: 'web',
          source_url: 'https://example.org/chapter',
          chunks: [
            {
              chunk_id: 'chunk-1',
              content: 'Synthetic course evidence.',
              fragment: '#access_token=temporary',
            },
          ],
        },
      ],
    })

    expect(normalized.chunks[0]).not.toHaveProperty('webAnchor')
    expect(() =>
      buildElementSourceReferences(['chunk-1'], normalized.chunks)
    ).toThrow('Cited web chunk has no provider-supplied anchor')
  })

  test('does not retain credential-bearing URLs as source identity or title', () => {
    const normalized = normalizeRetrievedChunks({
      sources: [
        {
          source_id:
            's3://user:password@bucket/chapter?token=temporary#section',
          title:
            'ftp://user:password@example.org/chapter?token=temporary#section',
          source_type: 'web',
          source_url: 'https://example.org/chapter?sig=temporary',
          chunks: [
            {
              chunk_id: 'chunk-1',
              content: 'Synthetic course evidence.',
            },
          ],
        },
      ],
    })

    expect(normalized.chunks).toMatchObject([
      {
        sourceId: 's3://bucket/chapter',
        title: 'chapter',
      },
    ])
    expect(JSON.stringify(normalized)).not.toContain('password')
    expect(JSON.stringify(normalized)).not.toContain('token=temporary')
    expect(JSON.stringify(normalized)).not.toContain('sig=temporary')
  })

  test('does not replace an unsafe exact chunk anchor with a source-level URL', () => {
    const normalized = normalizeRetrievedChunks({
      sources: [
        {
          source_id: 'course-page',
          source_type: 'web',
          source_url: 'https://example.org/chapter',
          chunks: [
            {
              chunk_id: 'chunk-1',
              content: 'Synthetic course evidence.',
              anchor_url:
                'https://example.org/chapter?token=temporary#section-2',
            },
          ],
        },
      ],
    })

    expect(normalized.chunks[0]).not.toHaveProperty('webAnchor')
  })

  test('groups cited pages into ordered disjoint ranges without source bodies', () => {
    const chunks = [1, 2, 3, 4, 7, 8, 9].map((page) => ({
      chunkId: `chunk-${page}`,
      sourceId: 'script',
      text: `Synthetic evidence on page ${page}`,
      kind: 'DOCUMENT' as const,
      title: 'Course script',
      canonicalUrl: 'https://example.org/course-script.pdf',
      page,
    }))

    const references = buildElementSourceReferences(
      chunks.map(({ chunkId }) => chunkId),
      chunks
    )

    expect(references).toEqual([
      {
        sourceId: 'script',
        kind: 'DOCUMENT',
        title: 'Course script',
        canonicalUrl: 'https://example.org/course-script.pdf',
        chunkIds: chunks.map(({ chunkId }) => chunkId),
        locators: [
          { type: 'PAGE_RANGE', pageFrom: 1, pageTo: 4 },
          { type: 'PAGE_RANGE', pageFrom: 7, pageTo: 9 },
        ],
      },
    ])
    expect(JSON.stringify(references)).not.toContain('Synthetic evidence')
  })

  test('keeps maximum plan prompts out of persisted sources', async () => {
    const query = 'q'.repeat(500)
    const plan: CardPlan = {
      planId: '00000000-0000-0000-0000-000000000006',
      topic: 'Monetary policy',
      cards: [
        {
          type: 'FLASHCARD',
          candidateId: 'card-1',
          title: 'Rates',
          intent: 'Define rates',
          query,
        },
      ],
    }
    const executeDocQuery = vi.fn().mockResolvedValue(retrieval)
    const generated = await (async () => {
      const outputs: unknown[] = []
      for await (const output of executeStreamingTool(
        createGenerateCardsTool({
          ...options,
          approvedPlan: plan,
          docQueryTool: { execute: executeDocQuery },
        })
      ).execute(plan, { toolCallId: 'generate-long-query' })) {
        outputs.push(output)
      }
      return outputs.at(-1) as {
        candidates: Array<{ candidateId: string; sources: unknown[] }>
      }
    })()

    expect(generated.candidates[0]?.sources).toEqual([
      {
        sourceId: 'Monetary policy',
        kind: 'DOCUMENT',
        title: 'Monetary policy',
        canonicalUrl: 'https://example.org/monetary-policy.pdf',
        chunkIds: ['chunk-1'],
        locators: [
          {
            type: 'PAGE_RANGE',
            pageFrom: 4,
            pageTo: 4,
            labelFrom: 'iv',
            labelTo: 'iv',
          },
        ],
      },
    ])

    expect(executeDocQuery.mock.calls.map(([input]) => input.question)).toEqual(
      [query]
    )
  })

  test('lists only the authenticated participant course scope', async () => {
    mocks.listPersonalElements.mockResolvedValue([
      {
        id: 'element-1',
        version: 1,
        name: 'Card',
        content: 'Front',
        explanation: 'Back',
        origin: 'AI_GENERATED',
        nextDueAt: null,
      },
    ])

    const result = await execute(
      createListPersonalElementsTool({
        participantId: options.participantId,
        courseId: options.courseId,
      }),
      { limit: 10 }
    )

    expect(result).toMatchObject({
      elements: [{ id: 'element-1', version: 1 }],
    })
    expect(mocks.listPersonalElements).toHaveBeenCalledWith(
      'course-1',
      'participant-1'
    )
  })

  test('passes through a non-null nextDueAt string from the GraphQL wire', async () => {
    mocks.listPersonalElements.mockResolvedValue([
      {
        id: 'element-1',
        version: 1,
        name: 'Card',
        content: 'Front',
        explanation: 'Back',
        origin: 'AI_GENERATED',
        nextDueAt: '2026-09-01T10:00:00.000Z',
      },
    ])

    const result = await execute(
      createListPersonalElementsTool({
        participantId: options.participantId,
        courseId: options.courseId,
      }),
      { limit: 10 }
    )

    expect(result).toMatchObject({
      elements: [{ id: 'element-1', nextDueAt: '2026-09-01T10:00:00.000Z' }],
    })
  })

  test('returns a stale-version conflict without changing saved content', async () => {
    mocks.listPersonalElements.mockResolvedValue([
      {
        id: '00000000-0000-0000-0000-000000000001',
        version: 1,
        name: 'Card',
        content: 'Front',
        explanation: 'Back',
        origin: 'AI_GENERATED',
        nextDueAt: null,
      },
    ])
    mocks.updatePersonalElement.mockRejectedValue(
      Object.assign(new Error('stale'), {
        extensions: { code: 'PERSONAL_ELEMENT_VERSION_CONFLICT' },
      })
    )

    const result = await execute(
      createRevisePersonalElementTool({ ...options }),
      {
        id: '00000000-0000-0000-0000-000000000001',
        expectedVersion: 1,
        instruction: 'Make it shorter',
      }
    )

    expect(result).toMatchObject({
      status: 'conflict',
      expectedVersion: 1,
      version: 1,
    })
    expect(mocks.updatePersonalElement).toHaveBeenCalledTimes(1)
  })

  test('rejects a generated plan whose card details differ from approval', async () => {
    const plan: CardPlan = {
      planId: '00000000-0000-0000-0000-000000000004',
      topic: 'Monetary policy',
      cards: [
        {
          type: 'FLASHCARD',
          candidateId: 'card-1',
          title: 'Rates',
          intent: 'Define rates',
          query: 'rates',
        },
      ],
    }
    const executeDocQuery = vi.fn().mockResolvedValue(retrieval)
    const toolValue = createGenerateCardsTool({
      ...options,
      approvedPlan: plan,
      docQueryTool: { execute: executeDocQuery },
    })
    const altered = {
      ...plan,
      cards: [{ ...plan.cards[0], title: 'Unapproved title' }],
    }
    const outputs: unknown[] = []
    for await (const output of executeStreamingTool(toolValue).execute(
      altered,
      {
        toolCallId: 'generate-3',
      }
    )) {
      outputs.push(output)
    }

    expect(outputs).toEqual([
      expect.objectContaining({ status: 'error', candidates: [] }),
    ])
    expect(executeDocQuery).not.toHaveBeenCalled()
  })

  test('retrieves and generates each approved card independently', async () => {
    const plan: CardPlan = {
      planId: '00000000-0000-0000-0000-000000000002',
      topic: 'Monetary policy',
      cards: [
        {
          type: 'FLASHCARD',
          candidateId: 'card-1',
          title: 'Rates',
          intent: 'Define rates',
          query: 'rates',
        },
        {
          type: 'FLASHCARD',
          candidateId: 'card-2',
          title: 'Inflation',
          intent: 'Explain inflation',
          query: 'inflation',
        },
      ],
    }
    const executeDocQuery = vi.fn().mockResolvedValue(retrieval)
    const toolValue = createGenerateCardsTool({
      ...options,
      approvedPlan: plan,
      docQueryTool: { execute: executeDocQuery },
    })
    const outputs: unknown[] = []
    for await (const output of executeStreamingTool(toolValue).execute(plan, {
      toolCallId: 'generate-1',
    })) {
      outputs.push(output)
    }

    expect(executeDocQuery).toHaveBeenCalledTimes(2)
    expect(executeDocQuery.mock.calls.map(([input]) => input.question)).toEqual(
      expect.arrayContaining(['rates', 'inflation'])
    )
    for (const input of executeDocQuery.mock.calls.map(([input]) => input)) {
      expect(input).toEqual({
        question: expect.any(String),
      })
    }
    expect(mocks.generateObject).toHaveBeenCalledTimes(2)
    expect(outputs.at(-1)).toMatchObject({
      status: 'completed',
      completed: 2,
      total: 2,
      candidates: expect.arrayContaining([
        expect.objectContaining({ candidateId: 'card-1', name: 'Rates' }),
        expect.objectContaining({ candidateId: 'card-2' }),
      ]),
    })
  })

  test('skips cards already decided in an earlier partial attempt', async () => {
    const plan: CardPlan = {
      planId: '00000000-0000-0000-0000-000000000007',
      topic: 'Monetary policy',
      cards: [
        {
          type: 'FLASHCARD',
          candidateId: 'card-1',
          title: 'Rates',
          intent: 'Define rates',
          query: 'rates',
        },
        {
          type: 'FLASHCARD',
          candidateId: 'card-2',
          title: 'Inflation',
          intent: 'Explain inflation',
          query: 'inflation',
        },
      ],
    }
    const executeDocQuery = vi.fn().mockResolvedValue(retrieval)
    const outputs: unknown[] = []
    for await (const output of executeStreamingTool(
      createGenerateCardsTool({
        ...options,
        approvedPlan: plan,
        skipCandidateIds: new Set(['card-1']),
        docQueryTool: { execute: executeDocQuery },
      })
    ).execute(plan, { toolCallId: 'generate-retry' })) {
      outputs.push(output)
    }

    expect(executeDocQuery).toHaveBeenCalledTimes(1)
    expect(mocks.generateObject).toHaveBeenCalledTimes(1)
    expect(outputs.at(-1)).toMatchObject({
      status: 'completed',
      completed: 2,
      total: 2,
      candidates: [expect.objectContaining({ candidateId: 'card-2' })],
    })
  })

  test('counts decided cards in a terminal partial retry', async () => {
    const plan: CardPlan = {
      planId: '00000000-0000-0000-0000-000000000008',
      topic: 'Monetary policy',
      cards: [
        {
          type: 'FLASHCARD',
          candidateId: 'card-1',
          title: 'Rates',
          intent: 'Define rates',
          query: 'rates',
        },
        {
          type: 'FLASHCARD',
          candidateId: 'card-2',
          title: 'Inflation',
          intent: 'Explain inflation',
          query: 'inflation',
        },
        {
          type: 'FLASHCARD',
          candidateId: 'card-3',
          title: 'Employment',
          intent: 'Explain employment',
          query: 'employment',
        },
      ],
    }
    const executeDocQuery = vi
      .fn()
      .mockResolvedValueOnce(retrieval)
      .mockRejectedValueOnce(new Error('synthetic retrieval failure'))
    const outputs: unknown[] = []
    for await (const output of executeStreamingTool(
      createGenerateCardsTool({
        ...options,
        approvedPlan: plan,
        skipCandidateIds: new Set(['card-1']),
        docQueryTool: { execute: executeDocQuery },
      })
    ).execute(plan, { toolCallId: 'tool-retry-partial' })) {
      outputs.push(output)
    }

    expect(outputs.at(-1)).toMatchObject({
      status: 'partial',
      completed: 3,
      total: 3,
      candidates: [expect.objectContaining({ candidateId: 'card-2' })],
      failedCards: [{ candidateId: 'card-3', code: 'retrieval_unavailable' }],
    })
  })

  test('returns a partial result when one card retrieval fails', async () => {
    const plan: CardPlan = {
      planId: '00000000-0000-0000-0000-000000000003',
      topic: 'Monetary policy',
      cards: [
        {
          type: 'FLASHCARD',
          candidateId: 'card-1',
          title: 'Rates',
          intent: 'Define rates',
          query: 'rates',
        },
        {
          type: 'FLASHCARD',
          candidateId: 'card-2',
          title: 'Inflation',
          intent: 'Explain inflation',
          query: 'inflation',
        },
      ],
    }
    const executeDocQuery = vi
      .fn()
      .mockResolvedValueOnce(retrieval)
      .mockRejectedValueOnce(new Error('synthetic retrieval failure'))
    const toolValue = createGenerateCardsTool({
      ...options,
      approvedPlan: plan,
      docQueryTool: { execute: executeDocQuery },
    })
    const outputs: unknown[] = []
    for await (const output of executeStreamingTool(toolValue).execute(plan, {
      toolCallId: 'generate-2',
    })) {
      outputs.push(output)
    }

    expect(outputs.at(-1)).toMatchObject({
      status: 'partial',
      completed: 2,
      total: 2,
      failedCards: [{ candidateId: 'card-2', code: 'retrieval_unavailable' }],
    })
  })

  test('returns a retryable error when every card retrieval fails', async () => {
    const plan: CardPlan = {
      planId: '00000000-0000-0000-0000-000000000005',
      topic: 'Monetary policy',
      cards: [
        {
          type: 'FLASHCARD',
          candidateId: 'card-1',
          title: 'Rates',
          intent: 'Define rates',
          query: 'rates',
        },
        {
          type: 'FLASHCARD',
          candidateId: 'card-2',
          title: 'Inflation',
          intent: 'Explain inflation',
          query: 'inflation',
        },
      ],
    }
    const executeDocQuery = vi
      .fn()
      .mockRejectedValue(new Error('synthetic retrieval failure'))
    const toolValue = createGenerateCardsTool({
      ...options,
      approvedPlan: plan,
      docQueryTool: { execute: executeDocQuery },
    })
    const outputs: unknown[] = []
    for await (const output of executeStreamingTool(toolValue).execute(plan, {
      toolCallId: 'generate-4',
    })) {
      outputs.push(output)
    }

    expect(outputs.at(-1)).toMatchObject({
      status: 'error',
      completed: 2,
      total: 2,
      candidates: [],
      failedCards: [
        { candidateId: 'card-1', code: 'retrieval_unavailable' },
        { candidateId: 'card-2', code: 'retrieval_unavailable' },
      ],
    })
  })

  test('uses a bounded failure code for insufficient evidence', async () => {
    const plan: CardPlan = {
      planId: '00000000-0000-0000-0000-000000000009',
      topic: 'Monetary policy',
      cards: [
        {
          type: 'FLASHCARD',
          candidateId: 'card-1',
          title: 'Rates',
          intent: 'Define rates',
          query: 'rates',
        },
      ],
    }
    const outputs: unknown[] = []
    for await (const output of executeStreamingTool(
      createGenerateCardsTool({
        ...options,
        approvedPlan: plan,
        docQueryTool: { execute: vi.fn().mockResolvedValue({ sources: [] }) },
      })
    ).execute(plan, { toolCallId: 'generate-evidence' })) {
      outputs.push(output)
    }

    const result = outputs.at(-1)
    expect(result).toMatchObject({
      status: 'error',
      failedCards: [{ candidateId: 'card-1', code: 'insufficient_evidence' }],
    })
    expect(JSON.stringify(result)).not.toContain('No grounded retrieval')
    expect(generationOutputSchema.safeParse(result).success).toBe(true)
  })

  test('fails closed when the nested model abstains', async () => {
    const plan: CardPlan = {
      planId: '00000000-0000-0000-0000-000000000011',
      topic: 'Monetary policy',
      cards: [
        {
          type: 'FLASHCARD',
          candidateId: 'card-1',
          title: 'Rates',
          intent: 'Define rates',
          query: 'rates',
        },
      ],
    }
    mocks.generateObject.mockResolvedValueOnce({
      object: { status: 'insufficient_evidence' },
      usage: { inputTokens: 5, outputTokens: 1 },
    })
    const outputs: unknown[] = []
    for await (const output of executeStreamingTool(
      createGenerateCardsTool({ ...options, approvedPlan: plan })
    ).execute(plan, { toolCallId: 'generate-abstention' })) {
      outputs.push(output)
    }

    expect(outputs.at(-1)).toMatchObject({
      status: 'error',
      candidates: [],
      failedCards: [{ candidateId: 'card-1', code: 'insufficient_evidence' }],
    })
    expect(
      generationResultSchema.safeParse({
        status: 'insufficient_evidence',
      }).success
    ).toBe(true)
  })

  test('treats missing citation locators as insufficient evidence', async () => {
    const plan: CardPlan = {
      planId: '00000000-0000-0000-0000-000000000012',
      topic: 'Monetary policy',
      cards: [
        {
          type: 'FLASHCARD',
          candidateId: 'card-1',
          title: 'Rates',
          intent: 'Define rates',
          query: 'rates',
        },
      ],
    }
    const retrievalWithoutPage = {
      sources: [
        {
          file_name: 'Synthetic notes',
          source_type: 'document',
          chunks: [
            { chunk_id: 'chunk-1', content: 'Synthetic course evidence.' },
          ],
        },
      ],
    }
    const outputs: unknown[] = []
    for await (const output of executeStreamingTool(
      createGenerateCardsTool({
        ...options,
        approvedPlan: plan,
        docQueryTool: {
          execute: vi.fn().mockResolvedValue(retrievalWithoutPage),
        },
      })
    ).execute(plan, { toolCallId: 'generate-missing-locator' })) {
      outputs.push(output)
    }

    expect(outputs.at(-1)).toMatchObject({
      status: 'error',
      candidates: [],
      failedCards: [{ candidateId: 'card-1', code: 'insufficient_evidence' }],
    })
  })

  test('rejects retrieval protocol markers in generated card content', async () => {
    const plan: CardPlan = {
      planId: '00000000-0000-0000-0000-000000000013',
      topic: 'Monetary policy',
      cards: [
        {
          type: 'FLASHCARD',
          candidateId: 'card-1',
          title: 'Rates',
          intent: 'Define rates',
          query: 'rates',
        },
      ],
    }
    mocks.generateObject.mockResolvedValueOnce({
      object: {
        status: 'ready',
        card: {
          type: 'FLASHCARD',
          title: 'Rates',
          front: 'What does chunk-1 say?',
          back: 'A substantive answer.',
          citedChunkIds: ['chunk-1'],
        },
      },
    })
    const outputs: unknown[] = []
    for await (const output of executeStreamingTool(
      createGenerateCardsTool({ ...options, approvedPlan: plan })
    ).execute(plan, { toolCallId: 'generate-leak' })) {
      outputs.push(output)
    }

    expect(outputs.at(-1)).toMatchObject({
      status: 'error',
      candidates: [],
      failedCards: [{ candidateId: 'card-1', code: 'generation_failed' }],
    })
  })

  test('does not update a saved card when revision evidence is insufficient', async () => {
    mocks.listPersonalElements.mockResolvedValue([
      {
        id: '00000000-0000-0000-0000-000000000014',
        version: 3,
        name: 'Saved card',
        content: 'Front',
        explanation: 'Back',
        origin: 'AI_GENERATED',
        nextDueAt: null,
      },
    ])
    mocks.generateObject.mockResolvedValueOnce({
      object: { status: 'insufficient_evidence' },
    })

    const result = await execute(createRevisePersonalElementTool(options), {
      id: '00000000-0000-0000-0000-000000000014',
      expectedVersion: 3,
      instruction: 'Make it more specific',
    })

    expect(result).toMatchObject({
      status: 'unchanged',
      version: 3,
      reason: 'insufficient_evidence',
    })
    expect(mocks.updatePersonalElement).not.toHaveBeenCalled()
  })

  test('maps model and citation failures to generation_failed', async () => {
    const plan: CardPlan = {
      planId: '00000000-0000-0000-0000-00000000000a',
      topic: 'Monetary policy',
      cards: [
        {
          type: 'FLASHCARD',
          candidateId: 'card-1',
          title: 'Rates',
          intent: 'Define rates',
          query: 'rates',
        },
      ],
    }
    mocks.generateObject.mockRejectedValueOnce(
      new Error('provider response contains private diagnostics')
    )
    const outputs: unknown[] = []
    for await (const output of executeStreamingTool(
      createGenerateCardsTool({ ...options, approvedPlan: plan })
    ).execute(plan, { toolCallId: 'generate-model-error' })) {
      outputs.push(output)
    }

    const result = outputs.at(-1)
    expect(result).toMatchObject({
      status: 'error',
      failedCards: [{ candidateId: 'card-1', code: 'generation_failed' }],
    })
    expect(JSON.stringify(result)).not.toContain('private diagnostics')
  })
})
