import { describe, expect, it } from 'vitest'
import {
  boundResponseExampleSearchResults,
  buildResponseExampleSkillProjection,
  buildResponseExampleSummary,
  computeResponseExampleSkillProjectionDigest,
  RESPONSE_EXAMPLE_SEARCH_MAX_CHARACTERS,
  RESPONSE_EXAMPLE_SUMMARY_MAX_CHARACTERS,
} from '../src/responseExampleRuntime.js'

const candidate = (id: string, answer = 'Use the concept [1].') => ({
  id,
  responseStyle: 'GUIDED_QUESTIONS',
  studentMessage: `Question ${id}`,
  referenceAnswer: answer,
  evidenceReferences: [
    {
      citationIndex: 1,
      sourceId: `source-${id}`,
      chunkId: `chunk-${id}`,
      contentHash: `hash-${id}`,
      citationAnchor: `page ${id}`,
    },
  ],
})

describe('response-example runtime projection', () => {
  it('builds a deterministic bounded summary without full questions or answers', () => {
    const examples = [
      candidate('b'),
      { ...candidate('a'), responseStyle: 'CONCISE_ANSWER' },
    ]
    const summary = buildResponseExampleSummary(examples)

    expect(summary.length).toBeLessThanOrEqual(
      RESPONSE_EXAMPLE_SUMMARY_MAX_CHARACTERS
    )
    expect(summary).toContain('Concise Answer: 1')
    expect(summary).toContain('Guided Questions: 1')
    expect(summary).not.toContain('Question a')
    expect(summary).not.toContain('Use the concept')
    expect(buildResponseExampleSummary([...examples].reverse())).toBe(summary)
  })

  it('keeps the excluded role empty while preserving the search schema seam', () => {
    expect(
      buildResponseExampleSkillProjection({
        role: 'excluded',
        examples: [candidate('a')],
      })
    ).toEqual({ summary: '', searchEnabled: false })
  })

  it('fingerprints the included projection while excluding set state from the baseline role', () => {
    const base = {
      chatbotId: '00000000-0000-4000-8000-000000000001',
      chatMode: 'tutor',
      summary: 'Bounded summary',
    }
    const included = computeResponseExampleSkillProjectionDigest({
      ...base,
      role: 'included',
      setDigest: 'set-a',
    })
    const changedSet = computeResponseExampleSkillProjectionDigest({
      ...base,
      role: 'included',
      setDigest: 'set-b',
    })
    const excluded = computeResponseExampleSkillProjectionDigest({
      ...base,
      role: 'excluded',
      setDigest: 'set-a',
    })
    const excludedWithOtherSet = computeResponseExampleSkillProjectionDigest({
      ...base,
      role: 'excluded',
      setDigest: 'set-b',
    })

    expect(included).toHaveLength(64)
    expect(changedSet).not.toBe(included)
    expect(excludedWithOtherSet).toBe(excluded)
  })

  it('returns at most three complete examples and rewrites citation markers', () => {
    const selected = boundResponseExampleSearchResults([
      candidate('1'),
      candidate('2'),
      candidate('3'),
      candidate('4'),
    ])

    expect(selected).toHaveLength(3)
    expect(selected[0]?.referenceAnswer).toBe(
      'Use the concept [example-source-1].'
    )
    expect(JSON.stringify(selected)).not.toMatch(/\[1\]/)
    expect(selected[0]).not.toHaveProperty('evidenceReferences')
    expect(selected[0]?.sourceAnchors).toEqual([
      { citationIndex: 1, citationAnchor: 'page 1' },
    ])
    expect(selected[0]).not.toHaveProperty('sourceId')
    expect(selected[0]).not.toHaveProperty('chunkId')
    expect(selected[0]).not.toHaveProperty('contentHash')
  })

  it('removes every renderer-compatible citation marker from ideal answers', () => {
    const selected = boundResponseExampleSearchResults([
      candidate('1', 'Use the grounded concept [1], then compare it [2].'),
    ])

    expect(selected[0]?.referenceAnswer).toBe(
      'Use the grounded concept [example-source-1], then compare it [example-source-2].'
    )
    expect(JSON.stringify(selected)).not.toMatch(/\[\d+\]/)
  })

  it('skips an example that cannot fit without truncating later examples', () => {
    const oversized = candidate(
      'oversized',
      'x'.repeat(RESPONSE_EXAMPLE_SEARCH_MAX_CHARACTERS)
    )
    const selected = boundResponseExampleSearchResults([
      oversized,
      candidate('fits'),
    ])

    expect(selected).toHaveLength(1)
    expect(selected[0]?.id).toBe('fits')
    expect(
      JSON.stringify({ degraded: false, examples: selected }).length
    ).toBeLessThanOrEqual(RESPONSE_EXAMPLE_SEARCH_MAX_CHARACTERS)
  })
})
