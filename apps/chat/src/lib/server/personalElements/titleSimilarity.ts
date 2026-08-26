import type { CardPlanInput } from './contracts'

export const CARD_TITLE_SIMILARITY_THRESHOLD = 0.8

export type DiscardedDuplicateCard = {
  title: string
  matchedTitle: string
  similarity: number
}

function normalizeTitle(value: string) {
  return value
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

function titleTokens(value: string) {
  const words = normalizeTitle(value).split(/\s+/).filter(Boolean)
  const tokens = new Set(words)

  // Titles often mix an abbreviation with its expanded form (for example,
  // "CAPM" and "Capital Asset Pricing Model"). Add short initialisms so the
  // deterministic check catches that common duplicate shape without a model.
  for (let start = 0; start < words.length; start += 1) {
    for (
      let length = 3;
      length <= 5 && start + length <= words.length;
      length += 1
    ) {
      tokens.add(
        words
          .slice(start, start + length)
          .map((word) => word[0])
          .join('')
      )
    }
  }

  return tokens
}

function characterNgrams(value: string) {
  const normalized = normalizeTitle(value).replace(/\s+/g, ' ')
  if (normalized.length < 3) return new Set(normalized ? [normalized] : [])

  const ngrams = new Set<string>()
  for (let index = 0; index <= normalized.length - 3; index += 1) {
    ngrams.add(normalized.slice(index, index + 3))
  }
  return ngrams
}

function jaccardSimilarity<T>(left: Set<T>, right: Set<T>) {
  if (left.size === 0 || right.size === 0) return 0

  let intersection = 0
  for (const value of left) {
    if (right.has(value)) intersection += 1
  }
  return intersection / (left.size + right.size - intersection)
}

function isInitialismOf(shortTitle: string, longTitle: string) {
  if (!/^\p{L}{3,5}$/u.test(shortTitle)) return false
  const words = longTitle.split(/\s+/).filter(Boolean)
  return (
    words.length >= 3 && words.map((word) => word[0]).join('') === shortTitle
  )
}

/**
 * Compares titles without sending them to another provider. Exact matches,
 * token-subset variants, and close spelling variants are treated as possible
 * duplicates; this is intentionally a conservative pre-generation gate.
 */
export function cardTitleSimilarity(left: string, right: string) {
  const normalizedLeft = normalizeTitle(left)
  const normalizedRight = normalizeTitle(right)
  if (!normalizedLeft || !normalizedRight) return 0
  if (normalizedLeft === normalizedRight) return 1

  if (
    isInitialismOf(normalizedLeft, normalizedRight) ||
    isInitialismOf(normalizedRight, normalizedLeft)
  ) {
    return 0.95
  }

  const leftTokens = titleTokens(left)
  const rightTokens = titleTokens(right)
  const tokenSimilarity = jaccardSimilarity(leftTokens, rightTokens)
  const shorterTokenCount = Math.min(leftTokens.size, rightTokens.size)
  let similarity = tokenSimilarity

  // Do not let a one-word title such as "Overview" suppress every longer
  // title containing that word. Multi-word subsets are materially stronger.
  const leftIsSubset = [...leftTokens].every((token) => rightTokens.has(token))
  const rightIsSubset = [...rightTokens].every((token) => leftTokens.has(token))
  if (
    shorterTokenCount >= 2 &&
    tokenSimilarity > 0 &&
    (leftIsSubset || rightIsSubset)
  ) {
    similarity = Math.max(similarity, 0.9)
  }

  return Math.max(
    similarity,
    jaccardSimilarity(characterNgrams(left), characterNgrams(right))
  )
}

export function findPotentialDuplicateTitle(
  title: string,
  existingTitles: readonly string[]
) {
  let match: { matchedTitle: string; similarity: number } | null = null

  for (const existingTitle of existingTitles) {
    const similarity = cardTitleSimilarity(title, existingTitle)
    if (
      similarity >= CARD_TITLE_SIMILARITY_THRESHOLD &&
      (!match || similarity > match.similarity)
    ) {
      match = { matchedTitle: existingTitle, similarity }
    }
  }

  return match
}

export function discardPotentialDuplicateCards(
  cards: CardPlanInput['cards'],
  existingTitles: readonly string[]
) {
  const retained: CardPlanInput['cards'] = []
  const discardedDuplicates: DiscardedDuplicateCard[] = []
  const titlesToCompare = [...existingTitles]

  for (const card of cards) {
    const match = findPotentialDuplicateTitle(card.title, titlesToCompare)
    if (match) {
      discardedDuplicates.push({ title: card.title, ...match })
      continue
    }
    retained.push(card)
    titlesToCompare.push(card.title)
  }

  return { retained, discardedDuplicates }
}
