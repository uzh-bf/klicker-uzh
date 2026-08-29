import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test, vi } from 'vitest'

const renderingMocks = vi.hoisted(() => ({ markdown: vi.fn() }))

vi.mock('@klicker-uzh/markdown', () => ({
  Markdown: ({ content }: { content: string }) => {
    renderingMocks.markdown(content)
    return content.replaceAll('**', '').replaceAll('*', '')
  },
}))

vi.mock('@assistant-ui/react', () => ({
  useAuiState: (selector: (state: { message: { id: string } }) => unknown) =>
    selector({ message: { id: 'candidate-message' } }),
}))

vi.mock('next/navigation', () => ({
  useParams: () => ({ chatbotId: 'chatbot-1' }),
}))

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock('@/src/stores/chatStore', () => ({
  useChatStore: (
    selector: (state: {
      activeThreadId: string
      threads: Array<{ id: string; messages: never[] }>
    }) => unknown
  ) =>
    selector({
      activeThreadId: 'thread-1',
      threads: [{ id: 'thread-1', messages: [] }],
    }),
}))

vi.mock('@/src/components/message-sources-context', () => ({
  useMessageSourcesContext: () => ({
    messageId: 'candidate-message',
    sources: [
      {
        id: 'candidate:candidate-1:source-1',
        index: 1,
        type: 'document',
        title: 'Course reader',
        page: 12,
        url: 'https://example.org/course-reader.pdf#page=12',
        elementReference: {
          sourceId: 'source-1',
          kind: 'DOCUMENT',
          title: 'Course reader',
          canonicalUrl: 'https://example.org/course-reader.pdf',
          chunkIds: ['chunk-1'],
          locators: [{ type: 'PAGE_RANGE', pageFrom: 12, pageTo: 12 }],
        },
      },
    ],
  }),
}))

vi.mock('@/src/components/citation-chip', () => ({
  CitationChip: ({ index }: { index: number }) => `[${index}]`,
}))

vi.mock('@/src/components/source-preview-content', () => ({
  SourcePreviewContent: ({ source }: { source: { title: string } }) =>
    source.title,
}))

import {
  CandidateCards,
  fetchCandidateDecisionState,
  shouldExposeCandidateDecisionState,
  shouldLoadCandidateDecisionState,
} from '../src/components/personal-elements/CandidateCards'
import { PlanCard } from '../src/components/personal-elements/PlanCard'
import { PersonalElementsProvider } from '../src/components/personal-elements/runtime-context'

