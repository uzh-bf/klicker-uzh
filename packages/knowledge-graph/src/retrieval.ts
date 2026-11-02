import type { KnowledgeGraphNode } from '@klicker-uzh/types'
import { KnowledgeGraphInputError } from './queries.js'

export const GRAPH_SEARCH_SEED_LIMIT = 4
export const GRAPH_SEARCH_HINT_LIMIT = 6
export const GRAPH_SEARCH_QUERY_TIMEOUT_MS = 500
export const GRAPH_SEARCH_NODE_SCAN_LIMIT = 10_000
export const GRAPH_SEARCH_ADJACENCY_LIMIT = 1000

const STOP_WORDS = new Set(
  'a an and are as at be by can do does for from how i in is it of on or that the this to what when where which why with und oder der die das den dem des ein eine einer einem einen ist sind wie was warum welche welcher welches mit von zu im in auf für'.split(
    ' '
  )
)

function queryTokens(query: string): string[] {
  if (typeof query !== 'string' || query.length > 2000 || !query.trim()) {
    throw new KnowledgeGraphInputError('Invalid graph search query')
  }
  const tokens = query.toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}-]*/gu) ?? []
  return tokens.length <= 100 ? tokens : []
}

export function graphSearchTerms(query: string): string[] {
  return [...new Set(queryTokens(query))].filter(
    (term) => term.length >= 2 && !STOP_WORDS.has(term)
  )
}

/** Exact display-label anchors; no substring matches or inferred aliases. */
export function selectGraphSearchSeeds(
  nodes: KnowledgeGraphNode[],
  query: string
): KnowledgeGraphNode[] {
  const tokens = queryTokens(query)
  const phrases = new Map<string, { position: number; length: number }>()
  for (let position = 0; position < tokens.length; position++) {
    for (
      let length = 1;
      length <= Math.min(6, tokens.length - position);
      length++
    ) {
      const phrase = tokens.slice(position, position + length).join(' ')
      if (phrase.length < 2 || phrase.length > 100 || STOP_WORDS.has(phrase))
        continue
      if (!phrases.has(phrase)) phrases.set(phrase, { position, length })
    }
  }
  const matches = nodes
    .flatMap((node) => {
      if (
        node.displayLabel.length > 100 ||
        /^Concept \d+$/.test(node.displayLabel)
      )
        return []
      const label = queryTokens(node.displayLabel).join(' ')
      const match = phrases.get(label)
      return match ? [{ node, label, ...match }] : []
    })
    .sort(
      (a, b) =>
        b.length - a.length ||
        b.label.length - a.label.length ||
        a.position - b.position ||
        (BigInt(a.node.id) < BigInt(b.node.id) ? -1 : 1)
    )
  const selected: typeof matches = []
  for (const match of matches) {
    if (
      selected.some(
        (other) =>
          match.position < other.position + other.length &&
          other.position < match.position + match.length
      )
    )
      continue
    selected.push(match)
    if (selected.length === GRAPH_SEARCH_SEED_LIMIT) break
  }
  return selected.map(({ node }) => node)
}

