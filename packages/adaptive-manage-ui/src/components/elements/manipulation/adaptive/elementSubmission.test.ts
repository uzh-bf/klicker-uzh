import { describe, expect, it, vi } from 'vitest'
import { refreshElementListBestEffort } from './elementSubmission'

describe('adaptive element submission refresh', () => {
  it('does not turn a committed save into a failure when refresh rejects', async () => {
    const refetchElements = vi
      .fn<() => Promise<void>>()
      .mockRejectedValue(new Error('refresh unavailable'))

    expect(() => refreshElementListBestEffort(refetchElements)).not.toThrow()
    await Promise.resolve()

    expect(refetchElements).toHaveBeenCalledOnce()
  })
})
