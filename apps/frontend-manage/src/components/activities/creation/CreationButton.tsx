import type { IconDefinition } from '@fortawesome/free-regular-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Button, Tooltip } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

interface CreationButtonProps {
  comingSoon?: boolean
  icon: IconDefinition
  text: string
  description?: React.ReactNode
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
        root: 'h-10 justify-between gap-6 px-6 disabled:cursor-pointer md:h-12',
      }}
      data={data}
      aria-describedby={comingSoon && disabled ? undefined : describedById}
      onClick={onClick}
    >
      <div className="flex flex-row items-center gap-3">
        <FontAwesomeIcon icon={icon} />
        <div>{text}</div>
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

  return (
    <div className="flex flex-col gap-1">
      {button}
      {description ? (
        <div id={describedById} data-cy={describedById} className="text-sm">
          {description}
        </div>
      ) : null}
    </div>
  )
}

export default CreationButton
