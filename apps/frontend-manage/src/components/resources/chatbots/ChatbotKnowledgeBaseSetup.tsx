import { useApolloClient, useMutation, useQuery } from '@apollo/client'
import {
  AttachKbToChatbotDocument,
  ChatbotStatus,
  DetachKbFromChatbotDocument,
  GetUserKbsDocument,
  QGetChatbotsInfoWithKnowledgeBasesDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { CreateKnowledgeBaseModal } from '@klicker-uzh/kb-management'
import {
  Button,
  SelectField,
  toast,
  UserNotification,
} from '@uzh-bf/design-system'
import { useRouter } from 'next/router'
import { useTranslations } from 'next-intl'
import { useState } from 'react'

// The largest page the knowledge-base list accepts in one request.
const KB_LIST_PAGE_SIZE = 50

const refetchQueries = [{ query: QGetChatbotsInfoWithKnowledgeBasesDocument }]

function ChatbotKnowledgeBaseSetup({
  chatbotId,
  chatbotStatus,
  connectedKnowledgeBase,
}: {
  chatbotId: string
  chatbotStatus: ChatbotStatus
  connectedKnowledgeBase?: { id: string; name: string }
}) {
  const t = useTranslations()
  const router = useRouter()
  const apolloClient = useApolloClient()
  const [selectedKbId, setSelectedKbId] = useState<string | undefined>()
  const [createOpen, setCreateOpen] = useState(false)
  const { data, error, refetch } = useQuery(GetUserKbsDocument, {
    variables: { first: KB_LIST_PAGE_SIZE },
  })
  const [attachKb, { loading: attaching }] = useMutation(
    AttachKbToChatbotDocument
  )
  const [detachKb, { loading: detaching }] = useMutation(
    DetachKbFromChatbotDocument
  )
  const mutating = attaching || detaching

  const knowledgeBases = data?.getUserKbsConnection.items ?? []
  // The connected knowledge base stays selectable even when it falls outside
  // the first page of the lecturer's list.
  const selectItems = [
    ...(connectedKnowledgeBase &&
    !knowledgeBases.some(({ id }) => id === connectedKnowledgeBase.id)
      ? [connectedKnowledgeBase]
      : []),
    ...knowledgeBases,
  ].map((knowledgeBase) => ({
    value: knowledgeBase.id,
    label: knowledgeBase.name,
  }))
  const selectedValue = selectedKbId ?? connectedKnowledgeBase?.id
  const replacing =
    connectedKnowledgeBase != null &&
    selectedValue != null &&
    selectedValue !== connectedKnowledgeBase.id
  const canConnect =
    selectedValue != null &&
    selectedValue !== connectedKnowledgeBase?.id &&
    !mutating

  const attach = async (kbId: string) => {
    try {
      await attachKb({ variables: { kbId, chatbotId }, refetchQueries })
      return true
    } catch (mutationError) {
      console.error('Failed to attach KB to chatbot', mutationError)
      return false
    }
  }

  const handleConnect = async () => {
    if (!canConnect || !selectedValue) return

    if (!(await attach(selectedValue))) {
      toast({
        type: 'error',
        message: t('manage.resources.chatbotKnowledgeBaseConnectError'),
      })
      return
    }

    setSelectedKbId(undefined)
    toast({
      type: 'success',
      message: t('manage.resources.chatbotKnowledgeBaseConnectSuccess'),
    })
  }

  const handleDisconnect = async () => {
    if (!connectedKnowledgeBase || mutating) return

    try {
      await detachKb({
        variables: { kbId: connectedKnowledgeBase.id, chatbotId },
        refetchQueries,
      })
    } catch (mutationError) {
      console.error('Failed to detach KB from chatbot', mutationError)
      toast({
        type: 'error',
        message: t('manage.resources.chatbotKnowledgeBaseDisconnectError'),
      })
      return
    }

    setSelectedKbId(undefined)
    toast({
      type: 'success',
      message: t('manage.resources.chatbotKnowledgeBaseDisconnectSuccess'),
    })
  }

  const handleCreated = async ({ id }: { id: string }) => {
    // Every cached page of the lecturer's knowledge-base lists now misses the
    // new entry, including the list on the knowledge-base overview page.
    apolloClient.cache.evict({ fieldName: 'getUserKbsConnection' })
    apolloClient.cache.gc()

    if (!(await attach(id))) {
      // The knowledge base exists now, so retrying means selecting it here
      // rather than creating another one.
      toast({
        type: 'error',
        message: t('manage.resources.chatbotKnowledgeBaseCreatedNotConnected'),
      })
      await refetch()
      return
    }

    await router.push(
      `/resources/knowledgeBases/${encodeURIComponent(id)}?chatbotId=${encodeURIComponent(chatbotId)}`
    )
  }

  return (
    <div className="space-y-3" data-cy="chatbot-kb-setup">
      {chatbotStatus === ChatbotStatus.Published ? (
        // Knowledge-base bindings are not part of the chatbot revision, so a
        // change here reaches a published chatbot without review.
        <UserNotification
          type="warning"
          message={t('manage.resources.chatbotKnowledgeBaseLiveChangeNote')}
          data={{ cy: 'chatbot-kb-live-change-note' }}
        />
      ) : null}
      {error ? (
        <UserNotification
          type="error"
          message={t('manage.resources.chatbotKnowledgeBaseListError')}
          data={{ cy: 'chatbot-kb-list-error' }}
        />
      ) : null}
      <div className="flex flex-col items-end gap-3 sm:flex-row">
        <div className="w-full flex-1">
          <SelectField
            label={t('manage.resources.knowledgeBase')}
            items={selectItems}
            value={selectedValue}
            onChange={setSelectedKbId}
            placeholder={t(
              'manage.resources.chatbotKnowledgeBaseSelectPlaceholder'
            )}
            disabled={mutating || selectItems.length === 0}
            data={{ cy: 'chatbot-kb-select' }}
          />
        </div>
        <Button
          primary
          disabled={!canConnect}
          onClick={handleConnect}
          data={{ cy: 'chatbot-kb-connect' }}
        >
          <Button.Label>
            {replacing
              ? t('manage.resources.chatbotKnowledgeBaseReplace')
              : t('manage.resources.chatbotKnowledgeBaseConnect')}
          </Button.Label>
        </Button>
        {connectedKnowledgeBase ? (
          <Button
            disabled={mutating}
            onClick={handleDisconnect}
            data={{ cy: 'chatbot-kb-disconnect' }}
          >
            <Button.Label>
              {t('manage.resources.chatbotKnowledgeBaseDisconnect')}
            </Button.Label>
          </Button>
        ) : null}
        <Button
          disabled={mutating}
          onClick={() => setCreateOpen(true)}
          data={{ cy: 'chatbot-kb-create' }}
        >
          <Button.Label>{t('kb.create')}</Button.Label>
        </Button>
      </div>
      {replacing ? (
        <UserNotification
          type="warning"
          message={t(
            'manage.resources.chatbotKnowledgeBaseReplacementWarning',
            {
              kbName: connectedKnowledgeBase?.name ?? '',
            }
          )}
          data={{ cy: 'chatbot-kb-replacement-warning' }}
        />
      ) : null}
      {createOpen ? (
        <CreateKnowledgeBaseModal
          onClose={() => setCreateOpen(false)}
          onCreated={handleCreated}
        />
      ) : null}
    </div>
  )
}

export default ChatbotKnowledgeBaseSetup
