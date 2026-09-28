import { describe, expect, test, vi } from 'vitest'
import {
  registerNavigationBlocker,
  requestNavigationConfirmation,
} from '../src/lib/navigationGuard'

describe('navigation guard registry', () => {
  test('allows navigation without a registered blocker', () => {
    expect(requestNavigationConfirmation()).toBe(true)
  })

  test('stops at the first blocker that rejects navigation', () => {
    const allow = vi.fn(() => true)
    const reject = vi.fn(() => false)
    const skipped = vi.fn(() => true)
    const unregisterAllow = registerNavigationBlocker(allow)
    const unregisterReject = registerNavigationBlocker(reject)
    const unregisterSkipped = registerNavigationBlocker(skipped)

    expect(requestNavigationConfirmation()).toBe(false)
    expect(allow).toHaveBeenCalledOnce()
    expect(reject).toHaveBeenCalledOnce()
    expect(skipped).not.toHaveBeenCalled()

    unregisterAllow()
    unregisterReject()
    unregisterSkipped()
  })

  test('removes a blocker during cleanup', () => {
    const unregister = registerNavigationBlocker(() => false)
    unregister()

    expect(requestNavigationConfirmation()).toBe(true)
  })
})
