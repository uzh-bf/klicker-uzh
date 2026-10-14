import { describe, expect, it } from 'vitest'
import {
  canApplyResponseExampleAction,
  type ResponseExampleAction,
  type ResponseExampleStatus,
  responseExampleActions,
} from '../src/lib/responseExampleContract.js'

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
