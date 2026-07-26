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

  test('the appended block instructs bracketed-number citations like [1] and [2]', () => {
    const result = withCitationContract('Base prompt.', ['doc_query'])
    expect(result).toContain('[1]')
    expect(result).toContain('[2]')
    expect(result.toLowerCase()).toContain('citation')
  })

  // The UI's dedupe keeps a repeat source's original number and never mints a
  // new one, so a model that kept counting upward would emit a marker beyond
  // the resolvable range (see normalizeSourcesFromParts / resolveCitationSource).
  test('the appended block tells the model to reuse a repeat source number', () => {
    const result = withCitationContract('Base prompt.', ['doc_query'])
    expect(result.toLowerCase()).toContain('reuse the number')
  })
})
