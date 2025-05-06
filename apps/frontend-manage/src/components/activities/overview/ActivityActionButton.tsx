import { IconDefinition } from '@fortawesome/free-solid-svg-icons'
import { Button, Tooltip } from '@uzh-bf/design-system'
import { twMerge } from 'tailwind-merge'

function ActivityActionButton({
  disabled,
  tooltip,
  icon,
  onClick,
  className,
  data,
}: {
  disabled?: boolean
  tooltip?: string
  icon: IconDefinition
  onClick: () => void
  className?: string
  data?: { test?: string; cy?: string }
}) {
  if (tooltip) {
    return (
      <Tooltip tooltip={tooltip}>
        <Button
          disabled={disabled}
          onClick={onClick}
          className={{ root: twMerge('h-8 w-8 p-0', className) }}
          data={data}
        >
          <Button.Icon withoutLabel icon={icon} />
        </Button>
      </Tooltip>
    )
  }

  return (
    <Button
      disabled={disabled}
      onClick={onClick}
      className={{ root: twMerge('h-8 w-8 p-0', className) }}
      data={data}
    >
      <Button.Icon withoutLabel icon={icon} />
    </Button>
  )
}

export default ActivityActionButton
