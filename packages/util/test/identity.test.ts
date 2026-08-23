import { describe, expect, it } from 'vitest'
import { normalizeIdentityValue } from '../src/identity.js'

describe('normalizeIdentityValue', () => {
  it('trims non-empty strings', () => {
    expect(normalizeIdentityValue('  Ada Lovelace  ')).toBe('Ada Lovelace')
  })

  it('unwraps a single claim value', () => {
    expect(normalizeIdentityValue(['  00-123-456  '])).toBe('00-123-456')
  })

  it('maps missing, empty, and ambiguous values to null', () => {
    expect(normalizeIdentityValue(undefined)).toBeNull()
    expect(normalizeIdentityValue(null)).toBeNull()
    expect(normalizeIdentityValue('   ')).toBeNull()
    expect(normalizeIdentityValue([])).toBeNull()
    expect(normalizeIdentityValue(['Ada', 'Grace'])).toBeNull()
    expect(normalizeIdentityValue(123)).toBeNull()
  })
})
