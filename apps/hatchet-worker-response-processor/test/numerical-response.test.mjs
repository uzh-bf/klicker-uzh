import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { validateStudentResponse } from '../src/processors/helpers.ts'

describe('numerical response validation', () => {
  it('rejects partially parsed and non-finite values', () => {
    for (const value of ['1junk', 'NaN', 'Infinity', '-Infinity', '   ']) {
      assert.equal(
        validateStudentResponse({
          type: 'NUMERICAL',
          response: { value },
        }).valid,
        false,
        `expected ${JSON.stringify(value)} to be invalid`
      )
    }
  })

  it('accepts finite numbers represented as strings', () => {
    for (const value of ['0', '-2.5', '.5', '1e3', ' 42 ']) {
      assert.deepEqual(
        validateStudentResponse({
          type: 'NUMERICAL',
          response: { value },
        }),
        { valid: true }
      )
    }
  })
})
