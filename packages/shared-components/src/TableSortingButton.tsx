import { faSort, faSortDown, faSortUp } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Button } from '@uzh-bf/design-system/dist/future'
import React from 'react'
import { twMerge } from 'tailwind-merge'

function TableSortingButton({
  column,
  title,
  buttonTextSize,
}: {
  column: any
  title: string
  buttonTextSize?: string
}) {
  return (
    <Button
      variant="ghost"
      onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
      className={twMerge('h-7 !pl-0 hover:bg-transparent', buttonTextSize)}
    >
      {title}
      <FontAwesomeIcon
        icon={
          column.getIsSorted() === 'asc'
            ? faSortUp
            : column.getIsSorted() === 'desc'
              ? faSortDown
              : faSort
        }
        className="ml-2 h-3 w-3"
      />
    </Button>
  )
}

export default TableSortingButton
