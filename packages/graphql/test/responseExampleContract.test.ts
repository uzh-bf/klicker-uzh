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
    expect(extractChatbotModes(systemPrompts)).toEqual(['explainer', 'tutor'])
  })

  it('preserves legacy disablement and other stored mode keys', () => {
    expect(
      extractChatbotModes({
        explainer: { enabled: false },
        custom: { prompt: 'Synthetic' },
      })
    ).toEqual(['custom', 'tutor'])
  })

  it('uses explicit standard settings ahead of legacy prompt flags', () => {
    expect(
      extractChatbotModes(
        { tutor: { enabled: false }, quizzer: {} },
        { tutorEnabled: true, explainerEnabled: false, quizzerEnabled: false }
      )
    ).toEqual(['tutor'])
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
