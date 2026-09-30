// Client-side sorting for element lists in competence tree assignment and
// adaptive evaluation views. All sorts are stable (Array.prototype.sort is
// stable since ES2019) and never mutate their input.

export type ElementNameSort = 'default' | 'nameAsc' | 'nameDesc'
export type ElementResponseSort =
  | ElementNameSort
  | 'responsesDesc'
  | 'responsesAsc'

export const ELEMENT_NAME_SORTS: ElementNameSort[] = [
  'default',
  'nameAsc',
  'nameDesc',
]
export const ELEMENT_RESPONSE_SORTS: ElementResponseSort[] = [
  ...ELEMENT_NAME_SORTS,
  'responsesDesc',
  'responsesAsc',
]

export function compareNames(a: string, b: string, locale?: string) {
  return a.localeCompare(b, locale, { numeric: true, sensitivity: 'base' })
}

export function sortByName<T extends { elementName: string }>(
  items: readonly T[],
  sort: ElementNameSort,
  locale?: string
): T[] {
  if (sort === 'default') return [...items]
  const direction = sort === 'nameAsc' ? 1 : -1
  return [...items].sort(
    (a, b) => direction * compareNames(a.elementName, b.elementName, locale)
  )
}

// Suppressed or missing response counts (null/undefined) always sort last,
// independent of direction, so hidden values are never presented as extremes.
// Equal (or equally missing) counts fall back to name A–Z.
export function sortByNameOrResponses<
  T extends { elementName: string; responseCount?: number | null },
>(items: readonly T[], sort: ElementResponseSort, locale?: string): T[] {
  if (sort !== 'responsesDesc' && sort !== 'responsesAsc')
    return sortByName(items, sort, locale)
  const direction = sort === 'responsesAsc' ? 1 : -1
  return [...items].sort((a, b) => {
    const left = a.responseCount
    const right = b.responseCount
    if (left == null || right == null) {
      if (left == null && right == null)
        return compareNames(a.elementName, b.elementName, locale)
      return left == null ? 1 : -1
    }
    return (
      direction * (left - right) ||
      compareNames(a.elementName, b.elementName, locale)
    )
  })
}
