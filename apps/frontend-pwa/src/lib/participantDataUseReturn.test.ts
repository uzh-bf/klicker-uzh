import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { participantDataUseReturn } from './participantDataUseReturn'

const origin = 'https://pwa.example.invalid'

describe('participant data-use return destination', () => {
  it('preserves the local course destination without authentication material', () => {
    assert.equal(
      participantDataUseReturn(
        '/de/course/synthetic?tab=practice&participantToken=synthetic&signedLtiData=synthetic&jwt=synthetic&token=synthetic#secret',
        origin
      ),
      '/de/course/synthetic?tab=practice'
    )
  })

  it('rejects external, malformed, and completion-loop destinations', () => {
    for (const value of [
      'https://other.example.invalid/course',
      '//other.example.invalid/course',
      'https://[invalid',
      '/de/account/data-use',
    ]) {
      assert.equal(participantDataUseReturn(value, origin), '/')
    }
  })
})
