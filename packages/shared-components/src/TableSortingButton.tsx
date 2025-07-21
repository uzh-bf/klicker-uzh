import { faSort, faSortDown, faSortUp } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Button } from '@uzh-bf/design-system'
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
      className={{
        root: twMerge(
          'pl-0! hover:bg-transparen h-7 whitespace-nowrap',
          buttonTextSize
        ),
      }}
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
