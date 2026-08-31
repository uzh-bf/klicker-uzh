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
  description?: string
  data?: { cy?: string; test?: string }
}

function FilterItem({
  text,
  icon,
  active,
  disabled,
  onClick,
  tooltip,
  description,
  data,
}: FilterItemProps) {
  const filterItemElement = (
    <li
      className={twMerge(
        'hover:text-primary-100 cursor-pointer px-2 py-0.5',
        description ? 'flex items-start gap-2 py-1' : 'line-clamp-1',
        active && 'text-primary-100',
        disabled &&
          'hover:text-uzh-grey-100 text-uzh-grey-100 cursor-not-allowed'
      )}
      onClick={disabled ? undefined : onClick}
      data-cy={data?.cy}
      data-test={data?.test}
    >
      <FontAwesomeIcon
        icon={active ? icon[1] : icon[0]}
        className={twMerge('mr-2 w-4', description && 'mt-0.5 mr-0 flex-none')}
      />
      {description ? (
        <span className="min-w-0">
          <span className="block">{text}</span>
          <span className="block text-xs leading-snug text-slate-600">
            {description}
          </span>
        </span>
      ) : (
        text
      )}
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
