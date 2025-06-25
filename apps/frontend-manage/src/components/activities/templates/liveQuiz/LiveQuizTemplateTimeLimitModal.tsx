import { faCheck } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Modal, NumberField } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

function LiveQuizTemplateTimeLimitModal({
  onClose,
  blockIx,
  timeLimit,
  setTimeLimit,
}: {
  onClose: () => void
  blockIx: number
  timeLimit: string | undefined
  setTimeLimit: (newValue: string | undefined) => void
}) {
  const t = useTranslations()

  return (
    <Modal
      open
      onClose={onClose}
      title={t('manage.activityWizard.blockSettingsTitle', {
        blockIx: blockIx + 1,
      })}
      primaryLabel={
        <div className="flex flex-row items-center gap-2.5">
          <FontAwesomeIcon icon={faCheck} />
          <span>{t('manage.template.confirmTimeLimit')}</span>
        </div>
      }
      onPrimaryAction={onClose}
      dataPrimaryAction={{ cy: 'close-block-settings' }}
      className={{ content: 'max-w-lg', footer: 'justify-end' }}
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
    </Modal>
  )
}

export default LiveQuizTemplateTimeLimitModal
