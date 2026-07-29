import { useMutation } from '@apollo/client'
import {
  DeleteKbResourceDocument,
  type GetKbResourcesQuery,
} from '@klicker-uzh/graphql/dist/ops'
import { Modal, toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import React from 'react'

type KnowledgeBaseResource =
  GetKbResourcesQuery['getKbResources']['items'][number]

function DeleteKnowledgeBaseResourceModal({
  resource,
  onClose,
  onDeleted,
}: {
  resource: KnowledgeBaseResource
  onClose: () => void
  onDeleted: () => Promise<unknown>
}) {
  const t = useTranslations()
  const [deleteResource, { loading }] = useMutation(DeleteKbResourceDocument)

  const handleDelete = async () => {
    if (loading) return

    try {
      await deleteResource({
        variables: { id: resource.id },
      })
    } catch (error) {
      console.error('Failed to delete KB resource', error)
      toast({ type: 'error', message: t('kb.deleteResourceError') })
      return
    }

    try {
      await onDeleted()
    } catch (refreshError) {
      console.error(
        'Failed to refresh KB resources after deletion',
        refreshError
      )
    }
    toast({ type: 'success', message: t('kb.deleteResourceSuccess') })
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={t('kb.deleteResourceTitle')}
      primaryLabel={t('shared.generic.delete')}
      primaryButtonStyle="destructive"
      primaryLoading={loading}
      onPrimaryAction={handleDelete}
      secondaryLabel={t('shared.generic.cancel')}
      onSecondaryAction={onClose}
      dataContent={{ cy: 'delete-kb-resource-modal' }}
      dataCloseButton={{ cy: 'close-delete-kb-resource' }}
      dataPrimaryAction={{ cy: 'confirm-delete-kb-resource' }}
      dataSecondaryAction={{ cy: 'cancel-delete-kb-resource' }}
      className={{ content: 'max-w-xl' }}
    >
      <p>{t('kb.deleteResourceDescription', { title: resource.title })}</p>
    </Modal>
  )
}

export default DeleteKnowledgeBaseResourceModal
