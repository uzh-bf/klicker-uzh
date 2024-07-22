import { Button, Modal, NewFormikTextField } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import EditorField from './EditorField'

interface StackDescriptionModalProps {
  stackIx: number
  modalOpen: boolean
  setModalOpen: (open: boolean) => void
}

function StackDescriptionModal({
  stackIx,
  modalOpen,
  setModalOpen,
}: StackDescriptionModalProps) {
  const t = useTranslations()

  return (
    <Modal
      open={modalOpen}
      onClose={() => setModalOpen(false)}
      title={t('manage.sessionForms.stackDescriptionTitle', {
        stackIx: stackIx + 1,
      })}
      className={{
        content: 'w-full sm:w-3/4 md:w-1/2 !min-h-max !h-max !pb-0',
      }}
    >
      <NewFormikTextField
        name={`stacks.${stackIx}.displayName`}
        label={t('manage.sessionForms.stackDisplayName')}
        tooltip={t('manage.sessionForms.stackDisplayNameTooltip')}
        data={{ cy: `stack-${stackIx}-displayname` }}
        className={{ label: 'text-base mb-0.5 mt-0' }}
      />
      <EditorField
        label={t('manage.sessionForms.stackDescription')}
        tooltip={t('manage.sessionForms.stackDescriptionTooltip')}
        fieldName={`stacks.${stackIx}.description`}
        placeholder={t('manage.sessionForms.stackDescriptionPlaceholder')}
        showToolbarOnFocus={false}
        className={{ label: 'text-base mb-0.5 mt-2  ' }}
        data={{ cy: `stack-${stackIx}-description` }}
      />
      <Button
        className={{ root: 'float-right mt-3 bg-uzh-blue-100 text-white' }}
        onClick={() => setModalOpen(false)}
        data={{ cy: 'close-stack-settings' }}
      >
        {t('shared.generic.ok')}
      </Button>
    </Modal>
  )
}

export default StackDescriptionModal
