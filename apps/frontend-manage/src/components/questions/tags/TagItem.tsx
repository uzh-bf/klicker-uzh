import { IconDefinition } from '@fortawesome/free-regular-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { twMerge } from 'tailwind-merge'

interface TagItemProps {
  text: string
  icon: IconDefinition[]
  active: boolean
  onClick: () => void
}

function TagItem({ text, icon, active, onClick }: TagItemProps) {
  return (
    <li
      className={twMerge(
        'hover:text-primary-100 px-2 py-0.5 hover:cursor-pointer',
        active && 'text-primary-100'
      )}
      onClick={onClick}
    >
      <FontAwesomeIcon icon={active ? icon[1] : icon[0]} className="mr-2 w-4" />
      {text}
    </li>
  )
}

export default TagItem
