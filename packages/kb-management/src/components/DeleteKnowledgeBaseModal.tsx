import { useMutation } from '@apollo/client'
import {
  DeleteKbDocument,
  type GetUserKbsQuery,
} from '@klicker-uzh/graphql/dist/ops'
import { Modal, toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import React from 'react'

type KnowledgeBaseSummary =
  GetUserKbsQuery['getUserKbsConnection']['items'][number]

function DeleteKnowledgeBaseModal({
  knowledgeBase,
  onClose,
  onDeleted,
}: {
  knowledgeBase: KnowledgeBaseSummary
  onClose: () => void
  onDeleted: () => Promise<unknown>
}) {
  const t = useTranslations()
  const [deleteKb, { loading }] = useMutation(DeleteKbDocument)

  const handleDelete = async () => {
    if (loading) return

    try {
      await deleteKb({
        variables: { id: knowledgeBase.id },
      })
      await onDeleted()
      toast({ type: 'success', message: t('kb.deleteSuccess') })
      onClose()
    } catch (error) {
      console.error('Failed to delete knowledge base', error)
      toast({ type: 'error', message: t('kb.deleteError') })
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={t('kb.deleteTitle')}
      primaryLabel={t('shared.generic.delete')}
      primaryButtonStyle="destructive"
      primaryLoading={loading}
      onPrimaryAction={handleDelete}
      secondaryLabel={t('shared.generic.cancel')}
      onSecondaryAction={onClose}
      dataContent={{ cy: 'delete-knowledge-base-modal' }}
      dataCloseButton={{ cy: 'close-delete-knowledge-base' }}
      dataPrimaryAction={{ cy: 'confirm-delete-knowledge-base' }}
      dataSecondaryAction={{ cy: 'cancel-delete-knowledge-base' }}
      className={{ content: 'max-w-xl' }}
    >
      <p>{t('kb.deleteDescription', { name: knowledgeBase.name })}</p>
    </Modal>
  )
}

export default DeleteKnowledgeBaseModal
