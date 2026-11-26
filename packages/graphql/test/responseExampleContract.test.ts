import { describe, expect, it } from 'vitest'
import {
  canApplyResponseExampleAction,
  extractChatbotModes,
  type ResponseExampleAction,
  type ResponseExampleStatus,
  responseExampleActions,
} from '../src/lib/responseExampleContract.js'

describe('response-example mode eligibility', () => {
  it.each([
    null,
    undefined,
    {},
    { explainer: { prompt: 'Synthetic' } },
  ])('offers platform defaults when prompt overrides do not declare all modes', (systemPrompts) => {
    expect(extractChatbotModes(systemPrompts)).toEqual([
      'explainer',
      'quizzer',
      'tutor',
    ])
  })

  it('preserves legacy disablement and other stored mode keys', () => {
    expect(
      extractChatbotModes({
        explainer: { enabled: false },
        custom: { prompt: 'Synthetic' },
      })
    ).toEqual(['custom', 'quizzer', 'tutor'])
  })

  it('uses explicit standard settings ahead of legacy prompt flags', () => {
    expect(
      extractChatbotModes(
        { tutor: { enabled: false }, quizzer: {} },
        { tutorEnabled: true, explainerEnabled: false, quizzerEnabled: false }
      )
    ).toEqual(['tutor'])
  })

  it('does not infer response-example support from Writing Coach configuration', () => {
    expect(
      extractChatbotModes(null, {
        tutorEnabled: false,
        explainerEnabled: false,
        quizzerEnabled: false,
        writingCoachEnabled: true,
      })
    ).toEqual([])
  })

  it('offers Quizzer without a knowledge-base retrieval binding', () => {
    expect(
      extractChatbotModes(null, null, [
        {
          chatMode: 'tutor',
          mcpServerId: 'course',
          allowedTools: ['course_search'],
          parameters: { required: true, toolAlias: 'doc_query' },
        },
      ])
    ).toEqual(['explainer', 'quizzer', 'tutor'])
  })

  it.each([
    {
      name: 'missing bindings',
      bindings: [],
    },
    {
      name: 'wildcard tools',
      bindings: [
        { chatMode: 'tutor', mcpServerId: 'course', allowedTools: ['*'] },
      ],
    },
    {
      name: 'a disabled exact override',
      bindings: [
        {
          chatMode: 'tutor',
          mcpServerId: 'course',
          allowedTools: ['doc_query'],
        },
        {
          chatMode: 'quizzer',
          mcpServerId: 'course',
          allowedTools: ['doc_query'],
          isEnabled: false,
        },
      ],
    },
    {
      name: 'an unsafe exact override',
      bindings: [
        {
          chatMode: 'tutor',
          mcpServerId: 'course',
          allowedTools: ['doc_query'],
        },
        { chatMode: 'quizzer', mcpServerId: 'course', allowedTools: ['*'] },
      ],
    },
    {
      name: 'a required binding with the wrong alias',
      bindings: [
        {
          chatMode: 'tutor',
          mcpServerId: 'course',
          allowedTools: ['doc_query'],
          parameters: { required: true, toolAlias: 'other' },
        },
      ],
    },
  ])('advertises stored Quizzer independently of $name', ({ bindings }) => {
    expect(
      extractChatbotModes(
        { quizzer: {} },
        {
          tutorEnabled: true,
          explainerEnabled: true,
          quizzerEnabled: true,
        },
        bindings
      )
    ).toContain('quizzer')
  })

  it('keeps an explicitly disabled Quizzer unavailable with a safe binding', () => {
    expect(
      extractChatbotModes(
        null,
        { tutorEnabled: true, explainerEnabled: true, quizzerEnabled: false },
        [
          {
            chatMode: 'tutor',
            mcpServerId: 'course',
            allowedTools: ['doc_query'],
          },
        ]
      )
    ).not.toContain('quizzer')
  })
})

describe('response-example transition contract', () => {
  const expected: Record<
    ResponseExampleStatus,
    Record<ResponseExampleAction, boolean>
  > = {
    CANDIDATE: {
      APPROVE: true,
      EDIT_AND_APPROVE: true,
      REJECT: true,
    },
    NEEDS_REVIEW: {
      APPROVE: true,
      EDIT_AND_APPROVE: true,
      REJECT: true,
    },
    APPROVED: {
      APPROVE: false,
      EDIT_AND_APPROVE: true,
      REJECT: false,
    },
    REJECTED: {
      APPROVE: false,
      EDIT_AND_APPROVE: false,
      REJECT: false,
    },
  }

  it('keeps action flags and mutation transitions on one status table', () => {
    for (const [status, actions] of Object.entries(expected) as Array<
      [ResponseExampleStatus, Record<ResponseExampleAction, boolean>]
    >) {
      expect(responseExampleActions(status)).toEqual({
        canApprove: actions.APPROVE,
        canEditAndApprove: actions.EDIT_AND_APPROVE,
        canReject: actions.REJECT,
      })

      for (const [action, allowed] of Object.entries(actions) as Array<
        [ResponseExampleAction, boolean]
      >) {
        expect(canApplyResponseExampleAction(status, action)).toBe(allowed)
      }
    }
  })
})
