import { describe, expect, it } from 'vitest'
import { validateStudentResponse } from '../src/liveQuizResponseValidation.js'

describe('validateStudentResponse', () => {
  it('rejects unexpected fields in choice responses', () => {
    const result = validateStudentResponse({
      type: 'SC',
      instanceInfo: { choiceCount: '1' },
      response: {
        choices: [{ ix: 0, selected: true, note: 'private-marker' }],
      },
    })

    expect(result.valid).toBe(false)
  })
})
