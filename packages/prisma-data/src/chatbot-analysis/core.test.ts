import { describe, expect, it } from 'vitest'

import {
  type AnalysisMessage,
  buildExchanges,
  calculateRatingCoverage,
  type EligibilityDecision,
  runAnalysisCore,
  selectEligibleMessages,
} from './core.js'

const window = {
  from: new Date('2026-08-01T00:00:00.000Z'),
  to: new Date('2026-08-01T23:59:59.999Z'),
}

function message(
  id: string,
  overrides: Partial<AnalysisMessage> = {}
): AnalysisMessage {
  return {
    id,
    threadId: 'thread-1',
    participantId: 'participant-1',
    chatbotId: 'chatbot-1',
    courseId: 'course-1',
    parentId: null,
    role: 'user',
    createdAt: new Date('2026-08-01T10:00:00.000Z'),
    rating: null,
    text: id,
    attachmentCount: 0,
    creditsUsed: null,
    ...overrides,
  }
}

function eligible(
  overrides: Partial<EligibilityDecision> = {}
): EligibilityDecision {
  return {
    participantId: 'participant-1',
    purpose: 'learning-analytics',
    courseId: 'course-1',
    effectiveFrom: new Date('2026-08-01T00:00:00.000Z'),
    effectiveTo: null,
    eligible: true,
    ...overrides,
  }
}

