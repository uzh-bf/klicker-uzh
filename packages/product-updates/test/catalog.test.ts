import { FEATURE_FLAG_DEFAULTS } from '@klicker-uzh/feature-flags'
import { describe, expect, it } from 'vitest'
import { PRODUCT_UPDATES } from '../src/catalog'
import {
  type LocalizedText,
  PRODUCT_UPDATE_AUDIENCES,
  PRODUCT_UPDATE_MATURITIES,
  PRODUCT_UPDATE_PROMOTIONS,
  PRODUCT_UPDATE_SURFACES,
  type ProductUpdate,
} from '../src/types'

// This suite is the catalog's CI contract: entries are editorial content that
// nothing else type-checks at runtime, so every rule that a reviewer would
// otherwise have to remember is asserted here.

const KNOWN_FEATURE_FLAG_KEYS = Object.keys(FEATURE_FLAG_DEFAULTS)

// Strict round-trip: only a full ISO-8601 instant in UTC survives this, which
// keeps date comparisons across the apps unambiguous.
function isIsoInstant(value: string): boolean {
  const parsed = new Date(value)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString() === value
}

function localizedTextsOf(update: ProductUpdate): [string, LocalizedText][] {
  const entries: [string, LocalizedText][] = [
    ['title', update.title],
    ['summary', update.summary],
  ]
  if (update.bodyMarkdown) entries.push(['bodyMarkdown', update.bodyMarkdown])
  if (update.image) entries.push(['image.alt', update.image.alt])
  if (update.cta) entries.push(['cta.label', update.cta.label])
  return entries
}

// A line with two or more pipes is a GFM table row or delimiter. GFM is
// disabled in `@klicker-uzh/markdown`, so such a line would reach the reader as
// literal text instead of a table.
function gfmTableLines(markdown: string): string[] {
  return markdown.split('\n').filter((line) => line.split('|').length - 1 >= 2)
}

describe('PRODUCT_UPDATES catalog', () => {
  it('is non-empty', () => {
    expect(PRODUCT_UPDATES.length).toBeGreaterThan(0)
  })

  it('uses unique ids', () => {
    const ids = PRODUCT_UPDATES.map((update) => update.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('is ordered newest first', () => {
    const timestamps = PRODUCT_UPDATES.map((update) =>
      Date.parse(update.publishedAt)
    )
    const sorted = [...timestamps].sort((a, b) => b - a)
    expect(timestamps).toEqual(sorted)
  })

  describe.each(
    PRODUCT_UPDATES.map((update) => [update.id, update] as const)
  )('entry %s', (_id, update) => {
    it('has a non-empty id', () => {
      expect(update.id.trim()).not.toBe('')
    })

    it('has an ISO publishedAt', () => {
      expect(isIsoInstant(update.publishedAt)).toBe(true)
    })

    it('expires after it was published', () => {
      if (update.expiresAt === undefined) return
      expect(isIsoInstant(update.expiresAt)).toBe(true)
      expect(Date.parse(update.expiresAt)).toBeGreaterThan(
        Date.parse(update.publishedAt)
      )
    })

    it('targets at least one known audience', () => {
      expect(update.audiences.length).toBeGreaterThan(0)
      for (const audience of update.audiences) {
        expect(PRODUCT_UPDATE_AUDIENCES).toContain(audience)
      }
    })

    it('targets at least one known surface', () => {
      expect(update.surfaces.length).toBeGreaterThan(0)
      for (const surface of update.surfaces) {
        expect(PRODUCT_UPDATE_SURFACES).toContain(surface)
      }
    })

    it('declares a known maturity', () => {
      expect(PRODUCT_UPDATE_MATURITIES).toContain(update.maturity)
    })

    it('declares at least one known promotion', () => {
      expect(update.promotions.length).toBeGreaterThan(0)
      for (const promotion of update.promotions) {
        expect(PRODUCT_UPDATE_PROMOTIONS).toContain(promotion)
      }
    })

    it('only requires feature flags that exist in the registry', () => {
      for (const key of update.requiredFeatureFlags ?? []) {
        expect(KNOWN_FEATURE_FLAG_KEYS).toContain(key)
      }
    })

    it('fills both locales of every localized text', () => {
      for (const [field, text] of localizedTextsOf(update)) {
        expect(text.de.trim(), `${field}.de is empty`).not.toBe('')
        expect(text.en.trim(), `${field}.en is empty`).not.toBe('')
      }
    })

    it('describes its image', () => {
      if (!update.image) return
      expect(update.image.src.trim()).not.toBe('')
    })

    it('links its CTA to an internal path or an https URL', () => {
      if (!update.cta) return
      const { href } = update.cta
      expect(href.startsWith('/') || href.startsWith('https://')).toBe(true)
    })

    it('links its details to an https URL', () => {
      if (update.detailsUrl === undefined) return
      expect(update.detailsUrl.startsWith('https://')).toBe(true)
    })

    it('avoids GFM table syntax in its body', () => {
      if (!update.bodyMarkdown) return
      expect(gfmTableLines(update.bodyMarkdown.de)).toEqual([])
      expect(gfmTableLines(update.bodyMarkdown.en)).toEqual([])
    })

    it('states whether it is suppressed in assessment mode', () => {
      expect(typeof update.suppressInAssessment).toBe('boolean')
    })
  })
})
