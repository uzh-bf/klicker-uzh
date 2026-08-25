import { IconDefinition } from '@fortawesome/free-regular-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Button, Tooltip } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

interface CreationButtonProps {
  comingSoon?: boolean
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
  comingSoon,
  icon,
  text,
  onClick,
  disabled,
  data,
}: CreationButtonProps) {
  const t = useTranslations()

  const button = (
    <Button
      fluid
      disabled={disabled}
      className={{
        root: 'h-10 justify-between gap-6 px-6 disabled:cursor-pointer md:h-12',
      }}
      data={data}
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

  return button
}

export default CreationButton
