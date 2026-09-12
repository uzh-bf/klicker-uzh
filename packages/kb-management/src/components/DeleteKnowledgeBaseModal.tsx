import { useMutation, useQuery } from '@apollo/client'
import {
  DeleteKbDocument,
  GetKbDocument,
  type GetUserKbsQuery,
} from '@klicker-uzh/graphql/dist/ops'
import { Modal, toast, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import React from 'react'
import { getGraphQLErrorCode } from '../graphqlError'
import { refreshAfterMutation } from '../refreshAfterMutation'

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
  // The list summary does not carry the imported inventory count, so the
  // authoritative count is read for the target knowledge base. An unknown count
  // (query still loading or failed) leaves the deletion to the server guard.
  const { data } = useQuery(GetKbDocument, {
    variables: { id: knowledgeBase.id },
  })
  const importedSourcesPresent = (data?.getKb?.importedSourceCount ?? 0) > 0

  const handleDelete = async () => {
    if (loading || importedSourcesPresent) return

    try {
      await deleteKb({
        variables: { id: knowledgeBase.id },
      })
    } catch (error) {
      console.error('Failed to delete knowledge base', error)
      toast({
        type: 'error',
        message:
          getGraphQLErrorCode(error) === 'KB_IMPORTED_SOURCES_PRESENT'
            ? t('kb.deleteImportedSourcesError')
            : t('kb.deleteError'),
      })
      return
    }

    await refreshAfterMutation(onDeleted, 'knowledge bases after deletion')
    toast({ type: 'success', message: t('kb.deleteSuccess') })
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={t('kb.deleteTitle')}
      primaryLabel={t('shared.generic.delete')}
      primaryButtonStyle="destructive"
      primaryLoading={loading}
      primaryDisabled={importedSourcesPresent}
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
      {importedSourcesPresent ? (
        <UserNotification
          type="warning"
          className={{ root: 'mt-4' }}
          message={t('kb.deleteImportedSourcesBlocked')}
          data={{ cy: 'kb-delete-imported-sources-blocked' }}
        />
      ) : null}
    </Modal>
  )
}

export default DeleteKnowledgeBaseModal
