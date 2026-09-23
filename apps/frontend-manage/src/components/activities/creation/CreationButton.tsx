import type { IconDefinition } from '@fortawesome/free-regular-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Button, Tooltip } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

interface CreationButtonProps {
  comingSoon?: boolean
  icon: IconDefinition
  text: string
  description?: string
  tooltipAlignment?: 'start' | 'center' | 'end'
  onClick?: () => void
  disabled?: boolean
  data: {
    cy: string
    test?: string
  }
}

function CreationButton({
  comingSoon,
  icon,
  text,
  description,
  tooltipAlignment = 'center',
  onClick,
  disabled,
  data,
}: CreationButtonProps) {
  const t = useTranslations()

  const describedById = description ? `description-${data.cy}` : undefined

  const button = (
    <Button
      fluid
      disabled={disabled}
      className={{
        root: 'h-full min-h-10 min-w-0 justify-start gap-2 px-2 py-2 text-sm disabled:cursor-pointer sm:min-h-12 md:px-3 lg:gap-3 lg:px-4 lg:text-base',
      }}
      data={data}
      aria-describedby={comingSoon && disabled ? undefined : describedById}
      onClick={onClick}
    >
      <div className="flex min-w-0 flex-row items-center gap-2 lg:gap-3">
        <FontAwesomeIcon icon={icon} />
        <div className="min-w-0 text-left leading-tight">{text}</div>
      </div>
    </Button>
  )

  if (comingSoon && disabled) {
    return (
      <Tooltip
        tooltip={t('shared.generic.comingSoon')}
        className={{ tooltip: 'z-20' }}
      >
        {button}
      </Tooltip>
    )
  }

  if (!description) {
    return button
  }

  const tooltipPosition = {
    start: 'left-0',
    center: 'left-1/2 -translate-x-1/2',
    end: 'right-0',
  }[tooltipAlignment]

  // The design-system Tooltip owns a button trigger, so wrapping this button
  // would produce invalid nested controls. Keep the tooltip non-interactive.
  return (
    <div className="group relative flex w-full">
      {button}
      <span
        id={describedById}
        role="tooltip"
        data-cy={describedById}
        className={`pointer-events-none invisible absolute top-full z-30 mt-1.5 w-max max-w-72 rounded-md bg-slate-700 px-2 py-1 text-left text-sm whitespace-normal text-white opacity-0 shadow-md transition-opacity group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100 ${tooltipPosition}`}
      >
        {description}
      </span>
    </div>
  )
}

export default CreationButton
