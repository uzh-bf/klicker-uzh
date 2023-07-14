import { IconDefinition } from '@fortawesome/free-regular-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Button, H3 } from '@uzh-bf/design-system'

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
      className={{
        root: 'flex flex-row items-center justify-center h-12 gap-6',
      }}
      onClick={onClick}
      data={data}
      disabled={disabled}
    >
      <FontAwesomeIcon icon={icon} className="h-8" />
      <H3>{text}</H3>
    </Button>
  )
}

export default CreationButton
