import { useMutation, useQuery } from '@apollo/client'
import {
  DeleteKbDocument,
  QGetKbChatbotBindingsWithKnowledgeBasesDocument,
  type GetUserKbsQuery,
} from '@klicker-uzh/graphql/dist/ops'
import { Modal, toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import React from 'react'
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

  const {
    data: bindingData,
    loading: loadingBindings,
    error: bindingError,
  } = useQuery(QGetKbChatbotBindingsWithKnowledgeBasesDocument, {
    variables: { kbId: knowledgeBase.id },
    fetchPolicy: 'network-only',
  })
  const usages = (bindingData?.getKbChatbotBindings ?? []).flatMap(
    (binding) => {
      const link = binding.enabledKbs.find(
        (item) => item.kbId === knowledgeBase.id
      )
      return link
        ? [{ chatbotId: binding.chatbotId, name: binding.chatbotName, link }]
        : []
    }
  )

  const handleDelete = async () => {
    if (loading || loadingBindings || bindingError) return

    try {
      await deleteKb({
        variables: { id: knowledgeBase.id },
      })
    } catch (error) {
      console.error('Failed to delete knowledge base', error)
      toast({ type: 'error', message: t('kb.deleteError') })
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
      primaryLoading={loading || loadingBindings}
      primaryDisabled={Boolean(bindingError) || loadingBindings}
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
      {bindingError && <p>{t('kb.chatbotsLoadError')}</p>}
      {usages.length > 0 && (
        <ul className="mt-3 list-disc pl-5">
          {usages.map(({ chatbotId, name, link }) => (
            <li key={chatbotId}>
              <strong>{name}</strong>
              {link.isDefault && <span> · {t('kb.chatbotDefaultBadge')}</span>}
              {link.modeBacklinks.length > 0 && (
                <span>
                  {' '}
                  · {link.modeBacklinks.map((mode) => mode.name).join(', ')}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}

export default DeleteKnowledgeBaseModal
