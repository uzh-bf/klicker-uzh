import { useMemo } from 'react'

export default function usePaginationPageNumbers({
  currentPage,
  totalPages,
}: {
  currentPage: number
  totalPages: number
}) {
  return useMemo<(number | 'ellipsis')[]>(() => {
    if (totalPages <= 5)
      return Array.from({ length: totalPages }, (_, index) => index + 1)
    const pages: (number | 'ellipsis')[] = [1]
    const [start, end] =
      currentPage <= 3
        ? [2, Math.min(4, totalPages - 1)]
        : currentPage >= totalPages - 2
          ? [Math.max(totalPages - 3, 2), totalPages - 1]
          : [currentPage - 1, currentPage + 1]
    if (start > 2) pages.push('ellipsis')
    for (let page = start; page <= end; page++)
      if (page > 1 && page < totalPages) pages.push(page)
    if (end < totalPages - 1) pages.push('ellipsis')
    pages.push(totalPages)
    return pages
  }, [currentPage, totalPages])
}
