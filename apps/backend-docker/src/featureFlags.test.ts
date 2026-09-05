import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { parseRefreshInterval } from './featureFlags.js'

describe('parseRefreshInterval', () => {
  it('uses the client default when the setting is absent', () => {
    const warnings: string[] = []

    assert.equal(
      parseRefreshInterval(undefined, (message) => warnings.push(message)),
      undefined
    )
    assert.deepEqual(warnings, [])
  })

  it('accepts a positive refresh interval', () => {
    assert.equal(parseRefreshInterval('30000'), 30_000)
  })

  it('rejects zero and other invalid refresh intervals', () => {
    const warnings: string[] = []

    for (const value of ['', 'invalid', '-1', '0']) {
      assert.equal(
        parseRefreshInterval(value, (message) => warnings.push(message)),
        undefined
      )
    }

    assert.equal(warnings.length, 4)
    assert.ok(
      warnings.every((message) => message.includes('must be a positive number'))
    )
  })
})
