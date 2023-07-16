import { IconDefinition } from '@fortawesome/free-regular-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Button } from '@uzh-bf/design-system'

interface CreationButtonProps {
  icon: IconDefinition
  text: string
  onClick?: () => void
  disabled?: boolean
  data: {
    cy?: string
    test?: string
  }
}

function CreationButton({
  icon,
  text,
  onClick,
  disabled,
  data,
}: CreationButtonProps) {
  return (
    <Button
      disabled={disabled}
      className={{
        root: 'h-10 md:h-12 gap-6',
      }}
      data={data}
      onClick={onClick}
    >
      <Button.Icon>
        <FontAwesomeIcon icon={icon} />
      </Button.Icon>
      <Button.Label>{text}</Button.Label>
    </Button>
  )
}

export default CreationButton
