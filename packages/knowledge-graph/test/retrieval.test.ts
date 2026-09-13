import { describe, expect, it } from 'vitest'
import {
  graphSearchNeighborsQuery,
  graphSearchSeedsQuery,
  graphSearchTerms,
  selectGraphSearchSeeds,
} from '../src/retrieval.js'

describe('native graph retrieval queries', () => {
  it('anchors complete phrases and late acronyms without filling unrelated slots', () => {
    const nodes = ['pool', 'cost of capital', 'capital', 'NPV', 'pol'].map(
      (displayLabel, index) => ({
        id: String(index),
        displayLabel,
      })
    ) as Parameters<typeof selectGraphSearchSeeds>[0]
    const selected = selectGraphSearchSeeds(
      nodes,
      'Explain cost of capital; compare it with the final project measure NPV. Pooling differs.'
    )
    expect(selected.map((node) => node.id)).toEqual(['1', '3'])
    expect(selectGraphSearchSeeds(nodes, 'pooling policy')).toEqual([])
  })

  it('extracts bounded multilingual terms without adding query text to Cypher', () => {
    const terms = graphSearchTerms(
      'How does Korrelation affect diversification?'
    )
    expect(terms).toEqual(['korrelation', 'affect', 'diversification'])
    const query = graphSearchSeedsQuery()
    expect(query.params).toEqual({})
    expect(query.cypher).not.toContain('korrelation')
  })
  it('bounds term count and rejects oversized input', () => {
    expect(
      graphSearchTerms('one two three four five six seven eight nine ten')
    ).toHaveLength(10)
    expect(() => graphSearchTerms('x'.repeat(2001))).toThrow()
    expect(graphSearchTerms('word '.repeat(101))).toEqual([])
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
