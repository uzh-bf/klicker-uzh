import { describe, expect, test } from 'vitest'

import { withCitationContract } from '../src/lib/server/citationInstructions'

describe('withCitationContract', () => {
  test('returns the base prompt unchanged when no tools are available', () => {
    const base = 'You are a helpful tutor.'
    expect(withCitationContract(base, [])).toBe(base)
  })

  test('returns the base prompt unchanged when only unrelated tools are available', () => {
    const base = 'You are a helpful tutor.'
    expect(
      withCitationContract(base, ['get_weather', 'search_web', 'KB_lookup'])
    ).toBe(base)
  })

  test('appends the contract when the bare doc_query tool is available', () => {
    const base = 'You are a helpful tutor.'
    const result = withCitationContract(base, ['doc_query'])
    expect(result).not.toBe(base)
    expect(result.startsWith(base)).toBe(true)
    expect(result).toContain('[1]')
  })

  test('appends the contract when a namespaced doc_query tool is available', () => {
    const base = 'You are a helpful tutor.'
    const result = withCitationContract(base, ['KB_doc_query'])
    expect(result).not.toBe(base)
    expect(result).toContain('[1]')
  })

  test.each([
    ['empty', ''],
    ['whitespace-only', '   \n  '],
  ])('handles a %s base prompt without leading blank lines', (_label, base) => {
    const result = withCitationContract(base, ['doc_query'])
    expect(result.trim()).toBe(result)
    expect(result).toContain('[1]')
  })
})
