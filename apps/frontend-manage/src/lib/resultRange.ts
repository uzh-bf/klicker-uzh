import type { PaginationPageSize } from '@components/common/Pagination'

export function computeResultRange({
  currentPage,
  pageSize,
  numOfElements,
}: {
  currentPage: number
  pageSize: PaginationPageSize
  numOfElements: number
}): { start: number; end: number; total: number } {
  if (numOfElements === 0) {
    return { start: 0, end: 0, total: 0 }
  }

  const start = pageSize === 'all' ? 1 : (currentPage - 1) * pageSize + 1
  const end =
    pageSize === 'all'
      ? numOfElements
      : Math.min(currentPage * pageSize, numOfElements)

  return { start, end, total: numOfElements }
}
