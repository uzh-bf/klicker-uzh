import { Button, FormikTextField, Modal } from '@uzh-bf/design-system'
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
        content: '!h-max !min-h-max w-full !pb-0 sm:w-3/4 md:w-1/2',
      }}
    >
      <FormikTextField
        name={`stacks.${stackIx}.displayName`}
        label={t('manage.sessionForms.stackDisplayName')}
        tooltip={t('manage.sessionForms.stackDisplayNameTooltip')}
        data={{ cy: `stack-${stackIx}-displayname` }}
        className={{ label: 'mt-0' }}
      />
      <EditorField
        label={t('manage.sessionForms.stackDescription')}
        tooltip={t('manage.sessionForms.stackDescriptionTooltip')}
        fieldName={`stacks.${stackIx}.description`}
        placeholder={t('manage.sessionForms.stackDescriptionPlaceholder')}
        showToolbarOnFocus={false}
        className={{ label: 'mt-2' }}
        data={{ cy: `stack-${stackIx}-description` }}
      />
      <Button
        className={{ root: 'bg-uzh-blue-100 float-right mt-3 text-white' }}
        onClick={() => setModalOpen(false)}
        data={{ cy: 'close-stack-description' }}
      >
        {t('shared.generic.ok')}
      </Button>
    </Modal>
  )
}

export default StackDescriptionModal
