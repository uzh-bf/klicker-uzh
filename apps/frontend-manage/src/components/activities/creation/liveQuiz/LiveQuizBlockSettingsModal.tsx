import { Modal, NumberField } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { ElementBlockFormValues } from '../WizardLayout'

function LiveQuizBlockSettingsModal({
  openSettings,
  setOpenSettings,
  block,
  index,
  replace,
}: {
  openSettings: boolean
  setOpenSettings: (open: boolean) => void
  block: ElementBlockFormValues
  index: number
  replace: (index: number, block: ElementBlockFormValues) => void
}) {
  const t = useTranslations()

  return (
    <Modal
      open={openSettings}
      onClose={() => setOpenSettings(false)}
      title={t('manage.activityWizard.blockSettingsTitle', {
        blockIx: index + 1,
      })}
      primaryLabel={t('shared.generic.ok')}
      onPrimaryAction={() => setOpenSettings(false)}
      dataPrimaryAction={{ cy: 'close-block-settings' }}
      className={{
        content: 'sm:w-3/4 md:w-1/2',
        footer: 'justify-end',
      }}
    >
      <NumberField
        label={t('manage.activityWizard.timeLimit')}
        tooltip={t('manage.activityWizard.timeLimitTooltip', {
          blockIx: index + 1,
        })}
        id={`timeLimits.${index}`}
        value={block.timeLimit || ''}
        onChange={(newValue: string) => {
          replace(index, {
            ...block,
            timeLimit: newValue === '' ? undefined : parseInt(newValue),
          })
        }}
        placeholder={t('manage.activityWizard.optionalTimeLimit')}
        data={{ cy: 'block-time-limit' }}
      />
    </Modal>
  )
}

export default LiveQuizBlockSettingsModal
