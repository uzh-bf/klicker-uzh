import {
  isLiveQuizPinConflict,
  withLiveQuizPinRetry,
} from '../src/services/liveQuizPin.js'

describe('Live quiz PIN allocation retries', () => {
  it('retries only a PIN uniqueness conflict', async () => {
    const conflict = {
      code: 'P2002',
      meta: { target: ['pinCode'] },
    }
    let attempts = 0

    await expect(
      withLiveQuizPinRetry(async () => {
        attempts += 1
        if (attempts === 1) throw conflict
        return 'ABC123'
      })
    ).resolves.toBe('ABC123')
    expect(attempts).toBe(2)
    expect(isLiveQuizPinConflict(conflict)).toBe(true)
    expect(
      isLiveQuizPinConflict({ code: 'P2002', meta: { target: ['name'] } })
    ).toBe(false)
  })
})
