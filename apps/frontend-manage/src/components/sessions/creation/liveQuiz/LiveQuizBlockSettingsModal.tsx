import { Button, Modal, NumberField } from '@uzh-bf/design-system'
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
      title={t('manage.sessionForms.blockSettingsTitle', {
        blockIx: index + 1,
      })}
      className={{
        content: 'sm:w-3/4 md:w-1/2',
      }}
    >
      <NumberField
        label={t('manage.sessionForms.timeLimit')}
        tooltip={t('manage.sessionForms.timeLimitTooltip', {
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
        placeholder={t('manage.sessionForms.optionalTimeLimit')}
        data={{ cy: 'block-time-limit' }}
      />
      <Button
        className={{ root: 'bg-uzh-blue-100 float-right mt-3 text-white' }}
        onClick={() => setOpenSettings(false)}
        data={{ cy: 'close-block-settings' }}
      >
        {t('shared.generic.ok')}
      </Button>
    </Modal>
  )
}

export default LiveQuizBlockSettingsModal
