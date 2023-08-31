import { IconDefinition } from '@fortawesome/free-regular-svg-icons'
import { faCrown } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Button, Tooltip } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

interface CreationButtonProps {
  comingSoon?: boolean
  isCatalystRequired?: boolean
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
  isCatalystRequired,
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
        root: 'h-10 md:h-12 gap-6 justify-between px-6 disabled:cursor-pointer',
      }}
      data={data}
      onClick={onClick}
    >
      <div className="flex flex-row gap-6">
        <Button.Icon>
          <FontAwesomeIcon icon={icon} />
        </Button.Icon>
        <Button.Label>{text}</Button.Label>
      </div>
      <div>
        {isCatalystRequired && (
          <Button.Icon
            className={{
              root: comingSoon ? 'text-slate-400' : 'text-orange-400',
            }}
          >
            <FontAwesomeIcon icon={faCrown} />
          </Button.Icon>
        )}
      </div>
    </Button>
  )

  if (comingSoon && disabled) {
    return (
      <Tooltip
        tooltip={<div className="max-w-[300px]">Coming Soon</div>}
        className={{ tooltip: 'z-20' }}
      >
        {button}
      </Tooltip>
    )
  }

  if (isCatalystRequired && disabled) {
    return (
      <Tooltip
        tooltip={
          <div className="max-w-[300px]">
            {t.rich('manage.general.catalystRequired', {
              link: () => (
                <a
                  target="_blank"
                  href={`https://www.klicker.uzh.ch/catalyst}`}
                  className="underline"
                >
                  www.klicker.uzh.ch/catalyst
                </a>
              ),
            })}
          </div>
        }
        className={{ tooltip: 'z-20' }}
      >
        {button}
      </Tooltip>
    )
  }

  return button
}

export default CreationButton
