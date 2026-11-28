import { createHash } from 'node:crypto'

type LecturerRatingFormat = 'SC' | 'KPRIM'

type Candidate = {
  id: number
  version: number
  format: LecturerRatingFormat
  originalId?: string | null
  stem: string
  choices: { text: string; correct: boolean }[]
  tags: string[]
}

type NormalizedChoice = {
  correct: boolean
  text: string
}

type LecturerRatingFamily<T> = {
  key: string
  representative: T
  tags: Set<string>
  words: Set<string>
}

const FORMAT_ORDER: LecturerRatingFormat[] = ['SC', 'KPRIM']
const MAX_ITEMS_PER_FORMAT = 10

function normalizeText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('en')
    .replace(/(?<=\d)[.,](?=\d)/gu, ' decimal ')
    .replace(/[^\p{L}\p{N}+%<>=≤≥−×÷/^-]+/gu, ' ')
    .trim()
}

function getTokens(value: string): Set<string> {
  return new Set(
    normalizeText(value)
      .split(' ')
      .filter((token) => token.length > 1)
  )
}

function getCanonicalChoices(
  choices: { text: string; correct: boolean }[]
): NormalizedChoice[] {
  return choices
    .map((choice) => ({
      correct: choice.correct,
      text: normalizeText(choice.text),
    }))
    .sort((left, right) => {
      if (left.correct !== right.correct) return left.correct ? 1 : -1
      return left.text.localeCompare(right.text, 'en')
    })
}

function getCanonicalItemKey(
  item: Pick<Candidate, 'format' | 'stem' | 'choices'>
): string {
  const choices = getCanonicalChoices(item.choices)
  return JSON.stringify([
    item.format,
    normalizeText(item.stem).replace(
      /^(which of the following|welche der folgenden) /,
      ''
    ),
    choices,
  ])
}

export function getLecturerRatingFamilyKey(
  item: Pick<Candidate, 'format' | 'stem' | 'choices'>
): string {
  return createHash('sha256').update(getCanonicalItemKey(item)).digest('hex')
}

function compareRepresentatives<T extends Candidate>(
  left: T,
  right: T
): number {
  if (left.version !== right.version) return right.version - left.version
  if (left.id !== right.id) return left.id - right.id

  const leftKey = getCanonicalItemKey(left)
  const rightKey = getCanonicalItemKey(right)
  return leftKey.localeCompare(rightKey, 'en')
}

function getFamilyKey<T extends Candidate>(item: T): string {
  const representativeToken = `${item.version}:${item.id}`
  const lineage = item.originalId?.trim()
  return `${getCanonicalItemKey(item)}|source:${lineage || representativeToken}`
}

function buildFamilies<T extends Candidate>(
  format: LecturerRatingFormat,
  candidates: T[]
): LecturerRatingFamily<T>[] {
  const members = candidates.filter((candidate) => candidate.format === format)
  const parent = members.map((_, index) => index)

  const find = (index: number): number => {
    let root = index
    while (parent[root] !== root) root = parent[root]!

    let current = index
    while (parent[current] !== current) {
      const next = parent[current]!
      parent[current] = root
      current = next
    }
    return root
  }

  const union = (left: number, right: number) => {
    const leftRoot = find(left)
    const rightRoot = find(right)
    if (leftRoot !== rightRoot) parent[rightRoot] = leftRoot
  }

  const lineageMembers = new Map<string, number>()
  const duplicateMembers = new Map<string, number>()

  members.forEach((candidate, index) => {
    // Shared copies record their source element ID. Link both identifiers so
    // that copies of copies coalesce even when input order is reversed.
    for (const identifier of [
      String(candidate.id),
      candidate.originalId?.trim(),
    ]) {
      if (!identifier) continue
      const previous = lineageMembers.get(identifier)
      if (previous === undefined) lineageMembers.set(identifier, index)
      else union(index, previous)
    }

    const duplicateKey = getCanonicalItemKey(candidate)
    const previousDuplicate = duplicateMembers.get(duplicateKey)
    if (typeof previousDuplicate === 'number') {
      union(index, previousDuplicate)
    } else {
      duplicateMembers.set(duplicateKey, index)
    }
  })

  const groupedMembers = new Map<number, T[]>()
  members.forEach((candidate, index) => {
    const root = find(index)
    const group = groupedMembers.get(root)
    if (group) group.push(candidate)
    else groupedMembers.set(root, [candidate])
  })

  return Array.from(groupedMembers.values()).map((group) => {
    const ordered = [...group].sort(compareRepresentatives)
    const representative = ordered[0]!
    const tags = new Set<string>()
    const words = new Set<string>()

    ordered.forEach((candidate) => {
      candidate.tags.forEach((tag) => {
        const normalized = normalizeText(tag)
        if (normalized) tags.add(normalized)
      })
      getTokens(candidate.stem).forEach((token) => words.add(token))
    })

    return {
      key: getFamilyKey(representative),
      representative,
      tags,
      words,
    }
  })
}

function getWordingDistance(left: Set<string>, right: Set<string>): number {
  if (left.size === 0 && right.size === 0) return 0

  let intersection = 0
  left.forEach((word) => {
    if (right.has(word)) intersection += 1
  })
  const unionSize = left.size + right.size - intersection
  return unionSize === 0 ? 0 : 1 - intersection / unionSize
}

function selectFamilies<T extends Candidate>(
  families: LecturerRatingFamily<T>[],
  limit: number
): T[] {
  if (limit === 0) return []

  const selected: LecturerRatingFamily<T>[] = []
  const remaining = new Map(families.map((family) => [family, 1]))
  const coveredTags = new Set<string>()
  const coveredWords = new Set<string>()
  while (remaining.size > 0 && selected.length < limit) {
    let next: LecturerRatingFamily<T> | undefined
    let bestTags = -1
    let bestDistance = -1
    let bestWords = -1
    for (const [family, distance] of remaining) {
      const newTags = [...family.tags].filter(
        (tag) => !coveredTags.has(tag)
      ).length
      const newWords = [...family.words].filter(
        (word) => !coveredWords.has(word)
      ).length
      if (
        newTags > bestTags ||
        (newTags === bestTags &&
          (distance > bestDistance ||
            (distance === bestDistance &&
              (newWords > bestWords ||
                (newWords === bestWords &&
                  next &&
                  family.key.localeCompare(next.key, 'en') < 0)))))
      ) {
        next = family
        bestTags = newTags
        bestDistance = distance
        bestWords = newWords
      }
    }
    if (!next) break
    selected.push(next)
    remaining.delete(next)
    next.tags.forEach((tag) => coveredTags.add(tag))
    next.words.forEach((word) => coveredWords.add(word))
    for (const [family, distance] of remaining) {
      remaining.set(
        family,
        Math.min(distance, getWordingDistance(family.words, next.words))
      )
    }
  }

  return selected.map((family) => family.representative)
}

export function selectLecturerRatingFamilies<T extends Candidate>(
  candidates: T[],
  limitPerFormat = 10
): T[] {
  const limit = Number.isFinite(limitPerFormat)
    ? Math.max(0, Math.min(MAX_ITEMS_PER_FORMAT, Math.floor(limitPerFormat)))
    : MAX_ITEMS_PER_FORMAT

  return FORMAT_ORDER.flatMap((format) =>
    selectFamilies(buildFamilies(format, candidates), limit)
  )
}
