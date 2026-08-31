import { describe, expect, it } from 'vitest'
import { validateStudentResponse } from '../src/processors/responseValidation.js'

describe('Peer Instruction response validation', () => {
  it('rejects partially numeric responses', () => {
    expect(
      validateStudentResponse({
        type: 'NUMERICAL',
        response: { value: '1abc' },
      }).valid
    ).toBe(false)
    expect(
      validateStudentResponse({
        type: 'NUMERICAL',
        response: { value: '1.5' },
      }).valid
    ).toBe(true)
  })
})
