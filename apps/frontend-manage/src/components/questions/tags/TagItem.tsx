import { IconDefinition } from '@fortawesome/free-regular-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Tooltip } from '@uzh-bf/design-system'
import { twMerge } from 'tailwind-merge'

interface TagItemProps {
  text: string
  icon: IconDefinition[]
  active: boolean
  disabled?: boolean
  onClick: () => void
  tooltip?: string
  data?: { cy?: string; test?: string }
}

function TagItem({
  text,
  icon,
  active,
  disabled,
  onClick,
  tooltip,
  data,
}: TagItemProps) {
  const TagItem = (
    <li
      className={twMerge(
        'hover:text-primary-100 cursor-pointer px-2 py-0.5',
        active && 'text-primary-100',
        disabled &&
          'hover:text-uzh-grey-100 text-uzh-grey-100 cursor-not-allowed'
      )}
      onClick={disabled ? undefined : onClick}
      data-cy={data?.cy}
      data-test={data?.test}
    >
      <FontAwesomeIcon icon={active ? icon[1] : icon[0]} className="mr-2 w-4" />
      {text}
    </li>
  )

  return tooltip ? (
    <Tooltip tooltip={tooltip} delay={700}>
      {TagItem}
    </Tooltip>
  ) : (
    TagItem
  )
}

export default TagItem