describe('chatbot analysis core', () => {
  it('fails closed for missing, withdrawn, and mismatched eligibility', () => {
    const records = [
      message('eligible'),
      message('withdrawn', { participantId: 'participant-2' }),
      message('research-only', { participantId: 'participant-3' }),
      message('before-opt-in', {
        participantId: 'participant-4',
        createdAt: new Date('2026-07-31T23:59:59.999Z'),
      }),
      message('no-decision', { participantId: 'participant-5' }),
    ]
    const decisions = [
      eligible(),
      eligible({ participantId: 'participant-2', eligible: false }),
      eligible({ participantId: 'participant-3', purpose: 'research' }),
      eligible({
        participantId: 'participant-4',
        effectiveFrom: new Date('2026-08-01T00:00:00.000Z'),
      }),
    ]

    const result = selectEligibleMessages(
      records,
      decisions,
      'learning-analytics',
      window
    )

    expect(result.messages.map((record) => record.id)).toEqual(['eligible'])
    expect(result.excludedMessageIds).toEqual([
      'withdrawn',
      'research-only',
      'before-opt-in',
      'no-decision',
    ])
  })

  it('lets a covering withdrawal veto an otherwise valid grant', () => {
    const record = message('withdrawn-after-grant')
    const result = selectEligibleMessages(
      [record],
      [
        eligible(),
        eligible({
          eligible: false,
          effectiveFrom: new Date('2026-08-01T09:00:00.000Z'),
        }),
      ],
      'learning-analytics',
      window
    )

    expect(result.messages).toEqual([])
    expect(result.excludedMessageIds).toEqual(['withdrawn-after-grant'])
  })

  it('links a unique assistant child and preserves an outside-window child', () => {
    const user = message('user')
    const assistant = message('assistant', {
      role: 'assistant',
      parentId: 'user',
      createdAt: new Date('2026-08-01T10:01:00.000Z'),
      rating: 'UP',
    })
    const outsideWindow = message('outside', {
      role: 'assistant',
      parentId: 'user',
      createdAt: new Date('2026-08-02T10:01:00.000Z'),
    })

    const [linked] = buildExchanges([user, assistant], window)
    const [outsideExchange] = buildExchanges([user, outsideWindow], window)

    expect(linked?.status).toBe('linked')
    expect(linked?.assistantMessage?.id).toBe('assistant')
    expect(outsideExchange?.status).toBe('outside_window')
    expect(outsideExchange?.assistantMessage).toBeNull()
    expect(outsideExchange?.candidateAssistantIds).toEqual(['outside'])
  })

  it('marks regenerated answers ambiguous instead of choosing by timestamp', () => {
    const user = message('user')
    const first = message('assistant-a', {
      role: 'assistant',
      parentId: 'user',
      createdAt: new Date('2026-08-01T10:01:00.000Z'),
    })
    const second = message('assistant-b', {
      role: 'assistant',
      parentId: 'user',
      createdAt: new Date('2026-08-01T10:02:00.000Z'),
    })

    const [exchange] = buildExchanges([user, first, second], window)

    expect(exchange?.status).toBe('ambiguous')
    expect(exchange?.assistantMessage).toBeNull()
    expect(exchange?.candidateAssistantIds).toEqual([
      'assistant-a',
      'assistant-b',
    ])
  })

  it('reports rating coverage without treating unrated responses as neutral', () => {
    const user = message('user')
    const secondUser = message('user-2', {
      createdAt: new Date('2026-08-01T10:01:30.000Z'),
    })
    const up = message('up', {
      role: 'assistant',
      parentId: 'user',
      rating: 'UP',
      createdAt: new Date('2026-08-01T10:01:00.000Z'),
    })
    const down = message('down', {
      role: 'assistant',
      parentId: 'user-2',
      rating: 'DOWN',
      createdAt: new Date('2026-08-01T10:02:00.000Z'),
    })

    const coverage = calculateRatingCoverage(
      buildExchanges([user, secondUser, up, down], window)
    )

    expect(coverage).toEqual({
      ratedResponses: 2,
      unratedResponses: 0,
      up: 1,
      down: 1,
      coverage: 1,
    })
  })

  it('passes the purpose and window to the provider before producing a result', async () => {
    const user = message('user')
    const assistant = message('assistant', {
      role: 'assistant',
      parentId: 'user',
      createdAt: new Date('2026-08-01T10:01:00.000Z'),
    })
    const calls: Array<{
      purpose: string
      from: Date
      to: Date
    }> = []

    const result = await runAnalysisCore(
      {
        loadMessages: async (input) => {
          expect(input).toEqual(window)
          return [user, assistant]
        },
        loadEligibility: async (input) => {
          calls.push({ purpose: input.purpose, from: input.from, to: input.to })
          return [eligible()]
        },
      },
      { purpose: 'learning-analytics', window }
    )

    expect(calls).toEqual([
      { purpose: 'learning-analytics', from: window.from, to: window.to },
    ])
    expect(result.exchanges[0]?.status).toBe('linked')
  })

  it('uses a bounded parent closure to classify an outside-window response', async () => {
    const user = message('user')
    const assistant = message('assistant', {
      role: 'assistant',
      parentId: 'user',
      createdAt: new Date('2026-08-02T10:01:00.000Z'),
    })

    const result = await runAnalysisCore(
      {
        loadMessages: async () => [user, assistant],
        loadEligibility: async () => [eligible()],
      },
      { purpose: 'learning-analytics', window }
    )

    expect(result.exchanges[0]?.status).toBe('outside_window')
    expect(result.exchanges[0]?.assistantMessage).toBeNull()
  })

  it('does not rescue an in-window assistant excluded by eligibility', async () => {
    const user = message('user')
    const assistant = message('assistant', {
      role: 'assistant',
      parentId: 'user',
      createdAt: new Date('2026-08-01T10:01:00.000Z'),
      rating: 'DOWN',
    })

    const result = await runAnalysisCore(
      {
        loadMessages: async () => [user, assistant],
        loadEligibility: async () => [
          eligible({ effectiveTo: new Date('2026-08-01T10:00:00.000Z') }),
        ],
      },
      { purpose: 'learning-analytics', window }
    )

    expect(result.exchanges[0]?.status).toBe('absent')
    expect(result.exchanges[0]?.assistantMessage).toBeNull()
    expect(result.ratingCoverage).toEqual({
      ratedResponses: 0,
      unratedResponses: 0,
      up: 0,
      down: 0,
      coverage: 0,
    })
  })
})
