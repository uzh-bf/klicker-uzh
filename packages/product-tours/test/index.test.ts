import { describe, expect, it } from 'vitest'
import { escapeHtml, isKnownTourId, TOUR_IDS } from '../src/index.js'

describe('escapeHtml', () => {
  // Driver.js assigns popover strings with innerHTML. This exact title lost its
  // "<2s)" tail to the HTML parser before the escaping was added, which is what
  // makes it the case worth keeping.
  it('keeps text that reads like a tag out of the HTML parser', () => {
    expect(escapeHtml('Faster grading (<2s)')).toBe('Faster grading (&lt;2s)')
  })

  it('escapes every character that can break out of a popover', () => {
    expect(escapeHtml(`<img src="x" onerror='alert(1)'> & more`)).toBe(
      '&lt;img src=&quot;x&quot; onerror=&#39;alert(1)&#39;&gt; &amp; more'
    )
  })

  it('leaves ordinary text untouched', () => {
    expect(escapeHtml('Zur Übersicht — 5 Kurse')).toBe(
      'Zur Übersicht — 5 Kurse'
    )
  })
})

describe('isKnownTourId', () => {
  it('accepts every released tour id', () => {
    for (const tourId of TOUR_IDS) {
      expect(isKnownTourId(tourId)).toBe(true)
    }
  })

  it('rejects an id no build defines', () => {
    expect(isKnownTourId('manage-onboarding-v99')).toBe(false)
  })
})
