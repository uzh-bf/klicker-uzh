import { describe, expect, it } from 'vitest'
import {
  resolveResponseExampleCaptureErrorPhase,
  resolveResponseExampleCapturePhase,
} from '../src/components/response-example-capture-action'

describe('owner-preview response-example capture action', () => {
  it('shows the unavailable state for a malformed receipt part', () => {
    expect(
      resolveResponseExampleCapturePhase({
        hasReceipt: false,
        isComplete: true,
        phase: 'available',
      })
    ).toBe('unavailable')
  })

  it('hides the action while the answer is still running', () => {
    expect(
      resolveResponseExampleCapturePhase({
        hasReceipt: true,
        isComplete: false,
        phase: 'available',
      })
    ).toBe('hidden')
  })

  it('maps stale and expired server responses to their recovery states', () => {
    expect(
      resolveResponseExampleCaptureErrorPhase('RESPONSE_EXAMPLE_CAPTURE_STALE')
    ).toBe('stale')
    expect(
      resolveResponseExampleCaptureErrorPhase(
        'RESPONSE_EXAMPLE_RECEIPT_EXPIRED'
      )
    ).toBe('expired')
  })

  it('keeps unknown capture failures recoverable without exposing server details', () => {
    expect(resolveResponseExampleCaptureErrorPhase('UPSTREAM_ERROR')).toBe(
      'failure'
    )
    expect(resolveResponseExampleCaptureErrorPhase(undefined)).toBe('failure')
  })
})
