import { IconDefinition } from '@fortawesome/free-regular-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { twMerge } from 'tailwind-merge'

interface FilterItemProps {
  text: string
  icon: IconDefinition[]
  active: boolean
  disabled?: boolean
  onClick: () => void
  tooltip?: string
  data?: { cy?: string; test?: string }
}

function FilterItem({
  text,
  icon,
  active,
  disabled,
  onClick,
  tooltip,
  data,
}: FilterItemProps) {
  const tooltipId = tooltip && data?.cy ? `description-${data.cy}` : undefined

  return (
    <li className="group relative list-none">
      <button
        type="button"
        disabled={disabled}
        aria-pressed={active}
        aria-describedby={tooltipId}
        onClick={onClick}
        data-cy={data?.cy}
        data-test={data?.test}
        className={twMerge(
          'hover:text-primary-100 flex w-full cursor-pointer items-center px-2 py-0.5 text-left',
          active && 'text-primary-100',
          disabled &&
            'hover:text-uzh-grey-100 text-uzh-grey-100 cursor-not-allowed'
        )}
      >
        <FontAwesomeIcon
          icon={active ? icon[1] : icon[0]}
          className="mr-2 w-4 flex-none"
        />
        <span className="line-clamp-1">{text}</span>
      </button>
      {tooltip ? (
        <span
          id={tooltipId}
          role="tooltip"
          data-cy={tooltipId}
          className="pointer-events-none invisible absolute top-full left-2 z-30 mt-1 w-max max-w-52 rounded-md bg-slate-700 px-2 py-1 text-left text-xs leading-snug whitespace-normal text-white opacity-0 shadow-md transition-opacity group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
        >
          {tooltip}
        </span>
      ) : null}
    </li>
  )
}

export default FilterItem
