import { IconDefinition } from '@fortawesome/free-regular-svg-icons'
import { faCrown } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Button, Tooltip } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

interface CreationButtonProps {
  isFullAccessRequired?: boolean
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
  isFullAccessRequired,
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
        {isFullAccessRequired && (
          <Button.Icon className={{ root: 'text-orange-400' }}>
            <FontAwesomeIcon icon={faCrown} />
          </Button.Icon>
        )}
      </div>
    </Button>
  )

  if (isFullAccessRequired && disabled) {
    return (
      <Tooltip
        tooltip={
          <div className="max-w-[300px]">
            {t.rich('manage.general.fullAccessRequired', {
              link: () => (
                <a
                  target="_blank"
                  href="https://www.klicker.uzh.ch/full_access"
                >
                  www.klicker.uzh.ch/full_access
                </a>
              ),
            })}
          </div>
        }
      >
        {button}
      </Tooltip>
    )
  }

  return button
}

export default CreationButton
