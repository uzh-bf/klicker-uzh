import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { pickVerifiedToken, readCookieValues } from './cookieTokens.js'

const verifyOnly = (valid: string) => async (token: string) => {
  if (token !== valid) throw new Error('invalid token')
}

describe('readCookieValues', () => {
  it('returns duplicate values in header order', () => {
    assert.deepEqual(
      readCookieValues(
        'a=1; participant_token=old; b=2; participant_token=new',
        'participant_token'
      ),
      ['old', 'new']
    )
  })

  it('returns no values without a header', () => {
    assert.deepEqual(readCookieValues(undefined, 'participant_token'), [])
  })
})

describe('pickVerifiedToken', () => {
  it('skips an expired duplicate that comes first', async () => {
    assert.equal(
      await pickVerifiedToken(['old', 'new'], verifyOnly('new')),
      'new'
    )
  })

  it('keeps the first value when none verifies', async () => {
    assert.equal(
      await pickVerifiedToken(['old', 'older'], verifyOnly('new')),
      'old'
    )
  })
})
