import { Modal } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { trpc } from '../../../lib/trpc'

function TagDeletionModal({
  id,
  name,
  onClose,
  refetchElements,
}: {
  id: number
  name: string
  onClose: () => void
  refetchElements: () => Promise<void>
}) {
  const t = useTranslations()
  const utils = trpc.useUtils()
  const deleteTag = trpc.element.deleteTag.useMutation()

  return (
    <Modal
      open
      onClose={onClose}
      title={t('manage.tags.deleteTag')}
      primaryLabel={t('shared.generic.confirm')}
      primaryLoading={deleteTag.isLoading}
      primaryButtonStyle="destructive"
      onPrimaryAction={async () => {
        await deleteTag.mutateAsync({ id })
        await Promise.all([utils.element.tags.invalidate(), refetchElements()])
        onClose()
      }}
      dataPrimaryAction={{ cy: 'confirm-delete-tag' }}
      secondaryLabel={t('shared.generic.cancel')}
      onSecondaryAction={onClose}
      dataSecondaryAction={{ cy: 'cancel-delete-tag' }}
      className={{ content: 'max-w-xl' }}
    >
      {t.rich('manage.tags.confirmTagDeletion', {
        name,
        b: (content) => <b>{content}</b>,
      })}
    </Modal>
  )
}

export default TagDeletionModal
