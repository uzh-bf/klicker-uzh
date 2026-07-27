import { useMutation, useQuery } from '@apollo/client'
import {
  AttachKbToChatbotDocument,
  DetachKbFromChatbotDocument,
  GetChatbotsInfoDocument,
  GetKbChatbotBindingsDocument,
} from '@klicker-uzh/graphql/dist/ops'
import {
  Button,
  H3,
  SelectField,
  Skeleton,
  UserNotification,
  toast,
} from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import React, { useState } from 'react'

function KnowledgeBaseChatbotBindings({ kbId }: { kbId: string }) {
  const t = useTranslations()
  const [selectedChatbotId, setSelectedChatbotId] = useState<
    string | undefined
  >()
  const { data, loading, error } = useQuery(GetKbChatbotBindingsDocument, {
    variables: { kbId },
  })
  const [attachKb, { loading: attaching }] = useMutation(
    AttachKbToChatbotDocument
  )
  const [detachKb, { loading: detaching }] = useMutation(
    DetachKbFromChatbotDocument
  )
  const bindings = data?.getKbChatbotBindings ?? []
  const selectedBinding = bindings.find(
    ({ chatbotId }) => chatbotId === selectedChatbotId
  )
  const linkedBindings = bindings.filter(
    ({ enabledKbId }) => enabledKbId === kbId
  )
  const replacing =
    selectedBinding?.enabledKbId != null && selectedBinding.enabledKbId !== kbId
  const mutating = attaching || detaching

  const refetchQueries = [
    {
      query: GetKbChatbotBindingsDocument,
      variables: { kbId },
    },
    { query: GetChatbotsInfoDocument },
  ]

  const handleAttach = async () => {
    if (!selectedChatbotId || mutating) return

    try {
      await attachKb({
        variables: { kbId, chatbotId: selectedChatbotId },
        refetchQueries,
        awaitRefetchQueries: true,
      })
      setSelectedChatbotId(undefined)
      toast({ type: 'success', message: t('kb.chatbotAttachSuccess') })
    } catch (mutationError) {
      console.error('Failed to attach KB to chatbot', mutationError)
      toast({ type: 'error', message: t('kb.chatbotAttachError') })
    }
  }

  const handleDetach = async (chatbotId: string) => {
    if (mutating) return

    try {
      await detachKb({
        variables: { kbId, chatbotId },
        refetchQueries,
        awaitRefetchQueries: true,
      })
      toast({ type: 'success', message: t('kb.chatbotDetachSuccess') })
    } catch (mutationError) {
      console.error('Failed to detach KB from chatbot', mutationError)
      toast({ type: 'error', message: t('kb.chatbotDetachError') })
    }
  }

  return (
    <section
      className="mt-6 rounded-md border border-slate-200 bg-white p-4 shadow-sm"
      data-cy="kb-chatbot-bindings"
    >
      <H3>{t('kb.chatbotsTitle')}</H3>
      <p className="mt-1 text-sm text-slate-600">
        {t('kb.chatbotsDescription')}
      </p>

      {loading ? (
        <Skeleton
          className="mt-4 h-20 w-full motion-reduce:animate-none"
          aria-hidden="true"
        />
      ) : error ? (
        <UserNotification
          type="error"
          className={{ root: 'mt-4' }}
          message={t('kb.chatbotsLoadError')}
          data={{ cy: 'kb-chatbot-bindings-error' }}
        />
      ) : bindings.length === 0 ? (
        <UserNotification
          className={{ root: 'mt-4' }}
          message={t('kb.noChatbots')}
          data={{ cy: 'kb-chatbot-bindings-empty' }}
        />
      ) : (
        <>
          <div
            className="mt-4 flex flex-col items-end gap-3 sm:flex-row"
            data-cy="kb-chatbot-attach-form"
          >
            <div className="w-full flex-1">
              <SelectField
                label={t('kb.chatbotSelectLabel')}
                items={bindings.map((binding) => ({
                  value: binding.chatbotId,
                  label: binding.chatbotName,
                }))}
                value={selectedChatbotId}
                onChange={setSelectedChatbotId}
                placeholder={t('kb.chatbotSelectPlaceholder')}
                disabled={mutating}
              />
            </div>
            <Button
              primary
              disabled={!selectedChatbotId || mutating}
              onClick={handleAttach}
              data={{ cy: 'attach-kb-chatbot' }}
            >
              <Button.Label>
                {replacing ? t('kb.replaceChatbot') : t('kb.attachChatbot')}
              </Button.Label>
            </Button>
          </div>

          {replacing ? (
            <UserNotification
              type="warning"
              className={{ root: 'mt-3' }}
              message={t('kb.chatbotReplacementWarning', {
                kbName: selectedBinding?.enabledKbName ?? '',
              })}
              data={{ cy: 'kb-chatbot-replacement-warning' }}
            />
          ) : null}

          <div className="mt-5">
            <div className="text-sm font-medium text-slate-700">
              {t('kb.linkedChatbots')}
            </div>
            {linkedBindings.length === 0 ? (
              <p
                className="mt-2 text-sm text-slate-600"
                data-cy="kb-no-linked-chatbots"
              >
                {t('kb.noLinkedChatbots')}
              </p>
            ) : (
              <ul className="mt-2 divide-y divide-slate-200">
                {linkedBindings.map((binding) => (
                  <li
                    key={binding.chatbotId}
                    className="flex items-center justify-between gap-3 py-3"
                    data-cy={`kb-linked-chatbot-${binding.chatbotId}`}
                  >
                    <span className="break-words font-medium">
                      {binding.chatbotName}
                    </span>
                    <Button
                      disabled={mutating}
                      onClick={() => handleDetach(binding.chatbotId)}
                      data={{ cy: `detach-kb-chatbot-${binding.chatbotId}` }}
                    >
                      <Button.Label>{t('kb.detachChatbot')}</Button.Label>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </section>
  )
}

export default KnowledgeBaseChatbotBindings
