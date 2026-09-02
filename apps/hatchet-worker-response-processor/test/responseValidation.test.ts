import { describe, expect, it } from 'vitest'
import { validateStudentResponse } from '../src/processors/responseValidation.js'

describe('Peer Instruction response validation', () => {
  it('rejects malformed answer shapes without option metadata', () => {
    expect(
      validateStudentResponse({
        type: 'SC',
        response: { choices: [{ ix: -1, selected: true }] },
      }).valid
    ).toBe(false)
    expect(
      validateStudentResponse({
        type: 'SELECTION',
        response: { selection: [null as never] },
      }).valid
    ).toBe(false)
    expect(
      validateStudentResponse({
        type: 'FREE_TEXT',
        response: { value: '   ' },
      }).valid
    ).toBe(false)
  })

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