export function graphSearchSeedsQuery() {
  return {
    cypher: `
      MATCH (n)
      WITH n LIMIT ${GRAPH_SEARCH_NODE_SCAN_LIMIT + 1}
      RETURN id(n) AS id, [] AS labels,
        {name: CASE WHEN size(toString(n.name)) <= 100 THEN n.name ELSE null END,
         title: CASE WHEN size(toString(n.title)) <= 100 THEN n.title ELSE null END,
         entity: CASE WHEN size(toString(n.entity)) <= 100 THEN n.entity ELSE null END}
          AS properties, 0 AS degree
    `,
    params: {},
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
      WITH seed, relation, neighbor LIMIT ${GRAPH_SEARCH_ADJACENCY_LIMIT + 1}
      WITH collect({seed: seed, relation: relation, neighbor: neighbor}) AS rows
      WHERE size(rows) <= ${GRAPH_SEARCH_ADJACENCY_LIMIT}
      UNWIND rows AS row
      WITH row.seed AS seed, row.relation AS relation, row.neighbor AS neighbor
      WHERE NOT id(neighbor) IN [seedId IN $seedIds | toInteger(seedId)]
      WITH neighbor, count(DISTINCT seed) AS support,
        max(size([term IN $terms WHERE
          any(value IN [substring(toString(relation.keywords), 0, 2000), substring(toString(relation.description), 0, 2000), substring(toString(neighbor.name), 0, 100)]
            WHERE value IS NOT NULL AND toLower(toString(value)) CONTAINS term)])) AS relevance
      RETURN id(neighbor) AS id, [] AS labels,
        {name: CASE WHEN size(toString(neighbor.name)) <= 100 THEN neighbor.name ELSE null END,
         title: CASE WHEN size(toString(neighbor.title)) <= 100 THEN neighbor.title ELSE null END,
         entity: CASE WHEN size(toString(neighbor.entity)) <= 100 THEN neighbor.entity ELSE null END}
          AS properties, 0 AS degree
      ORDER BY relevance DESC, support DESC, id(neighbor) ASC
      LIMIT ${GRAPH_SEARCH_HINT_LIMIT}
    `,
    params: { seedIds, terms },
  }
}

export const GRAPH_MENTION_LIMIT = 12
const GRAPH_MENTION_TEXT_LIMIT = 8000
const GRAPH_MENTION_PHRASE_TOKENS = 6

/** "Head (Alias)" -> "Head"; undefined without one trailing parenthetical. */
function labelHead(label: string): string | undefined {
  if (!label.endsWith(')')) return undefined
  const open = label.lastIndexOf('(')
  if (open <= 0 || label.slice(open + 1, -1).includes(')')) return undefined
  const head = label.slice(0, open).trimEnd()
  return head.length > 0 ? head : undefined
}

export type KnowledgeGraphMention = {
  node: KnowledgeGraphNode
  /** The phrase as it appears in the text, for locating it in rendered output. */
  text: string
}

function mentionKey(value: string): string {
  return (value.toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}-]*/gu) ?? []).join(
    ' '
  )
}

/**
 * Maps each concept label, and the head of a label ending in a parenthetical
 * alias ("Net present value (NPV)" -> "net present value"), to exactly one
 * concept. A key shared by several concepts resolves to the concept whose full
 * label equals it, and is dropped when that is still ambiguous, so a link never
 * points at a guessed concept.
 */
function mentionIndex(
  nodes: KnowledgeGraphNode[]
): Map<string, KnowledgeGraphNode> {
  const candidates = new Map<
    string,
    { full: KnowledgeGraphNode[]; head: KnowledgeGraphNode[] }
  >()
  const add = (key: string, node: KnowledgeGraphNode, full: boolean) => {
    if (key.length < 3 || STOP_WORDS.has(key)) return
    const entry = candidates.get(key) ?? { full: [], head: [] }
    entry[full ? 'full' : 'head'].push(node)
    candidates.set(key, entry)
  }
  for (const node of nodes) {
    const label = node.displayLabel.trim()
    if (label.length > 100 || /^Concept \d+$/.test(label)) continue
    add(mentionKey(label), node, true)
    const head = labelHead(label)
    if (head) add(mentionKey(head), node, false)
  }
  const index = new Map<string, KnowledgeGraphNode>()
  for (const [key, { full, head }] of candidates) {
    // Full-label matches take precedence over label heads, and the key links
    // only when exactly one concept remains.
    const matches = full.length > 0 ? full : head
    const [only] = matches
    if (matches.length === 1 && only) index.set(key, only)
  }
  return index
}

/**
 * Finds concept labels named verbatim in a text. Longer phrases win over the
 * words inside them, each concept is reported once at its first occurrence,
 * and matches are returned in text order.
 */
export function selectGraphMentions(
  nodes: KnowledgeGraphNode[],
  text: string,
  limit = GRAPH_MENTION_LIMIT
): KnowledgeGraphMention[] {
  const bounded = text.slice(0, GRAPH_MENTION_TEXT_LIMIT)
  const index = mentionIndex(nodes)
  if (index.size === 0) return []
  const tokens = [...bounded.matchAll(/[\p{L}\p{N}][\p{L}\p{N}-]*/gu)].map(
    (match) => ({
      value: match[0].toLowerCase(),
      start: match.index,
      end: match.index + match[0].length,
    })
  )
  const mentions: KnowledgeGraphMention[] = []
  const seen = new Set<string>()
  let position = 0
  while (position < tokens.length && mentions.length < limit) {
    let matched = 0
    for (
      let length = Math.min(
        GRAPH_MENTION_PHRASE_TOKENS,
        tokens.length - position
      );
      length > 0;
      length--
    ) {
      const phrase = tokens
        .slice(position, position + length)
        .map((token) => token.value)
        .join(' ')
      const node = index.get(phrase)
      if (!node) continue
      matched = length
      if (!seen.has(node.id)) {
        seen.add(node.id)
        mentions.push({
          node,
          text: bounded.slice(
            tokens[position]!.start,
            tokens[position + length - 1]!.end
          ),
        })
      }
      break
    }
    position += Math.max(matched, 1)
  }
  return mentions
}
