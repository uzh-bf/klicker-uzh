import { IconDefinition } from '@fortawesome/free-regular-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Button } from '@uzh-bf/design-system'
import { twMerge } from 'tailwind-merge'

interface CourseListButtonProps {
  key?: string
  onClick: () => void
  icon: IconDefinition
  label: string
  color?: string
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
  color,
  data,
}: CourseListButtonProps) {
  return (
    <Button
      key={key}
      className={{
        root: twMerge(
          'border-uzh-grey-100 w-full rounded-md border border-solid p-2',
          typeof color !== 'undefined' && '!border-b-4'
        ),
      }}
      style={{ borderBottomColor: color }}
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
