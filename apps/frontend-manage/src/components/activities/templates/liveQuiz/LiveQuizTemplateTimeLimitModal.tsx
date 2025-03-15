import { faCheck } from '@fortawesome/free-solid-svg-icons'
import { Button, Modal, NumberField } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

function LiveQuizTemplateTimeLimitModal({
  open,
  onClose,
  blockIx,
  timeLimit,
  setTimeLimit,
}: {
  open: boolean
  onClose: () => void
  blockIx: number
  timeLimit: string | undefined
  setTimeLimit: (newValue: string | undefined) => void
}) {
  const t = useTranslations()

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('manage.activityWizard.blockSettingsTitle', {
        blockIx: blockIx + 1,
      })}
      className={{
        content: 'sm:w-3/4 md:w-1/2',
      }}
    >
      <NumberField
        label={t('manage.activityWizard.timeLimit')}
        tooltip={t('manage.activityWizard.timeLimitTooltip', {
          blockIx: blockIx + 1,
        })}
        value={timeLimit ?? ''}
        onChange={(newValue: string) => {
          setTimeLimit(newValue === '' ? undefined : newValue)
        }}
        placeholder={t('manage.activityWizard.optionalTimeLimit')}
        data={{ cy: 'block-time-limit' }}
      />
      <Button
        primary
        className={{ root: 'float-right mt-3' }}
        onClick={onClose}
        data={{ cy: 'close-block-settings' }}
      >
        <Button.Icon icon={faCheck} />
        <Button.Label>{t('manage.template.confirmTimeLimit')}</Button.Label>
      </Button>
    </Modal>
  )
}

export default LiveQuizTemplateTimeLimitModal
