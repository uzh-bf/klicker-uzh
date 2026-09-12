import { describe, expect, it } from 'vitest'
import {
  graphSearchNeighborsQuery,
  graphSearchSeedsQuery,
  graphSearchTerms,
} from '../src/retrieval.js'

describe('native graph retrieval queries', () => {
  it('extracts bounded multilingual terms without adding query text to Cypher', () => {
    const terms = graphSearchTerms(
      'How does Korrelation affect diversification?'
    )
    expect(terms).toEqual(['korrelation', 'affect', 'diversification'])
    const query = graphSearchSeedsQuery(terms)
    expect(query.params.terms).toEqual(terms)
    expect(query.cypher).not.toContain('korrelation')
  })
  it('bounds term count and rejects oversized input', () => {
    expect(
      graphSearchTerms('one two three four five six seven eight nine ten')
    ).toHaveLength(8)
    expect(() => graphSearchTerms('x'.repeat(2001))).toThrow()
    expect(graphSearchTerms('how does it')).toEqual([])
  })
  it('rejects injected graph IDs before database access', () => {
    expect(() => graphSearchNeighborsQuery(['1) DELETE n'], ['risk'])).toThrow()
    expect(() =>
      graphSearchNeighborsQuery(['1', '2', '3', '4', '5'], ['risk'])
    ).toThrow()
    expect(graphSearchNeighborsQuery(['1'], ['risk']).params).toEqual({
      seedIds: ['1'],
      terms: ['risk'],
    })
  })
})
