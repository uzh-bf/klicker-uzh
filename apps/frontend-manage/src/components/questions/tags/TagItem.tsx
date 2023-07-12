import { IconDefinition } from '@fortawesome/free-regular-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { twMerge } from 'tailwind-merge'

interface TagItemProps {
  text: string
  icon: IconDefinition
  active: boolean
  onClick: () => void
}

function TagItem({ text, icon, active, onClick }: TagItemProps) {
  return (
    <li
      className={twMerge(
        'px-4 py-0.5 hover:cursor-pointer sm:hover:text-primary',
        active && 'text-primary'
      )}
      onClick={onClick}
    >
      <FontAwesomeIcon icon={icon} className="mr-2" />
      {text}
    </li>
  )
}

export default TagItem
