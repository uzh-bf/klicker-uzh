import { describe, expect, it } from 'vitest'
import {
  collapsedUzhVariant,
  collectAllEmails,
  collectInvitationEmails,
  normalizeEmail,
  normalizeMatriculationNumber,
} from '../src/email.js'

describe('Email utilities', () => {
  describe('normalizeEmail', () => {
    it('normalizes case and trims whitespace', () => {
      expect(normalizeEmail('  USER@Example.COM  ')).toBe('user@example.com')
    })

    it('returns null for invalid strings', () => {
      expect(normalizeEmail('no-at-symbol')).toBeNull()
      expect(normalizeEmail('')).toBeNull()
      expect(normalizeEmail(undefined)).toBeNull()
    })
  })

  describe('collapsedUzhVariant', () => {
    it('returns collapsed variant for departmental uzh subdomains', () => {
      expect(collapsedUzhVariant('user@df.uzh.ch')).toBe('user@uzh.ch')
      expect(collapsedUzhVariant('user@it.ifi.uzh.ch')).toBe('user@uzh.ch')
    })

    it('returns null for plain uzh.ch or non-uzh domains', () => {
      expect(collapsedUzhVariant('user@uzh.ch')).toBeNull()
      expect(collapsedUzhVariant('user@example.com')).toBeNull()
    })
  })

  describe('collectAllEmails', () => {
    it('collects and deduplicates primary and affiliation emails', () => {
      const result = collectAllEmails('User@df.uzh.ch', [
        'user@uzh.ch',
        'USER@df.uzh.ch',
      ])
      expect(new Set(result)).toEqual(
        new Set(['user@df.uzh.ch', 'user@uzh.ch'])
      )
    })

    it('adds collapsed @uzh.ch variant when applicable', () => {
      const result = collectAllEmails('user@it.ifi.uzh.ch')
      expect(new Set(result)).toEqual(
        new Set(['user@it.ifi.uzh.ch', 'user@uzh.ch'])
      )
    })

    it('ignores non-uzh domains for collapsing', () => {
      const result = collectAllEmails('user@example.com')
      expect(result).toEqual(['user@example.com'])
    })

    it('filters out invalid entries', () => {
      const result = collectAllEmails('user@df.uzh.ch', [
        'invalid',
        '',
        'also.invalid',
      ])
      expect(new Set(result)).toEqual(
        new Set(['user@df.uzh.ch', 'user@uzh.ch'])
      )
    })
  })

  describe('normalizeMatriculationNumber', () => {
    it('returns null for null and undefined', () => {
      expect(normalizeMatriculationNumber(null)).toBeNull()
      expect(normalizeMatriculationNumber(undefined)).toBeNull()
    })

    it('returns null for empty or whitespace-only strings', () => {
      expect(normalizeMatriculationNumber('')).toBeNull()
      expect(normalizeMatriculationNumber('   ')).toBeNull()
      expect(normalizeMatriculationNumber('\t\n')).toBeNull()
    })

    it('trims whitespace from valid values', () => {
      expect(normalizeMatriculationNumber('  12345678  ')).toBe('12345678')
    })

    it('preserves case (unlike email normalization)', () => {
      expect(normalizeMatriculationNumber('AB-12345')).toBe('AB-12345')
    })

    it('returns valid matriculation numbers as-is', () => {
      expect(normalizeMatriculationNumber('12345678')).toBe('12345678')
      expect(normalizeMatriculationNumber('00-123-456')).toBe('00-123-456')
    })
  })

  describe('collectInvitationEmails', () => {
    it('tracks profile and affiliation emails separately', () => {
      const result = collectInvitationEmails('User@df.uzh.ch', [
        'user@phil.uzh.ch',
        'user@uzh.ch',
      ])

      expect(new Set(result.profileEmails)).toEqual(
        new Set(['user@df.uzh.ch', 'user@uzh.ch'])
      )
      expect(new Set(result.affiliationEmails)).toEqual(
        new Set(['user@phil.uzh.ch', 'user@uzh.ch'])
      )
      expect(new Set(result.allEmails)).toEqual(
        new Set(['user@df.uzh.ch', 'user@phil.uzh.ch', 'user@uzh.ch'])
      )
    })

    it('omits invalid emails from both collections', () => {
      const result = collectInvitationEmails('invalid', ['also.invalid'])

      expect(result.profileEmails).toEqual([])
      expect(result.affiliationEmails).toEqual([])
      expect(result.allEmails).toEqual([])
    })
  })
})
