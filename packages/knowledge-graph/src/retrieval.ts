import { KnowledgeGraphInputError } from './queries.js'

export const GRAPH_SEARCH_SEED_LIMIT = 4
export const GRAPH_SEARCH_HINT_LIMIT = 6
export const GRAPH_SEARCH_QUERY_TIMEOUT_MS = 500

const STOP_WORDS = new Set(
  'a an and are as at be by can do does for from how i in is it of on or that the this to what when where which why with und oder der die das den dem des ein eine einer einem einen ist sind wie was warum welche welcher welches mit von zu im in auf für'.split(
    ' '
  )
)

export function graphSearchTerms(query: string): string[] {
  if (typeof query !== 'string' || query.length > 2000 || !query.trim()) {
    throw new KnowledgeGraphInputError('Invalid graph search query')
  }
  return [...new Set(query.toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}-]*/gu))]
    .filter((term) => term.length >= 3 && !STOP_WORDS.has(term))
    .slice(0, 8)
}

export function graphSearchSeedsQuery(terms: string[]) {
  return {
    cypher: `
      MATCH (n)
      WITH n, size([term IN $terms WHERE
        any(value IN [n.name, n.title, n.entity] WHERE value IS NOT NULL
          AND toLower(toString(value)) CONTAINS term)]) AS score
      WHERE score > 0
      RETURN id(n) AS id, labels(n) AS labels, properties(n) AS properties,
        0 AS degree
      ORDER BY score DESC, id(n) ASC
      LIMIT ${GRAPH_SEARCH_SEED_LIMIT}
    `,
    params: { terms },
  }
}

export function graphSearchNeighborsQuery(seedIds: string[], terms: string[]) {
  if (
    seedIds.length > GRAPH_SEARCH_SEED_LIMIT ||
    seedIds.some((id) => !/^\d+$/.test(id))
  ) {
    throw new KnowledgeGraphInputError('Invalid graph search seeds')
  }
  return {
    cypher: `
      MATCH (seed)-[relation]-(neighbor)
      WHERE id(seed) IN [seedId IN $seedIds | toInteger(seedId)]
        AND NOT id(neighbor) IN [seedId IN $seedIds | toInteger(seedId)]
      WITH neighbor, count(DISTINCT seed) AS support,
        max(size([term IN $terms WHERE
          any(value IN [relation.keywords, relation.description, neighbor.name]
            WHERE value IS NOT NULL AND toLower(toString(value)) CONTAINS term)])) AS relevance
      RETURN id(neighbor) AS id, labels(neighbor) AS labels,
        properties(neighbor) AS properties, 0 AS degree
      ORDER BY relevance DESC, support DESC, id(neighbor) ASC
      LIMIT ${GRAPH_SEARCH_HINT_LIMIT}
    `,
    params: { seedIds, terms },
  }
}
