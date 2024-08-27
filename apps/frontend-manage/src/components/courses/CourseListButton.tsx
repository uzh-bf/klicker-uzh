import { IconDefinition } from '@fortawesome/free-regular-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Button } from '@uzh-bf/design-system'

interface CourseListButtonProps {
  key?: string
  onClick: () => void
  icon: IconDefinition
  label: string
  data?: {
    cy?: string
    test?: string
  }
}

function CourseListButton({
  key,
  onClick,
  icon,
  label,
  data,
}: CourseListButtonProps) {
  return (
    <Button
      key={key}
      className={{
        root: 'bg-uzh-grey-40 border-uzh-grey-100 w-full rounded-md border border-solid p-2',
      }}
      onClick={onClick}
      data={data}
    >
      <Button.Icon className={{ root: 'ml-1 mr-3' }}>
        <FontAwesomeIcon icon={icon} />
      </Button.Icon>
      <Button.Label>{label}</Button.Label>
    </Button>
  )
}

export default CourseListButton
