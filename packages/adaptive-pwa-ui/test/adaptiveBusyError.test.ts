import { describe, expect, it } from 'vitest'
import { isAdaptiveBusyError } from '../src/components/practiceQuiz/adaptive/adaptiveBusyError'

const withCode = (code: unknown) => ({
  graphQLErrors: [{ message: 'masked', extensions: { code } }],
})

describe('adaptive busy errors', () => {
  it('treats engine overload, unavailability and attempt conflicts as busy', () => {
    for (const code of [
      'ADAPTIVE_ENGINE_BUSY',
      'ADAPTIVE_ENGINE_UNAVAILABLE',
      'ADAPTIVE_ATTEMPT_CONFLICT',
    ]) {
      expect(isAdaptiveBusyError(withCode(code))).toBe(true)
    }
  })

  it('keeps every other failure on the generic message', () => {
    for (const error of [
      withCode('ADAPTIVE_RESPONSE_ALREADY_SUBMITTED'),
      withCode(42),
      { graphQLErrors: [] },
      new Error('network'),
      null,
      undefined,
    ]) {
      expect(isAdaptiveBusyError(error)).toBe(false)
    }
  })
})
