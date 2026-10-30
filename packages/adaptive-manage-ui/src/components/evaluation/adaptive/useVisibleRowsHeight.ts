import { useEffect, useRef, useState } from 'react'

/** Rows a scrollable table shows before older ones are a scroll away. */
export const VISIBLE_ROWS = 5

// Height of the table head plus the first `VISIBLE_ROWS` rows, measured so it
// fits however the rows wrap. Rows matching `expandedSelector` (an opened
// detail) add their height, so an opened row is not squeezed. Null while all
// rows fit anyway.
export function useVisibleRowsHeight({
  rowCount,
  rowSelector = 'tbody tr',
  expandedSelector,
}: {
  rowCount: number
  rowSelector?: string
  expandedSelector?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState<number | null>(null)
  useEffect(() => {
    const container = ref.current
    if (!container) return
    const sum = (elements: Element[]) =>
      elements.reduce(
        (total, element) => total + element.getBoundingClientRect().height,
        0
      )
    const measure = () => {
      const head = container.querySelector('thead')
      if (!head || rowCount <= VISIBLE_ROWS) return setHeight(null)
      const rows = [...container.querySelectorAll(rowSelector)]
      const expanded = expandedSelector
        ? [...container.querySelectorAll(expandedSelector)]
        : []
      setHeight(
        // borders and a horizontal scrollbar take room too
        container.offsetHeight -
          container.clientHeight +
          head.getBoundingClientRect().height +
          sum(rows.slice(0, VISIBLE_ROWS)) +
          sum(expanded)
      )
    }
    measure()
    // The table grows when a row opens, so watch it as well.
    const observer = new ResizeObserver(measure)
    observer.observe(container)
    const table = container.querySelector('table')
    if (table) observer.observe(table)
    return () => observer.disconnect()
  }, [rowCount, rowSelector, expandedSelector])
  return { ref, height }
}
