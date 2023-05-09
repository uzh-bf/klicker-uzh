import { IconDefinition } from '@fortawesome/free-regular-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { ThemeContext } from '@uzh-bf/design-system'
import { useContext } from 'react'
import { twMerge } from 'tailwind-merge'

interface TagItemProps {
  text: string
  icon: IconDefinition
  active: boolean
  onClick: () => void
}

function TagItem({ text, icon, active, onClick }: TagItemProps) {
  const theme = useContext(ThemeContext)

  return (
    <li
      className={twMerge(
        'px-4 py-0.5 hover:cursor-pointer',
        theme.primaryTextHover,
        active && theme.primaryText
      )}
      onClick={onClick}
    >
      <FontAwesomeIcon icon={icon} className="mr-2" />
      {text}
    </li>
  )
}

export default TagItem
