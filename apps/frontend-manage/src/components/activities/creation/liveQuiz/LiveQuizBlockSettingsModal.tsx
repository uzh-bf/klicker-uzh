import { Button, ModalLegacy, NumberField } from '@uzh-bf/design-system'
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
    <ModalLegacy
      open={openSettings}
      onClose={() => setOpenSettings(false)}
      title={t('manage.activityWizard.blockSettingsTitle', {
        blockIx: index + 1,
      })}
      className={{
        content: 'sm:w-3/4 md:w-1/2',
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
      <Button
        primary
        className={{ root: 'float-right mt-3' }}
        onClick={() => setOpenSettings(false)}
        data={{ cy: 'close-block-settings' }}
      >
        <Button.Label>{t('shared.generic.ok')}</Button.Label>
      </Button>
    </ModalLegacy>
  )
}

export default LiveQuizBlockSettingsModal
