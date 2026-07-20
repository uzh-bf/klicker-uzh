import { faSort, faSortDown, faSortUp } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Button } from '@uzh-bf/design-system'
import { twMerge } from 'tailwind-merge'

function TableSortingButton({
  column,
  title,
  className,
}: {
  column: any
  title: string
  className?: string
}) {
  return (
    <Button
      variant="ghost"
      onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
      className={{
        root: twMerge(
          'h-auto w-full flex-wrap justify-start whitespace-normal break-words !pl-0 text-left hover:bg-transparent',
          className
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
