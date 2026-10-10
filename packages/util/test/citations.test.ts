import { describe, expect, it } from 'vitest'
import {
  citationHrefFor,
  citationTargetIdFor,
  extractCitationIndexes,
  hasExactCitationIndexes,
  parseCitationHref,
} from '../src/citations.js'

describe('citation helpers', () => {
  it('can scope citation targets without changing their parsed index', () => {
    expect(citationTargetIdFor(1)).toBe('response-example-citation-1')
    expect(citationTargetIdFor(1, 'example/a')).toBe(
      'response-example-citation-example%2Fa--1'
    )
    expect(citationHrefFor(1, 'example/a')).toBe(
      '#response-example-citation-example%2Fa--1'
    )
    expect(parseCitationHref('#response-example-citation-example%2Fa--1')).toBe(
      1
    )
  })

  it('matches citation links in rendered Markdown', () => {
    expect(
      extractCitationIndexes('Use **the definition [1]** and [2].')
    ).toEqual([1, 2])
    expect(
      extractCitationIndexes(
        'Code `[3]`, a [link [4]](https://example.test/[5]), and $$x[6]$$ [7].'
      )
    ).toEqual([7])
    expect(
      extractCitationIndexes('[source]: https://example.test/[8]')
    ).toEqual([])
    expect(
      extractCitationIndexes('<!-- hidden [9] -->\nVisible [10].')
    ).toEqual([10])
    expect(
      extractCitationIndexes('<!-- hidden [11] --!>\nVisible [12].')
    ).toEqual([])
  })

  it('uses the renderer normalization path', () => {
    expect(extractCitationIndexes('&amp;#91;13] and &lt;br&gt; [14]')).toEqual([
      13, 14,
    ])
  })

  it('uses the renderer single-dollar math setting', () => {
    expect(extractCitationIndexes('$x[15]$')).toEqual([15])
    expect(
      extractCitationIndexes('$x[15]$', { singleDollarTextMath: true })
    ).toEqual([])
  })

  it('requires a non-empty exact citation index set', () => {
    expect(hasExactCitationIndexes('Use [1].', [1])).toBe(true)
    expect(hasExactCitationIndexes('Use [1] and [2].', [1])).toBe(false)
    expect(hasExactCitationIndexes('Use [1].', [1, 2])).toBe(false)
    expect(hasExactCitationIndexes('No citation.', [1])).toBe(false)
  })

  it('handles malformed and bracket-heavy input within the normal test timeout', () => {
    const bracketHeavy = '[label [1]]'.repeat(2_000)
    expect(extractCitationIndexes(bracketHeavy)).toHaveLength(2_000)

    const maximumUnmatchedInput = '['.repeat(100_000)
    expect(extractCitationIndexes(maximumUnmatchedInput)).toEqual([])

    const deep = Array.from(
      { length: 5_000 },
      (_, index) => `    [${index + 1}]`
    ).join('\n')
    expect(extractCitationIndexes(deep)).toEqual([])

    const nested = `${'> '.repeat(5_000)}[16]`
    expect(extractCitationIndexes(nested)).toEqual([16])

    expect(extractCitationIndexes('Text [unclosed [15]')).toEqual([15])
  })
})
