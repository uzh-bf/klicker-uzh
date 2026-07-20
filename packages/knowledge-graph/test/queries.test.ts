import { describe, expect, it } from 'vitest'

import {
  getEdgesForNodeIdsQuery,
  getNeighborhoodNodesQuery,
  getOverviewNodesQuery,
  getSearchNodesQuery,
} from '../src/queries.js'

describe('fixed knowledge graph queries', () => {
  it('selects one extra overview node and edge to detect truncation', () => {
    const nodes = getOverviewNodesQuery()
    const edges = getEdgesForNodeIdsQuery(['1', '2'], 'overview')

    expect(nodes.cypher).toContain('LIMIT 251')
    expect(edges.cypher).toContain('LIMIT 501')
    expect(edges.params).toEqual({ nodeIds: ['1', '2'] })
  })

  it('keeps search text parameterized and bounded', () => {
    const userText = 'Android Security'
    const query = getSearchNodesQuery(`  ${userText}  `)

    expect(query.cypher).toContain('LIMIT 21')
    expect(query.cypher).not.toContain(userText)
    expect(query.params).toEqual({ searchText: userText })
  })

  it.each(['', '   ', 'x'.repeat(101)])(
    'rejects invalid search text %j',
    (searchText) => {
      expect(() => getSearchNodesQuery(searchText)).toThrow(
        'Search text must contain between 1 and 100 characters'
      )
    }
  )

  it('keeps decimal neighborhood IDs parameterized and bounded', () => {
    const query = getNeighborhoodNodesQuery('12345678901234567890')

    expect(query.cypher).toContain('LIMIT 101')
    expect(query.cypher).not.toContain('12345678901234567890')
    expect(query.params).toEqual({ nodeId: '12345678901234567890' })

    const edges = getEdgesForNodeIdsQuery(['1', '2'], 'neighbors')
    expect(edges.cypher).toContain('LIMIT 201')
  })

  it.each(['-1', '1.2', '1 OR 1=1', ' 1', ''])(
    'rejects non-decimal node ID %j',
    (nodeId) => {
      expect(() => getNeighborhoodNodesQuery(nodeId)).toThrow(
        'Node ID must be a decimal integer'
      )
    }
  )

  it('rejects invalid internally selected IDs before constructing edge reads', () => {
    expect(() =>
      getEdgesForNodeIdsQuery(['1', '2) MATCH (n) RETURN n'], 'overview')
    ).toThrow('Node ID must be a decimal integer')
  })
})
