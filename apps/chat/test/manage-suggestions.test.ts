import { describe, expect, test } from 'vitest'
import { getManageSuggestions } from '../src/lib/config/manageSuggestions'
import type { ManageAssistantContext } from '../src/services/manageContext'

const buildContext = (
  surface: ManageAssistantContext['surface']
): ManageAssistantContext => ({
  version: 1,
  source: 'manage',
  surface,
  locale: 'en',
  route: {
    asPath: '/some/path',
    pathname: '/some/path',
  },
})

const SURFACES: ManageAssistantContext['surface'][] = [
  'question-pool',
  'element-editor',
  'course-dashboard',
  'activity-creation',
  'evaluation',
  'general',
]

describe('getManageSuggestions', () => {
  test.each(SURFACES)('returns 3 suggestions for surface "%s"', (surface) => {
    const suggestions = getManageSuggestions(buildContext(surface))
    expect(suggestions).toHaveLength(3)
  })

  test('returns the general suggestions for a null context', () => {
    const suggestions = getManageSuggestions(null)
    expect(suggestions).toHaveLength(3)
    expect(suggestions).toEqual(getManageSuggestions(buildContext('general')))
  })

  test('surfaces produce distinct suggestion sets', () => {
    const bySurface = SURFACES.map((surface) =>
      getManageSuggestions(buildContext(surface))
    )

    // question-pool and general are allowed to differ from each other, but
    // every surface-specific set should have unique ids across surfaces.
    const idSets = bySurface.map(
      (suggestions) => new Set(suggestions.map((s) => s.id))
    )
    for (let i = 0; i < idSets.length; i++) {
      for (let j = i + 1; j < idSets.length; j++) {
        const overlap = [...idSets[i]!].some((id) => idSets[j]!.has(id))
        expect(overlap).toBe(false)
      }
    }
  })

  test('never references generic page context', () => {
    const allContexts = [null, ...SURFACES.map(buildContext)]

    for (const context of allContexts) {
      const suggestions = getManageSuggestions(context)
      for (const suggestion of suggestions) {
        expect(suggestion.text.toLowerCase()).not.toContain('page context')
        expect(suggestion.prompt.toLowerCase()).not.toContain('page context')
      }
    }
  })

  test('every suggestion has a short label, an id, and an imperative prompt', () => {
    const allContexts = [null, ...SURFACES.map(buildContext)]

    for (const context of allContexts) {
      const suggestions = getManageSuggestions(context)
      for (const suggestion of suggestions) {
        expect(suggestion.id.length).toBeGreaterThan(0)
        expect(suggestion.text.length).toBeGreaterThan(0)
        expect(suggestion.text.length).toBeLessThanOrEqual(22)
        expect(suggestion.prompt.length).toBeGreaterThan(0)
      }
    }
  })
})
