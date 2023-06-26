import { IconDefinition } from '@fortawesome/free-regular-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Button } from '@uzh-bf/design-system'

interface CourseListButtonProps {
  key?: string
  onClick: () => void
  icon: IconDefinition
  label: string
}

function CourseListButton({
  key,
  onClick,
  icon,
  label,
}: CourseListButtonProps) {
  return (
    <Button
      key={key}
      className={{
        root: 'w-full p-2 border border-solid rounded-md bg-uzh-grey-40 border-uzh-grey-100',
      }}
      onClick={onClick}
    >
      <Button.Icon className={{ root: 'ml-1 mr-3' }}>
        <FontAwesomeIcon icon={icon} />
      </Button.Icon>
      <Button.Label>{label}</Button.Label>
    </Button>
  )
}

export default CourseListButton
