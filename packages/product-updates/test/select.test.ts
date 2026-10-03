import { describe, expect, it } from 'vitest'
import {
  type SelectEligibleUpdatesArgs,
  selectEligibleUpdates,
  selectLatestReleasedUpdate,
} from '../src/select'
import type { ProductUpdate } from '../src/types'

const NOW = new Date('2026-06-01T00:00:00.000Z')

function makeUpdate(overrides: Partial<ProductUpdate> = {}): ProductUpdate {
  return {
    id: 'base',
    publishedAt: '2026-01-01T00:00:00.000Z',
    audiences: ['lecturer'],
    surfaces: ['manage'],
    maturity: 'released',
    title: { de: 'Titel', en: 'Title' },
    summary: { de: 'Zusammenfassung', en: 'Summary' },
    promotions: ['feed'],
    suppressInAssessment: true,
    ...overrides,
  }
}

describe('selectEligibleUpdates', () => {
  it('keeps an entry that matches audience, surface, and date window', () => {
    const update = makeUpdate()
    expect(
      selectEligibleUpdates({
        updates: [update],
        audience: 'lecturer',
        surface: 'manage',
        now: NOW,
      })
    ).toEqual([update])
  })

  it('drops entries for another audience', () => {
    expect(
      selectEligibleUpdates({
        updates: [makeUpdate({ audiences: ['student'] })],
        audience: 'lecturer',
        surface: 'manage',
        now: NOW,
      })
    ).toEqual([])
  })

  it('drops entries for another surface', () => {
    expect(
      selectEligibleUpdates({
        updates: [makeUpdate({ surfaces: ['pwa'] })],
        audience: 'lecturer',
        surface: 'manage',
        now: NOW,
      })
    ).toEqual([])
  })

  it('drops entries that are not published yet', () => {
    expect(
      selectEligibleUpdates({
        updates: [makeUpdate({ publishedAt: '2026-12-01T00:00:00.000Z' })],
        audience: 'lecturer',
        surface: 'manage',
        now: NOW,
      })
    ).toEqual([])
  })

  it('drops entries that have expired', () => {
    expect(
      selectEligibleUpdates({
        updates: [makeUpdate({ expiresAt: '2026-03-01T00:00:00.000Z' })],
        audience: 'lecturer',
        surface: 'manage',
        now: NOW,
      })
    ).toEqual([])
  })

  it('keeps entries whose expiry is still ahead', () => {
    const update = makeUpdate({ expiresAt: '2026-09-01T00:00:00.000Z' })
    expect(
      selectEligibleUpdates({
        updates: [update],
        audience: 'lecturer',
        surface: 'manage',
        now: NOW,
      })
    ).toEqual([update])
  })

  it('drops entries with an unparsable date instead of showing them forever', () => {
    expect(
      selectEligibleUpdates({
        updates: [makeUpdate({ publishedAt: 'not-a-date' })],
        audience: 'lecturer',
        surface: 'manage',
        now: NOW,
      })
    ).toEqual([])
  })

  it('requires every declared feature flag to be on', () => {
    const update = makeUpdate({ requiredFeatureFlags: ['learning-analytics'] })
    const args: SelectEligibleUpdatesArgs = {
      updates: [update],
      audience: 'lecturer',
      surface: 'manage',
      now: NOW,
    }

    expect(
      selectEligibleUpdates({
        ...args,
        flags: { 'learning-analytics': true },
      })
    ).toEqual([update])
    expect(
      selectEligibleUpdates({
        ...args,
        flags: { 'learning-analytics': false },
      })
    ).toEqual([])
    // No evaluation available means fail-closed, matching the flag registry.
    expect(selectEligibleUpdates(args)).toEqual([])
  })

  it('keeps entries without feature flags even when nothing is evaluated', () => {
    const update = makeUpdate()
    expect(
      selectEligibleUpdates({
        updates: [update],
        audience: 'lecturer',
        surface: 'manage',
        now: NOW,
        flags: {},
      })
    ).toEqual([update])
  })

  it('suppresses opted-in entries in assessment mode and keeps the others', () => {
    const suppressed = makeUpdate({ id: 'suppressed' })
    const allowed = makeUpdate({ id: 'allowed', suppressInAssessment: false })
    expect(
      selectEligibleUpdates({
        updates: [suppressed, allowed],
        audience: 'lecturer',
        surface: 'manage',
        now: NOW,
        isAssessment: true,
      })
    ).toEqual([allowed])
  })

  it('preserves the catalog order', () => {
    const newer = makeUpdate({
      id: 'newer',
      publishedAt: '2026-05-01T00:00:00.000Z',
    })
    const older = makeUpdate({
      id: 'older',
      publishedAt: '2026-02-01T00:00:00.000Z',
    })
    expect(
      selectEligibleUpdates({
        updates: [newer, older],
        audience: 'lecturer',
        surface: 'manage',
        now: NOW,
      }).map((update) => update.id)
    ).toEqual(['newer', 'older'])
  })
})

describe('selectLatestReleasedUpdate', () => {
  it('returns the newest released entry for the surface', () => {
    const preview = makeUpdate({
      id: 'preview',
      maturity: 'preview',
      surfaces: ['docs'],
      publishedAt: '2026-05-01T00:00:00.000Z',
    })
    const released = makeUpdate({
      id: 'released',
      surfaces: ['docs'],
      publishedAt: '2026-04-01T00:00:00.000Z',
    })
    expect(
      selectLatestReleasedUpdate({
        updates: [preview, released],
        surface: 'docs',
        now: NOW,
      })
    ).toEqual(released)
  })

  it('skips flag-gated entries because an anonymous surface cannot evaluate them', () => {
    expect(
      selectLatestReleasedUpdate({
        updates: [
          makeUpdate({
            surfaces: ['docs'],
            requiredFeatureFlags: ['learning-analytics'],
          }),
        ],
        surface: 'docs',
        now: NOW,
      })
    ).toBeUndefined()
  })

  it('returns nothing when no entry targets the surface', () => {
    expect(
      selectLatestReleasedUpdate({
        updates: [makeUpdate({ surfaces: ['manage'] })],
        surface: 'docs',
        now: NOW,
      })
    ).toBeUndefined()
  })
})
