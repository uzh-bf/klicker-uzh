import { describe, expect, it } from 'vitest'
import {
  resolveResponseExampleCaptureErrorPhase,
  resolveResponseExampleCapturePhase,
} from '../src/components/response-example-capture-action'

describe('owner-preview response-example capture action', () => {
  it.each([
    ['available', 'available'],
    ['pending', 'pending'],
    ['created', 'created'],
    ['duplicate', 'duplicate'],
    ['stale', 'stale'],
    ['expired', 'expired'],
    ['failure', 'failure'],
  ] as const)('keeps the %s state visible for the first complete answer', (_, phase) => {
    expect(
      resolveResponseExampleCapturePhase({
        hasReceipt: true,
        isFirstAssistantAnswer: true,
        isComplete: true,
        phase,
      })
    ).toBe(phase)
  })

  it('shows the unavailable state for a malformed receipt part', () => {
    expect(
      resolveResponseExampleCapturePhase({
        hasReceipt: false,
        isFirstAssistantAnswer: true,
        isComplete: true,
        phase: 'available',
      })
    ).toBe('unavailable')
  })

  it.each([
    [
      'for a later answer',
      { hasReceipt: true, isFirstAssistantAnswer: false, isComplete: true },
    ],
    [
      'while the answer is still running',
      { hasReceipt: true, isFirstAssistantAnswer: true, isComplete: false },
    ],
  ] as const)('hides the action %s', (_, input) => {
    expect(
      resolveResponseExampleCapturePhase({
        ...input,
        phase: 'available',
      })
    ).toBe('hidden')
  })

  it('maps stale and expired server responses to their recovery states', () => {
    expect(
      resolveResponseExampleCaptureErrorPhase(
        409,
        'RESPONSE_EXAMPLE_CAPTURE_STALE'
      )
    ).toBe('stale')
    expect(
      resolveResponseExampleCaptureErrorPhase(
        410,
        'RESPONSE_EXAMPLE_RECEIPT_EXPIRED'
      )
    ).toBe('expired')
  })

  it('keeps unknown capture failures recoverable without exposing server details', () => {
    expect(resolveResponseExampleCaptureErrorPhase(502, 'UPSTREAM_ERROR')).toBe(
      'failure'
    )
    expect(resolveResponseExampleCaptureErrorPhase(500, undefined)).toBe(
      'failure'
    )
  })
})
