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

  test('handles an empty base prompt without leading blank lines', () => {
    const result = withCitationContract('', ['doc_query'])
    expect(result.startsWith('\n')).toBe(false)
    expect(result.trim()).toBe(result)
    expect(result).toContain('[1]')
  })

  test('handles a whitespace-only base prompt without leading blank lines', () => {
    const result = withCitationContract('   \n  ', ['doc_query'])
    expect(result.startsWith('\n')).toBe(false)
    expect(result.startsWith(' ')).toBe(false)
    expect(result).toContain('[1]')
  })

  test('the appended block instructs bracketed-number citations like [1] and [2]', () => {
    const result = withCitationContract('Base prompt.', ['doc_query'])
    expect(result).toContain('[1]')
    expect(result).toContain('[2]')
    expect(result.toLowerCase()).toContain('citation')
  })

  test('is idempotent when called twice with its own output', () => {
    const base = 'You are a helpful tutor.'
    const once = withCitationContract(base, ['doc_query'])
    const twice = withCitationContract(once, ['doc_query'])
    expect(twice).toBe(once)
  })
})
