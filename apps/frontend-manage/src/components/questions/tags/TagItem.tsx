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
        'px-2 py-0.5 hover:cursor-pointer hover:text-primary-100',
        active && 'text-primary-100'
      )}
      onClick={onClick}
    >
      <FontAwesomeIcon icon={active ? icon[1] : icon[0]} className="w-4 mr-2" />
      {text}
    </li>
  )
}

export default TagItem
