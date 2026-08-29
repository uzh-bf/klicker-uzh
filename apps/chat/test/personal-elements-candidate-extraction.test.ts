import { describe, expect, test } from 'vitest'
import { parseStoredGeneratedCardCandidate } from '../src/lib/server/personalElements/contracts'
import {
  extractUnsavedCandidates,
  isFailedGenerationContent,
} from '../src/lib/server/personalElements/history'

const candidate = {
  type: 'FLASHCARD',
  name: 'Card',
  content: 'Front',
  explanation: 'Back',
  sources: [{ sourceId: 'source-1', chunkId: 'chunk-1' }],
  sourceMessageId: 'message-source',
  sourceToolCallId: 'tool-source',
  origin: 'AI_GENERATED',
}

function message(
  id: string,
  result: Record<string, unknown>,
  ...extraParts: unknown[]
) {
  return {
    id,
    parentId: null,
    role: 'assistant',
    createdAt: new Date('2026-08-21T00:00:00Z'),
    content: [
      {
        type: 'tool-call',
        toolCallId: `${id}-tool`,
        toolName: 'generate_cards',
        result,
      },
      ...extraParts,
    ],
  }
}

describe('unsaved candidate extraction', () => {
  test('drops unsafe locators and source bodies from flat stored candidates', () => {
    expect(
      parseStoredGeneratedCardCandidate({
        ...candidate,
        candidateId: 'legacy-candidate',
        sources: [
          {
            sourceId: 'source-1',
            chunkId: 'chunk-1',
            url: 'https://example.org/script.pdf?sig=expired',
            page: 0.5,
            metadata: { excerpt: 'Old source text' },
          },
        ],
      })
    ).toMatchObject({
      sources: [
        {
          sourceId: 'source-1',
          kind: 'DOCUMENT',
          chunkIds: ['chunk-1'],
          locators: [],
        },
      ],
    })
  })

  test('keeps grouped stored candidates when hardened links are removed', () => {
    expect(
      parseStoredGeneratedCardCandidate({
        ...candidate,
        candidateId: 'grouped-candidate',
        sources: [
          {
            sourceId: 'source-1',
            kind: 'WEB',
            title: 'Course page',
            canonicalUrl:
              'https://example.org/chapter#access_token%3Dtemporary',
            chunkIds: ['chunk-1'],
            locators: [
              {
                type: 'WEB_ANCHOR',
                url: 'https://example.org/chapter#access_token%3Dtemporary',
              },
            ],
          },
        ],
      })
    ).toMatchObject({
      sources: [
        {
          sourceId: 'source-1',
          kind: 'WEB',
          title: 'Course page',
          chunkIds: ['chunk-1'],
          locators: [],
        },
      ],
    })
  })

  test('canonicalizes grouped stored locators before save', () => {
    expect(
      parseStoredGeneratedCardCandidate({
        ...candidate,
        candidateId: 'grouped-candidate',
        sources: [
          {
            sourceId: 'source-1',
            kind: 'DOCUMENT',
            title: 'Course script',
            chunkIds: ['chunk-2', 'chunk-1', 'chunk-2'],
            locators: [
              { type: 'PAGE_RANGE', pageFrom: 7, pageTo: 9 },
              { type: 'PAGE_RANGE', pageFrom: 3, pageTo: 4 },
              { type: 'PAGE_RANGE', pageFrom: 4, pageTo: 8 },
            ],
          },
          {
            sourceId: 'source-2',
            kind: 'WEB',
            title: 'Course page',
            chunkIds: ['chunk-3'],
            locators: [
              {
                type: 'WEB_ANCHOR',
                url: 'https://example.org/chapter#section-2',
              },
              {
                type: 'WEB_ANCHOR',
                url: 'https://example.org/chapter#section-2',
              },
            ],
          },
        ],
      })
    ).toMatchObject({
      sources: [
        {
          sourceId: 'source-1',
          chunkIds: ['chunk-2', 'chunk-1'],
          locators: [{ type: 'PAGE_RANGE', pageFrom: 3, pageTo: 9 }],
        },
        {
          sourceId: 'source-2',
          locators: [
            {
              type: 'WEB_ANCHOR',
              url: 'https://example.org/chapter#section-2',
            },
          ],
        },
      ],
    })
  })

  test('excludes candidates that already have saved linkage', () => {
    const messages = [
      message('saved-generation', {
        candidates: [
          { ...candidate, candidateId: 'saved-candidate' },
          { ...candidate, candidateId: 'unsaved-candidate' },
        ],
      }),
    ]

    const result = extractUnsavedCandidates(
      messages,
      new Set(['saved-generation']),
      new Set(['saved-generation']),
      new Set(['saved-candidate'])
    )

    expect([...result.keys()]).toEqual(['unsaved-candidate'])
  })

  test('rejects a persisted candidate with a non-flashcard discriminator', () => {
    const messages = [
      message('wrong-type-generation', {
        candidates: [
          {
            ...candidate,
            type: 'MULTIPLE_CHOICE',
            candidateId: 'wrong-type-candidate',
          },
        ],
      }),
    ]

    expect(
      extractUnsavedCandidates(
        messages,
        new Set(['wrong-type-generation']),
        new Set(['wrong-type-generation'])
      )
    ).toEqual(new Map())
  })

  test('keeps completed attempts and excludes every failed candidate state', () => {
    const messages = [
      message('completed-generation', {
        candidates: [
          { ...candidate, candidateId: 'completed-generation-candidate' },
        ],
      }),
      message(
        'stopped-generation',
        {
          candidates: [
            { ...candidate, candidateId: 'stopped-generation-candidate' },
          ],
        },
        { type: 'data', name: 'chat-stopped', data: {} }
      ),
      message('unapproved-generation', {
        candidates: [
          { ...candidate, candidateId: 'unapproved-generation-candidate' },
        ],
      }),
      {
        ...message('failed-generation', {
          candidates: [
            { ...candidate, candidateId: 'failed-generation-candidate' },
          ],
        }),
        content: [
          {
            type: 'tool-call',
            toolCallId: 'failed-generation-tool',
            toolName: 'generate_cards',
            isError: true,
            result: {
              candidates: [
                { ...candidate, candidateId: 'failed-generation-candidate' },
              ],
            },
          },
        ],
      },
    ]

    const result = extractUnsavedCandidates(
      messages,
      new Set(messages.map(({ id }) => id)),
      new Set(['completed-generation'])
    )

    expect([...result.keys()]).toEqual(['completed-generation-candidate'])
  })

  test('recognizes status:error generation results as failed and retryable', () => {
    const content = [
      {
        type: 'tool-call',
        toolName: 'generate_cards',
        result: { status: 'error', candidates: [] },
      },
    ]

    expect(isFailedGenerationContent(content)).toBe(true)
    expect(
      extractUnsavedCandidates(
        [
          message(
            'failed-generation',
            content[0]!.result as Record<string, unknown>
          ),
        ],
        new Set(['failed-generation']),
        new Set(['failed-generation'])
      )
    ).toEqual(new Map())
  })

  test('recognizes all-card partial failures as failed and retryable', () => {
    const content = [
      {
        type: 'tool-call',
        toolName: 'generate_cards',
        result: {
          status: 'partial',
          total: 2,
          completed: 2,
          candidates: [],
          failedCards: [
            { candidateId: 'card-1', code: 'retrieval_unavailable' },
            { candidateId: 'card-2', code: 'insufficient_evidence' },
          ],
        },
      },
    ]

    expect(isFailedGenerationContent(content)).toBe(true)
  })

  test('does not retain candidates from an unsettled terminal partial run', () => {
    const content = [
      {
        type: 'tool-call',
        toolCallId: 'partial-generation-tool',
        toolName: 'generate_cards',
        result: {
          status: 'partial',
          total: 2,
          completed: 2,
          candidates: [{ ...candidate, candidateId: 'successful-card' }],
          failedCards: [
            { candidateId: 'failed-card', code: 'generation_failed' },
          ],
        },
      },
    ]

    expect(isFailedGenerationContent(content)).toBe(true)
    expect(
      extractUnsavedCandidates(
        [
          message(
            'partial-generation',
            content[0]!.result as Record<string, unknown>
          ),
        ],
        new Set(['partial-generation']),
        new Set()
      )
    ).toEqual(new Map())
  })

  test('retains candidates from a settled terminal partial run', () => {
    const result = {
      status: 'partial',
      settlement: 'partial',
      total: 2,
      completed: 2,
      candidates: [{ ...candidate, candidateId: 'successful-card' }],
      failedCards: [{ candidateId: 'failed-card', code: 'generation_failed' }],
    }

    expect(
      extractUnsavedCandidates(
        [message('settled-partial-generation', result)],
        new Set(['settled-partial-generation']),
        new Set()
      )
    ).toHaveProperty('size', 1)
  })

  test('ignores persisted generation results above the shared card limit', () => {
    const messages = [
      message('oversized-generation', {
        total: 6,
        candidates: Array.from({ length: 6 }, (_, index) => ({
          ...candidate,
          candidateId: `oversized-${index + 1}`,
        })),
      }),
    ]

    expect(
      extractUnsavedCandidates(
        messages,
        new Set(['oversized-generation']),
        new Set(['oversized-generation'])
      )
    ).toEqual(new Map())
  })
})
