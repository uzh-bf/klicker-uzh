import { describe, expect, test } from 'vitest'
import {
  getPlanStatusInMessages,
  isFailedCandidateAttemptInMessages,
  isPlanCurrentInMessages,
} from '../src/components/personal-elements/runtime-context'

const plan = { messageId: 'plan-message', toolCallId: 'plan-tool' }
const planMessage = {
  id: plan.messageId,
  content: [
    {
      type: 'tool-call',
      toolCallId: plan.toolCallId,
      toolName: 'propose_card_plan',
      result: { planId: 'plan-1' },
    },
  ],
}

describe('personal-elements runtime', () => {
  test('keeps the plan current after aborted or failed generation', () => {
    const attempts = [
      [
        {
          type: 'tool-call',
          toolCallId: 'generation-tool',
          toolName: 'generate_cards',
          result: {
            planId: 'plan-1',
            status: 'partial',
            completed: 1,
            total: 2,
            candidates: [{ candidateId: 'aborted-candidate' }],
          },
        },
        { type: 'data', name: 'chat-stopped', data: {} },
      ],
      [
        {
          type: 'tool-call',
          toolCallId: 'generation-tool',
          toolName: 'generate_cards',
          result: 'Tool execution failed',
          isError: true,
        },
      ],
      [
        {
          type: 'tool-call',
          toolCallId: 'generation-tool',
          toolName: 'generate_cards',
          result: {
            planId: 'plan-1',
            status: 'error',
            completed: 0,
            total: 1,
            candidates: [],
          },
        },
        { type: 'data', name: 'chat-error', data: {} },
      ],
      [
        {
          type: 'tool-call',
          toolCallId: 'generation-tool',
          toolName: 'generate_cards',
          result: { status: 'error', candidates: [] },
        },
      ],
    ]

    for (const content of attempts) {
      expect(
        isPlanCurrentInMessages(plan, [
          planMessage,
          { id: 'generation-attempt', content },
        ])
      ).toBe(true)
    }
  })

  test('keeps a plan current when a partial run has attempted every card', () => {
    expect(
      getPlanStatusInMessages(plan, [
        planMessage,
        {
          id: 'partial-generation',
          content: [
            {
              type: 'tool-call',
              toolCallId: 'generation-tool',
              toolName: 'generate_cards',
              result: {
                planId: 'plan-1',
                status: 'partial',
                completed: 2,
                total: 2,
                candidates: [{ candidateId: 'candidate-1' }],
                failedCards: [
                  { candidateId: 'card-2', code: 'retrieval_unavailable' },
                ],
              },
            },
          ],
        },
      ])
    ).toBe('current')
  })

  test('marks a successfully generated plan as accepted', () => {
    const messages = [
      planMessage,
      {
        id: 'successful-generation',
        content: [
          {
            type: 'tool-call',
            toolCallId: 'generation-tool',
            toolName: 'generate_cards',
            result: {
              planId: 'plan-1',
              status: 'completed',
              completed: 1,
              total: 1,
              candidates: [{ candidateId: 'candidate-1' }],
            },
          },
        ],
      },
    ]

    expect(getPlanStatusInMessages(plan, messages)).toBe('accepted')
    expect(isPlanCurrentInMessages(plan, messages)).toBe(false)
  })

  test('accepts a successful retry after one card was already decided', () => {
    const messages = [
      planMessage,
      {
        id: 'successful-retry',
        content: [
          {
            type: 'tool-call',
            toolCallId: 'retry-tool',
            toolName: 'generate_cards',
            result: {
              planId: 'plan-1',
              status: 'completed',
              completed: 2,
              total: 2,
              candidates: [{ candidateId: 'candidate-2' }],
            },
          },
        ],
      },
    ]

    expect(getPlanStatusInMessages(plan, messages)).toBe('accepted')
  })

  test('supersedes the plan after a newer plan is proposed', () => {
    const messages = [
      planMessage,
      {
        id: 'new-plan',
        content: [
          {
            type: 'tool-call',
            toolCallId: 'new-plan-tool',
            toolName: 'propose_card_plan',
            result: { planId: 'plan-2' },
          },
        ],
      },
    ]

    expect(isPlanCurrentInMessages(plan, messages)).toBe(false)
    expect(getPlanStatusInMessages(plan, messages)).toBe('superseded')
  })

  test('isolates failed sibling generation attempts', () => {
    const messages = [
      planMessage,
      {
        id: 'mixed-generation',
        content: [
          {
            type: 'tool-call',
            toolCallId: 'successful-tool',
            toolName: 'generate_cards',
            result: {
              planId: 'plan-1',
              status: 'completed',
              completed: 1,
              total: 1,
              candidates: [{ candidateId: 'candidate-1' }],
            },
          },
          {
            type: 'tool-call',
            toolCallId: 'failed-tool',
            toolName: 'generate_cards',
            result: { status: 'error' },
          },
        ],
      },
    ]

    expect(
      isFailedCandidateAttemptInMessages(
        messages,
        'mixed-generation',
        'successful-tool',
        'generate_cards'
      )
    ).toBe(false)
    expect(
      isFailedCandidateAttemptInMessages(
        messages,
        'mixed-generation',
        'failed-tool',
        'generate_cards'
      )
    ).toBe(true)
    expect(isPlanCurrentInMessages(plan, messages)).toBe(false)
  })

  test('marks only the failed attempt candidates unavailable after a retry', () => {
    const messages = [
      planMessage,
      {
        id: 'aborted-generation',
        content: [
          {
            type: 'tool-call',
            toolCallId: 'aborted-tool',
            toolName: 'generate_cards',
            result: { candidates: [{ candidateId: 'aborted-candidate' }] },
          },
          { type: 'data', name: 'chat-stopped', data: {} },
        ],
      },
      {
        id: 'successful-generation',
        content: [
          {
            type: 'tool-call',
            toolCallId: 'successful-tool',
            toolName: 'generate_cards',
            result: {
              planId: 'plan-1',
              status: 'completed',
              completed: 1,
              total: 1,
              candidates: [{ candidateId: 'retry-candidate' }],
            },
          },
        ],
      },
    ]

    expect(
      isFailedCandidateAttemptInMessages(
        messages,
        'aborted-generation',
        'aborted-tool',
        'generate_cards'
      )
    ).toBe(true)
    expect(
      isFailedCandidateAttemptInMessages(
        messages,
        'successful-generation',
        'successful-tool',
        'generate_cards'
      )
    ).toBe(false)
    expect(isPlanCurrentInMessages(plan, messages)).toBe(false)
  })

  test('keeps the plan current while generation is still partial', () => {
    const messages = [
      planMessage,
      {
        id: 'partial-generation',
        content: [
          {
            type: 'tool-call',
            toolCallId: 'generation-tool',
            toolName: 'generate_cards',
            result: {
              planId: 'plan-1',
              status: 'partial',
              completed: 1,
              total: 2,
              candidates: [{ candidateId: 'candidate-1' }],
            },
          },
        ],
      },
    ]

    expect(getPlanStatusInMessages(plan, messages)).toBe('current')
  })

  test('requires an exact plan id for terminal generation acceptance', () => {
    const terminal = {
      type: 'tool-call',
      toolCallId: 'generation-tool',
      toolName: 'generate_cards',
      result: {
        status: 'completed',
        completed: 1,
        total: 1,
        candidates: [{ candidateId: 'candidate-1' }],
      },
    }

    expect(
      getPlanStatusInMessages(plan, [
        planMessage,
        { id: 'missing-id-generation', content: [terminal] },
      ])
    ).toBe('current')
    expect(
      getPlanStatusInMessages(plan, [
        planMessage,
        {
          id: 'mismatched-generation',
          content: [
            {
              ...terminal,
              result: { ...terminal.result, planId: 'plan-2' },
            },
          ],
        },
      ])
    ).toBe('current')
  })

  test('retains acceptance when the completed generation is on another branch', () => {
    const generationMessage = {
      id: 'sibling-generation',
      content: [
        {
          type: 'tool-call',
          toolCallId: 'generation-tool',
          toolName: 'generate_cards',
          result: {
            planId: 'plan-1',
            status: 'completed',
            completed: 1,
            total: 1,
            candidates: [{ candidateId: 'candidate-1' }],
          },
        },
      ],
    }

    expect(
      getPlanStatusInMessages(
        plan,
        [planMessage],
        [planMessage, generationMessage]
      )
    ).toBe('accepted')
  })

  test('rejects a plan outside the active message path', () => {
    expect(isPlanCurrentInMessages(plan, [])).toBe(false)
  })
})
