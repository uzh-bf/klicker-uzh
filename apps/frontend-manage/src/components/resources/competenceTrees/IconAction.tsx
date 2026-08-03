import { IconDefinition } from '@fortawesome/free-solid-svg-icons'
import { Button } from '@uzh-bf/design-system'

function IconAction({
  icon,
  label,
  onClick,
  disabled = false,
  destructive = false,
  active = false,
  dataCy,
}: {
  icon: IconDefinition
  label: string
  onClick: () => void
  disabled?: boolean
  destructive?: boolean
  active?: boolean
  dataCy: string
}) {
  return (
    <Button
      basic
      active={active}
      destructive={destructive}
      disabled={disabled}
      onClick={onClick}
      aria-label={label}
      title={label}
      data={{ cy: dataCy }}
      className={{ root: 'h-8 w-8 shrink-0 p-0' }}
    >
      <Button.Icon withoutLabel icon={icon} />
    </Button>
  )
}

export default IconAction
