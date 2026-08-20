import { describe, expect, test } from 'vitest'
import { compileSystemPrompt } from '../src/lib/server/systemPromptCompiler'

// Distinctive, stable fragments of each layer. Asserting on these (rather than
// the full contract text) keeps the test robust to wording tweaks in the
// individual contracts while still pinning the compile seam's composition.
const DEFAULT_TUTOR_MARK = 'KlickerChat' // only in DEFAULT_PROMPT.tutor
const CITATION_MARK = 'citation markers' // only in the citation contract
const LANGUAGE_MARK = 'Swiss High German orthography' // only in the language contract

// A doc_query-style tool triggers the (conditional) citation contract; a plain
// tool name does not (see isDocQueryToolName / DOC_QUERY_TOOL_NAME_RE).
const DOC_TOOL = 'KB_doc_query'
const NON_DOC_TOOL = 'get_weather'

describe('compileSystemPrompt', () => {
  test('uses the stored prompt for a configured mode and layers language only (no doc tool)', () => {
    const stored = { tutor: { prompt: 'STORED-TUTOR-PROMPT' } }

    const result = compileSystemPrompt(stored, 'tutor', [])

    expect(result.startsWith('STORED-TUTOR-PROMPT')).toBe(true)
    expect(result).not.toContain(DEFAULT_TUTOR_MARK)
    expect(result).toContain(LANGUAGE_MARK)
    expect(result).not.toContain(CITATION_MARK)
  })

  test('layers citation before language when a doc_query tool is present', () => {
    const stored = { tutor: { prompt: 'STORED-TUTOR-PROMPT' } }

    const result = compileSystemPrompt(stored, 'tutor', [DOC_TOOL])

    // Fixed layering: base, then citation, then language.
    const baseIdx = result.indexOf('STORED-TUTOR-PROMPT')
    const citationIdx = result.indexOf(CITATION_MARK)
    const languageIdx = result.indexOf(LANGUAGE_MARK)
    expect(baseIdx).toBeGreaterThanOrEqual(0)
    expect(citationIdx).toBeGreaterThan(baseIdx)
    expect(languageIdx).toBeGreaterThan(citationIdx)
  })

  test('does not add the citation contract for a present but non-doc_query tool', () => {
    const stored = { tutor: { prompt: 'STORED-TUTOR-PROMPT' } }

    const result = compileSystemPrompt(stored, 'tutor', [NON_DOC_TOOL])

    expect(result).not.toContain(CITATION_MARK)
    expect(result).toContain(LANGUAGE_MARK)
  })

  test('falls back to the built-in default prompt when no prompt is stored', () => {
    const resultNoTool = compileSystemPrompt(null, 'tutor', [])
    expect(resultNoTool).toContain(DEFAULT_TUTOR_MARK)
    expect(resultNoTool).toContain(LANGUAGE_MARK)
    expect(resultNoTool).not.toContain(CITATION_MARK)

    const resultWithTool = compileSystemPrompt(null, 'tutor', [DOC_TOOL])
    expect(resultWithTool).toContain(DEFAULT_TUTOR_MARK)
    expect(resultWithTool).toContain(CITATION_MARK)
    expect(resultWithTool).toContain(LANGUAGE_MARK)
  })

  test('falls back to the default when a stored mode entry has an empty prompt', () => {
    // Preserved quirk: an empty stored prompt is treated as absent and the
    // default for that mode is used instead of sending an empty base.
    const stored = { tutor: { prompt: '' } }

    const result = compileSystemPrompt(stored, 'tutor', [])

    expect(result).toContain(DEFAULT_TUTOR_MARK)
  })

  test('falls back to the default when a stored mode entry is null', () => {
    // A non-null systemPrompts object whose per-mode entry is null (a shape a
    // partial lecturer write path could produce) is caught by the truthy
    // guard, so the null is never dereferenced and the mode default is used.
    const stored = { tutor: null }

    const result = compileSystemPrompt(stored, 'tutor', [])

    expect(result).toContain(DEFAULT_TUTOR_MARK)
  })

  test('yields only the language contract for an unknown mode with no default', () => {
    // `explainer` has no DEFAULT_PROMPT entry, so the base resolves to '' and
    // only the unconditional language contract remains.
    const result = compileSystemPrompt(null, 'explainer', [])

    expect(result).not.toContain(DEFAULT_TUTOR_MARK)
    expect(result).not.toContain(CITATION_MARK)
    expect(result).toContain(LANGUAGE_MARK)
    // No base text: the result is exactly the language contract, so it starts
    // with that contract's first sentence.
    expect(result.startsWith('Language style:')).toBe(true)
  })
})
