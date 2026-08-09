import { IconDefinition } from '@fortawesome/free-regular-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Tooltip } from '@uzh-bf/design-system'
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
  const filterItemElement = (
    <li>
      <button
        type="button"
        className={twMerge(
          'hover:text-primary-100 line-clamp-1 w-full cursor-pointer border-0 bg-transparent px-2 py-0.5 text-left',
          active && 'text-primary-100',
          disabled &&
            'hover:text-uzh-grey-100 text-uzh-grey-100 cursor-not-allowed'
        )}
        onClick={disabled ? undefined : onClick}
        disabled={disabled}
        data-cy={data?.cy}
        data-test={data?.test}
      >
        <FontAwesomeIcon
          icon={active ? icon[1] : icon[0]}
          className="mr-2 w-4"
        />
        {text}
      </button>
    </li>
  )

  return tooltip ? (
    <Tooltip tooltip={tooltip} delay={700}>
      {filterItemElement}
    </Tooltip>
  ) : (
    filterItemElement
  )
}

export default FilterItem
