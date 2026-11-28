import { useMutation } from '@apollo/client'
import {
  DeleteKbResourcesDocument,
  type GetKbResourcesQuery,
} from '@klicker-uzh/graphql/dist/ops'
import { Modal, toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import React from 'react'
import { refreshAfterMutation } from '../refreshAfterMutation'

type KnowledgeBaseResource =
  GetKbResourcesQuery['getKbResources']['items'][number]

function DeleteKnowledgeBaseResourcesModal({
  kbId,
  resources,
  onClose,
  onDeleted,
}: {
  kbId: string
  resources: KnowledgeBaseResource[]
  onClose: () => void
  onDeleted: () => Promise<unknown>
}) {
  const t = useTranslations()
  const [deleteResources, { loading }] = useMutation(DeleteKbResourcesDocument)

  const handleDelete = async () => {
    if (loading || resources.length === 0 || resources.length > 50) return

    try {
      await deleteResources({
        variables: { kbId, ids: resources.map(({ id }) => id) },
      })
    } catch (error) {
      console.error('Failed to delete KB resources', error)
      toast({ type: 'error', message: t('kb.bulkDeleteError') })
      return
    }

    await refreshAfterMutation(onDeleted, 'KB resources after deletion')
    toast({
      type: 'success',
      message: t('kb.bulkDeleteSuccess', { count: resources.length }),
    })
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={t('kb.bulkDeleteTitle', { count: resources.length })}
      primaryLabel={t('kb.bulkDeleteConfirm', { count: resources.length })}
      primaryButtonStyle="destructive"
      primaryLoading={loading}
      primaryDisabled={resources.length === 0 || resources.length > 50}
      onPrimaryAction={handleDelete}
      secondaryLabel={t('shared.generic.cancel')}
      onSecondaryAction={onClose}
      dataContent={{ cy: 'delete-kb-resources-modal' }}
      dataCloseButton={{ cy: 'close-delete-kb-resources' }}
      dataPrimaryAction={{ cy: 'confirm-delete-kb-resources' }}
      dataSecondaryAction={{ cy: 'cancel-delete-kb-resources' }}
      className={{ content: 'max-w-xl' }}
    >
      <p>{t('kb.bulkDeleteDescription', { count: resources.length })}</p>
      <ul className="mt-3 max-h-48 list-disc space-y-1 overflow-y-auto pl-5 text-sm text-slate-600">
        {resources.map((resource) => (
          <li key={resource.id} className="break-words">
            {resource.title}
          </li>
        ))}
      </ul>
    </Modal>
  )
}

export default DeleteKnowledgeBaseResourcesModal
