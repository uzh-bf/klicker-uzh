import { useMutation, useQuery } from '@apollo/client'
import {
  ApproveChatbotPublicationDocument,
  ChatbotStatus,
  GetPendingChatbotPublicationsDocument,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { Button, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import ChatbotPublicationDetails from './ChatbotPublicationDetails'

function ChatbotPublicationQueue() {
  const t = useTranslations()
  const { data, loading, error, refetch } = useQuery(
    GetPendingChatbotPublicationsDocument,
    { fetchPolicy: 'network-only', notifyOnNetworkStatusChange: true }
  )
  const [approve, { loading: approving }] = useMutation(
    ApproveChatbotPublicationDocument
  )
  const [approvalError, setApprovalError] = useState(false)
  const [publishedName, setPublishedName] = useState<string | null>(null)
  const pending =
    data?.getPendingChatbotPublications.filter(
      ({ chatbot }) => chatbot.status === ChatbotStatus.PendingApproval
    ) ?? []

  async function publish(id: string, name: string) {
    setApprovalError(false)
    setPublishedName(null)
    try {
      const result = await approve({ variables: { id } })
      if (
        result.data?.approveChatbotPublication?.id !== id ||
        result.data.approveChatbotPublication.status !== ChatbotStatus.Published
      ) {
        throw new Error('Approval was not confirmed')
      }
      setPublishedName(name)
    } catch {
      setApprovalError(true)
    }
    // Always reload the queue: another admin may have acted, or the response
    // may have failed after a successful write. Never retry publication here.
    await refetch().catch(() => undefined)
  }

  return (
    <section className="space-y-4" data-cy="chatbot-publication-queue">
      <p className="text-sm text-gray-600">
        {t('manage.admin.chatbotApprovalsDescription')}
      </p>
      <div role="status" aria-live="polite">
        {publishedName ? (
          <UserNotification type="success">
            {t('manage.admin.chatbotPublished', { name: publishedName })}
          </UserNotification>
        ) : null}
      </div>
      {approvalError ? (
        <UserNotification type="error">
          {t('manage.admin.chatbotApprovalError')}
        </UserNotification>
      ) : null}
      <Button
        onClick={() => {
          void refetch().catch(() => undefined)
        }}
        disabled={loading || approving}
        data={{ cy: 'refresh-chatbot-approvals' }}
      >
        <Button.Label>{t('manage.admin.chatbotRefresh')}</Button.Label>
      </Button>
      {error ? (
        <UserNotification type="error">
          {t('manage.admin.chatbotQueueError')}
        </UserNotification>
      ) : loading && !data ? (
        <Loader />
      ) : pending.length === 0 ? (
        <p
          className="rounded-md border border-dashed p-6 text-center text-gray-600"
          data-cy="chatbot-approvals-empty"
        >
          {t('manage.admin.chatbotQueueEmpty')}
        </p>
      ) : (
        <div className="space-y-3">
          {pending.map((review) => (
            <details
              key={review.chatbot.id}
              className="rounded-lg border border-gray-200 bg-white"
              data-cy={`chatbot-review-${review.chatbot.id}`}
            >
              <summary
                className="cursor-pointer break-words px-4 py-3 font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
                data-cy={`open-chatbot-review-${review.chatbot.id}`}
              >
                {review.chatbot.name}
                <span className="ml-2 text-sm font-normal text-gray-500">
                  {review.ownerShortname} ·{' '}
                  {t('manage.resources.chatbotStatusPendingApproval')}
                </span>
              </summary>
              <div className="space-y-5 border-t border-gray-200 p-4">
                <ChatbotPublicationDetails
                  review={review}
                  models={data?.getChatModelRegistry ?? []}
                />
                {!review.ownerPublishingEnabled ? (
                  <UserNotification type="warning">
                    {t('manage.admin.chatbotOwnerBlocked')}
                  </UserNotification>
                ) : null}
                <div className="space-y-3 border-t border-gray-200 pt-4">
                  <p className="text-sm text-gray-600">
                    {t('manage.admin.chatbotApproveConsequence')}
                  </p>
                  <Button
                    primary
                    disabled={
                      loading || approving || !review.ownerPublishingEnabled
                    }
                    loading={approving}
                    onClick={() => {
                      void publish(review.chatbot.id, review.chatbot.name)
                    }}
                    data={{ cy: `approve-chatbot-${review.chatbot.id}` }}
                  >
                    <Button.Label>
                      {t('manage.admin.chatbotApprove')}
                    </Button.Label>
                  </Button>
                </div>
              </div>
            </details>
          ))}
        </div>
      )}
    </section>
  )
}

export default ChatbotPublicationQueue
