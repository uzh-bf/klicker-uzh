import { Modal, toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
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
  const [deleteSubmitting, setDeleteSubmitting] = useState(false)
  const deleting = deleteTag.isLoading || deleteSubmitting

  return (
    <Modal
      open
      onClose={() => {
        if (!deleting) {
          onClose()
        }
      }}
      title={t('manage.tags.deleteTag')}
      primaryLabel={t('shared.generic.confirm')}
      primaryLoading={deleting}
      primaryDisabled={deleting}
      primaryButtonStyle="destructive"
      onPrimaryAction={async () => {
        if (deleting) return
        setDeleteSubmitting(true)

        try {
          const result = await deleteTag.mutateAsync({ id })

          if (!result.tag) {
            toast({
              type: 'error',
              message: t('shared.generic.systemError'),
              options: { duration: 6000 },
            })
            return
          }

          utils.element.tags.setData(undefined, (data) =>
            data
              ? {
                  tags: data.tags.filter((tag) => tag.id !== id),
                }
              : data
          )
          await refetchElements()
          onClose()
        } catch (error) {
          console.error(error)
          toast({
            type: 'error',
            message: t('shared.generic.systemError'),
            options: { duration: 6000 },
          })
        } finally {
          setDeleteSubmitting(false)
        }
      }}
      dataPrimaryAction={{ cy: 'confirm-delete-tag' }}
      secondaryLabel={t('shared.generic.cancel')}
      onSecondaryAction={() => {
        if (!deleting) {
          onClose()
        }
      }}
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
