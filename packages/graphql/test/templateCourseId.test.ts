import { describe, expect, it } from 'vitest'
import { normalizeTemplateCourseId } from '../src/services/templates.js'

describe('normalizeTemplateCourseId', () => {
  it('returns valid UUIDs and ignores malformed template course ids', () => {
    expect(normalizeTemplateCourseId('not-a-uuid')).toBeUndefined()
    expect(
      normalizeTemplateCourseId('00000000-0000-4000-8000-000000000000')
    ).toBe('00000000-0000-4000-8000-000000000000')
  })
})
