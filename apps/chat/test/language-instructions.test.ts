import { describe, expect, test } from 'vitest'

import { withLanguageStyleContract } from '../src/lib/server/languageInstructions'

describe('withLanguageStyleContract', () => {
  test('appends the contract to a non-empty base prompt', () => {
    const base = 'You are a helpful tutor.'
    const result = withLanguageStyleContract(base)
    expect(result.startsWith(base)).toBe(true)
    expect(result).not.toBe(base)
  })

  test('the appended block demands Swiss orthography: ss over ß, real umlauts', () => {
    const result = withLanguageStyleContract('Base prompt.')
    expect(result).toContain('"ss" instead of "ß"')
    expect(result).toContain('ä, ö, ü')
    expect(result).toContain('ae, oe or ue')
  })

  // A lecturer's stored prompt replaces DEFAULT_PROMPT entirely, so the
  // contract must hold without any cooperation from the base prompt.
  test('applies to an arbitrary lecturer prompt without conditions', () => {
    const lecturerPrompt = 'Du bist ein strenger Quizmaster für MAT182.'
    const result = withLanguageStyleContract(lecturerPrompt)
    expect(result).toContain(lecturerPrompt)
    expect(result).toContain('Swiss High German')
  })

  test.each([
    ['empty', ''],
    ['whitespace-only', '   \n  '],
  ])('handles a %s base prompt without leading blank lines', (_label, base) => {
    const result = withLanguageStyleContract(base)
    expect(result.trim()).toBe(result)
    expect(result).toContain('Swiss High German')
  })
})
