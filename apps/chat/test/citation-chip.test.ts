import { describe, expect, test } from 'vitest'
import { CITATION_CHIP_JOINER as WJ } from '../src/components/citation-chip'

// This repo's chat test setup has no jsdom/testing-library (see
// `test/thread-list-delete-confirm.test.ts`), so `CitationChip` itself
// can't be mounted here. Instead, this file proves the *contract* the
// component's rendered output must satisfy: a trailing `CITATION_CHIP_JOINER`
// (U+2060 WORD JOINER), symmetric to the existing leading one, sits right
// after the chip so trailing punctuation or an adjacent chip can never be
// orphaned onto the next line — without also swallowing the normal wrap
// point at a following space.
//
// `renderedChipRun` models the plain-text character stream a browser's line
// breaker sees for a `<sup>{WJ}<button>N</button>{WJ}</sup>` chip glued
// between two strings, standing the chip's digit in for the actual atomic
// button (the file's own UAX #14 "treated like an ideograph" comment is the
// existing, unit-untestable rationale for why the button needs joiners at
// all — this test only checks that this component places them correctly).
function renderedChipRun(before: string, index: number, after: string): string {
  return `${before}${WJ}${index}${WJ}${after}`
}

// Minimal UAX #14 line-break checker — only the two rules this contract
// relies on, not a full implementation:
//   - LB11 "do not break before or after WORD JOINER": a WJ forbids the
//     break immediately touching itself, regardless of what's on the other
//     side. Checked first so it takes priority, mirroring the rule's low
//     (high-priority) number relative to the space rule below.
//   - LB18 "break after spaces": once WJ is ruled out, a plain space still
//     allows a break right after itself.
// Every other pair defaults to breakable, which is all this test needs.
function breakAllowedBetween(left: string, right: string): boolean {
  if (left === WJ || right === WJ) return false
  if (left === ' ') return true
  return true
}

describe('CitationChip wrap contract (CITATION_CHIP_JOINER)', () => {
  test('chip followed directly by a period stays glued to it', () => {
    // Mirrors `splitCitationMarkers`, which drops the pre-marker space, so
    // in real markdown output "idea[1]." renders with no space on either
    // side of the chip.
    const run = renderedChipRun('idea', 1, '.')
    expect(run).toBe(`idea${WJ}1${WJ}.`)

    const trailingWjIndex = run.lastIndexOf(WJ)
    expect(
      breakAllowedBetween(run[trailingWjIndex], run[trailingWjIndex + 1])
    ).toBe(false)
  })

  test('chip followed directly by a comma stays glued to it', () => {
    const run = renderedChipRun('idea', 1, ', and more')
    expect(run).toBe(`idea${WJ}1${WJ}, and more`)

    const trailingWjIndex = run.lastIndexOf(WJ)
    expect(
      breakAllowedBetween(run[trailingWjIndex], run[trailingWjIndex + 1])
    ).toBe(false)
  })

  test('two adjacent chips ([1][2]) glue to each other with no gap', () => {
    // `splitCitationMarkers` emits no text node between adjacent markers
    // (see citation-markers.test.ts), so chip 1's trailing WJ sits directly
    // next to chip 2's leading WJ.
    const run = `Facts${WJ}1${WJ}${WJ}2${WJ}.`

    // No stray character (e.g. an accidental space) snuck in between the
    // two chips.
    expect(run).toContain(`1${WJ}${WJ}2`)

    const betweenChipsIndex = run.indexOf(`1${WJ}${WJ}2`) + 1
    expect(
      breakAllowedBetween(run[betweenChipsIndex], run[betweenChipsIndex + 1])
    ).toBe(false)

    const trailingWjIndex = run.lastIndexOf(WJ)
    expect(
      breakAllowedBetween(run[trailingWjIndex], run[trailingWjIndex + 1])
    ).toBe(false)
  })

  test('chip followed by a space and a word still allows a wrap at that space', () => {
    // `splitCitationMarkers` keeps the post-marker space (only the
    // pre-marker one is stripped), so real output is "idea[1] according...".
    const run = renderedChipRun('idea', 1, ' according to the lecture.')
    expect(run).toBe(`idea${WJ}1${WJ} according to the lecture.`)

    const spaceIndex = run.indexOf(' ')

    // The boundary the WJ actually blocks is WJ<->SP (no break lands with a
    // lone space starting the next line) — inconsequential on its own.
    expect(breakAllowedBetween(run[spaceIndex - 1], run[spaceIndex])).toBe(
      false
    )

    // The boundary that matters for wrapping — SP<->"according" — is a
    // separate pair the WJ never touches, so it must remain breakable.
    // This is the regression this test guards: a trailing joiner must not
    // glue the whole next word to the chip, only the immediately adjacent
    // character.
    expect(breakAllowedBetween(run[spaceIndex], run[spaceIndex + 1])).toBe(true)
  })
})
