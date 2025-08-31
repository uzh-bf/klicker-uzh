import { useMemo } from 'react'

function usePaginationPageNumbers({
  currentPage,
  totalPages,
}: {
  currentPage: number
  totalPages: number
}) {
  return useMemo<(number | 'ellipsis')[]>(() => {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, i) => i + 1)
    }

    // initialize the pagination with the first page
    const pages: (number | 'ellipsis')[] = []
    pages.push(1)

    // determine the range of pages that should be shown around the currently selected one
    let startRange: number
    let endRange: number
    if (currentPage <= 3) {
      startRange = 2
      endRange = Math.min(4, totalPages - 1)
    } else if (currentPage >= totalPages - 2) {
      startRange = Math.max(totalPages - 3, 2)
      endRange = totalPages - 1
    } else {
      startRange = currentPage - 1
      endRange = currentPage + 1
    }

    // if the range does not start at the second page, add an ellipsis
    if (startRange > 2) {
      pages.push('ellipsis')
    }

    // add all pages that are part of the range around the currently selected one
    for (let i = startRange; i <= endRange; i++) {
      if (i > 1 && i < totalPages) {
        pages.push(i)
      }
    }

    // if the range does not end at the second to last page, add an ellipsis
    if (endRange < totalPages - 1) {
      pages.push('ellipsis')
    }

    // always add the last page if there are more than one pages
    if (totalPages > 1) {
      pages.push(totalPages)
    }

    return pages
  }, [totalPages, currentPage])
}

export default usePaginationPageNumbers