describe('personal-element cards', () => {
  test('loads durable decisions only after the generation part completes', () => {
    expect(
      shouldExposeCandidateDecisionState(
        'running',
        'message:tool',
        'message:tool'
      )
    ).toBe(false)
    expect(
      shouldExposeCandidateDecisionState(
        'complete',
        'previous:tool',
        'message:tool'
      )
    ).toBe(false)
    expect(
      shouldExposeCandidateDecisionState(
        'complete',
        'message:tool',
        'message:tool'
      )
    ).toBe(true)
    expect(
      shouldLoadCandidateDecisionState(
        'complete',
        'complete',
        [],
        'candidate-message',
        'generation-tool'
      )
    ).toBe(false)
    expect(
      shouldLoadCandidateDecisionState(
        'complete',
        'running',
        [
          {
            id: 'candidate-message',
            content: [
              {
                type: 'tool-call',
                toolName: 'generate_cards',
                toolCallId: 'generation-tool',
              },
            ],
          },
        ],
        'candidate-message',
        'generation-tool'
      )
    ).toBe(false)
    expect(
      shouldLoadCandidateDecisionState(
        'complete',
        'complete',
        [
          {
            id: 'candidate-message',
            content: [
              {
                type: 'tool-call',
                toolName: 'generate_cards',
                toolCallId: 'generation-tool',
              },
            ],
          },
        ],
        'candidate-message',
        'generation-tool'
      )
    ).toBe(true)
  })

  test('retries a transient decision-state response before exposing state', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: vi.fn(),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({
          courseId: 'course-1',
          elements: [{ candidateId: 'candidate-1' }],
          discardedCandidateIds: [],
        }),
      })
    const sleep = vi.fn().mockResolvedValue(undefined)

    await expect(
      fetchCandidateDecisionState('/decision-state', fetcher, sleep)
    ).resolves.toEqual({
      courseId: 'course-1',
      elements: [{ candidateId: 'candidate-1' }],
      discardedCandidateIds: [],
    })
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(sleep).toHaveBeenCalledWith(250)
  })

  test('renders candidate Markdown and its card-local source reference', () => {
    const html = renderToStaticMarkup(
      createElement(CandidateCards, {
        part: {
          toolCallId: 'generation-tool',
          toolName: 'generate_cards',
          status: { type: 'complete' },
          result: {
            status: 'completed',
            completed: 1,
            total: 1,
            candidates: [
              {
                type: 'FLASHCARD',
                candidateId: 'candidate-1',
                name: 'Grounded card',
                content: '**Front** with reference [1].',
                explanation: '*Back* with evidence.',
                sourceMessageId: 'candidate-message',
                sourceToolCallId: 'generation-tool',
                sources: [
                  {
                    sourceId: 'source-1',
                    kind: 'DOCUMENT',
                    title: 'Course reader',
                    canonicalUrl: 'https://example.org/course-reader.pdf',
                    chunkIds: ['chunk-1'],
                    locators: [
                      { type: 'PAGE_RANGE', pageFrom: 12, pageTo: 12 },
                    ],
                  },
                ],
              },
            ],
          },
        },
      })
    )

    expect(renderingMocks.markdown).toHaveBeenCalledWith(
      '**Front** with reference [1].'
    )
    expect(renderingMocks.markdown).toHaveBeenCalledWith(
      '*Back* with evidence.'
    )
    expect(html).toContain('Front with reference [1].')
    expect(html).toContain('Back with evidence.')
    expect(html).not.toContain('**Front**')
    expect(html).not.toContain('*Back*')
    expect(html).toContain('data-cy="personal-element-references"')
    expect(html).toContain('Course reader')
    expect(html).toContain('[1]')
  })

  test('renders the final accepted plan without another approval control', () => {
    const html = renderToStaticMarkup(
      PersonalElementsProvider({
        value: {
          approvePlan: vi.fn(),
          getPlanStatus: () => 'accepted' as const,
        },
        children: createElement(PlanCard, {
          part: {
            toolCallId: 'plan-tool',
            argsText: JSON.stringify({
              topic: 'Diversification',
              cards: [
                {
                  type: 'FLASHCARD',
                  candidateId: 'candidate-1',
                  title: 'Portfolio risk',
                },
              ],
            }),
            result: {
              status: 'ready',
              topic: 'Diversification',
              cards: [
                {
                  type: 'FLASHCARD',
                  candidateId: 'candidate-1',
                  title: 'Portfolio risk',
                },
              ],
            },
            status: { type: 'complete' },
          },
        }),
      })
    )

    expect(html).toContain('Diversification')
    expect(html).toContain('Portfolio risk')
    expect(html).toContain('chat.personalElements.accepted')
    expect(html).not.toContain('<button')
    expect(html).not.toContain('chat.personalElements.approve')
  })

  test('does not expose an approval control for a failed plan tool call', () => {
    const html = renderToStaticMarkup(
      PersonalElementsProvider({
        value: {
          approvePlan: vi.fn(),
          getPlanStatus: () => 'current' as const,
        },
        children: createElement(PlanCard, {
          part: {
            toolCallId: 'failed-plan-tool',
            argsText: JSON.stringify({
              topic: 'Invalid preview',
              cards: [{ title: 'Should not be accepted' }],
            }),
            result: 'upstream failure',
            isError: true,
            status: { type: 'complete' },
          },
        }),
      })
    )

    expect(html).toContain('chat.personalElements.planUnavailable')
    expect(html).not.toContain('Invalid preview')
    expect(html).not.toContain('Should not be accepted')
    expect(html).not.toContain('<button')
  })

  test('renders repeated plan titles without duplicate React keys', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const html = renderToStaticMarkup(
        PersonalElementsProvider({
          value: {
            approvePlan: vi.fn(),
            getPlanStatus: () => 'current' as const,
          },
          children: createElement(PlanCard, {
            part: {
              toolCallId: 'repeated-plan-tool',
              argsText: JSON.stringify({
                topic: 'Repeated titles',
                cards: [{ title: 'Same title' }, { title: 'Same title' }],
                discardedDuplicates: [
                  { title: 'Existing title' },
                  { title: 'Existing title' },
                ],
              }),
              status: { type: 'running' },
            },
          }),
        })
      )

      expect(html.match(/Same title/g)).toHaveLength(2)
      expect(html.match(/Existing title/g)).toHaveLength(2)
      expect(consoleError).not.toHaveBeenCalled()
    } finally {
      consoleError.mockRestore()
    }
  })
})
