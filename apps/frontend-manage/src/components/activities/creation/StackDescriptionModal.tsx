import { FormikTextField, Modal } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import EditorField from './EditorField'

function StackDescriptionModal({
  stackIx,
  setModalOpen,
}: {
  stackIx: number
  setModalOpen: (open: boolean) => void
}) {
  const t = useTranslations()

  return (
    <Modal
      open
      onClose={() => setModalOpen(false)}
      title={t('manage.activityWizard.stackDescriptionTitle', {
        stackIx: stackIx + 1,
      })}
      primaryLabel={t('shared.generic.ok')}
      onPrimaryAction={() => setModalOpen(false)}
      dataPrimaryAction={{ cy: 'close-stack-description' }}
      className={{ footer: 'justify-end' }}
    >
      <FormikTextField
        name={`stacks.${stackIx}.displayName`}
        label={t('manage.activityWizard.stackDisplayName')}
        tooltip={t('manage.activityWizard.stackDisplayNameTooltip')}
        data={{ cy: `stack-${stackIx}-displayname` }}
        className={{ label: 'mt-0', tooltip: 'z-50' }}
      />
      <EditorField
        label={t('manage.activityWizard.stackDescription')}
        tooltip={t('manage.activityWizard.stackDescriptionTooltip')}
        fieldName={`stacks.${stackIx}.description`}
        placeholder={t('manage.activityWizard.stackDescriptionPlaceholder')}
        showToolbarOnFocus={false}
        className={{ label: 'mt-2' }}
        data={{ cy: `stack-${stackIx}-description` }}
      />
    </Modal>
  )
}

export default StackDescriptionModal
