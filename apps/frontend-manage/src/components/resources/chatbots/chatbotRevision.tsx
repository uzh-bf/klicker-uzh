import { useApolloClient } from '@apollo/client'
import {
  type Chatbot,
  type ChatbotAuthoringRevision,
  type QGetChatbotsInfoWithKnowledgeBasesQuery,
  ChatbotStatus,
  QGetChatbotsInfoWithKnowledgeBasesDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, UserNotification } from '@uzh-bf/design-system'
import { type FormikValues, useFormikContext } from 'formik'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useState } from 'react'
import { getChatbotStatusTranslationKey } from './chatbotStatus'

type RevisionChatbot = NonNullable<
  NonNullable<
    QGetChatbotsInfoWithKnowledgeBasesQuery['getChatbotsInfo']
  >[number]
>
type StandardModeRevisionConfig = NonNullable<
  NonNullable<ChatbotAuthoringRevision['standardModeConfig']>
>
type RevisionReasoningConfig = NonNullable<
  ChatbotAuthoringRevision['allowedReasoningEffortsByModel']
>[number]
type ChatbotRevisionValues = Pick<
  ChatbotAuthoringRevision,
  | 'name'
  | 'description'
  | 'avatar'
  | 'standardModeConfig'
  | 'modelSelection'
  | 'allowedModelIds'
  | 'allowedReasoningEffortsByModel'
  | 'creditInitialCredits'
  | 'creditResetPeriod'
  | 'creditResetAmount'
  | 'creditMaxCredits'
  | 'disclaimerTitle'
  | 'disclaimerIntroText'
  | 'publicationUseCase'
  | 'expectedStudentCount'
>

function getChatbotAuthoringRevision(chatbot: RevisionChatbot) {
  return chatbot.authoringRevision ?? null
}

function getChatbotRevisionValues(
  chatbot: RevisionChatbot
): ChatbotRevisionValues {
  const revision = getChatbotAuthoringRevision(chatbot)
  const liveReasoningConfig = chatbot.allowedReasoningEffortsByModel ?? []

  return {
    // A revision field can intentionally be null. Only use the live value
    // when there is no saved revision at all.
    name: revision ? revision.name : chatbot.name,
    description: revision
      ? revision.description
      : (chatbot.description ?? null),
    avatar: revision ? revision.avatar : (chatbot.avatar ?? null),
    standardModeConfig: revision
      ? revision.standardModeConfig
      : (chatbot.standardModeConfig ?? null),
    modelSelection: revision ? revision.modelSelection : chatbot.modelSelection,
    allowedModelIds: revision
      ? [...revision.allowedModelIds]
      : [...chatbot.allowedModelIds],
    allowedReasoningEffortsByModel: revision
      ? revision.allowedReasoningEffortsByModel.map((entry) => ({
          modelId: entry.modelId,
          efforts: [...entry.efforts],
        }))
      : liveReasoningConfig.map((entry) => ({
          modelId: entry.modelId,
          efforts: [...entry.efforts],
        })),
    creditInitialCredits: revision
      ? revision.creditInitialCredits
      : chatbot.creditInitialCredits,
    creditResetPeriod: revision
      ? revision.creditResetPeriod
      : chatbot.creditResetPeriod,
    creditResetAmount: revision
      ? revision.creditResetAmount
      : chatbot.creditResetAmount,
    creditMaxCredits: revision
      ? revision.creditMaxCredits
      : chatbot.creditMaxCredits,
    disclaimerTitle: revision
      ? revision.disclaimerTitle
      : (chatbot.disclaimerSummary?.title ?? null),
    disclaimerIntroText: revision
      ? revision.disclaimerIntroText
      : (chatbot.disclaimerSummary?.introText ?? null),
    publicationUseCase: revision
      ? revision.publicationUseCase
      : (chatbot.publicationUseCase ?? null),
    expectedStudentCount: revision
      ? revision.expectedStudentCount
      : (chatbot.expectedStudentCount ?? null),
  }
}

function getChatbotRevisionVersion(chatbot: RevisionChatbot) {
  return (
    chatbot.revisionVersion ??
    getChatbotAuthoringRevision(chatbot)?.version ??
    0
  )
}

function getChatbotRevisionStatus(chatbot: RevisionChatbot) {
  return (
    chatbot.revisionStatus ??
    getChatbotAuthoringRevision(chatbot)?.status ??
    null
  )
}

function getChatbotRevisionReviewComment(chatbot: RevisionChatbot) {
  const revision = getChatbotAuthoringRevision(chatbot)
  return revision ? revision.reviewComment : (chatbot.reviewComment ?? null)
}

function hasChatbotAuthoringRevision(chatbot: RevisionChatbot) {
  return getChatbotAuthoringRevision(chatbot) !== null
}

function isChatbotRevisionPending(chatbot: RevisionChatbot) {
  return (
    chatbot.status === ChatbotStatus.PendingApproval ||
    getChatbotRevisionStatus(chatbot) === ChatbotStatus.PendingApproval
  )
}

function isChatbotRevisionEditable(chatbot: RevisionChatbot) {
  return (
    !isChatbotRevisionPending(chatbot) &&
    [
      ChatbotStatus.Draft,
      ChatbotStatus.Rejected,
      ChatbotStatus.Published,
    ].includes(chatbot.status)
  )
}

function ChatbotRevisionStatusNotice({
  chatbot,
}: {
  chatbot: RevisionChatbot
}) {
  const t = useTranslations()
  const revision = getChatbotAuthoringRevision(chatbot)
  const revisionStatus = getChatbotRevisionStatus(chatbot)
  const version = getChatbotRevisionVersion(chatbot)
  const pending = isChatbotRevisionPending(chatbot)
  const reviewComment = getChatbotRevisionReviewComment(chatbot)

  return (
    <div className="space-y-2" data-cy="chatbot-revision-status">
      {pending ? (
        <UserNotification type="warning">
          {t('manage.resources.chatbotRevisionPending', { version })}
        </UserNotification>
      ) : revisionStatus === ChatbotStatus.Rejected ? (
        <UserNotification type="error">
          {t('manage.resources.chatbotRevisionRejected', { version })}
        </UserNotification>
      ) : revision ? (
        <UserNotification>
          {t('manage.resources.chatbotRevisionSaved', { version })}
        </UserNotification>
      ) : (
        <UserNotification>
          {t('manage.resources.chatbotRevisionLiveOnly')}
        </UserNotification>
      )}
      {revisionStatus === ChatbotStatus.Rejected && reviewComment ? (
        <UserNotification type="error">
          <span className="font-semibold">
            {t('manage.resources.chatbotRevisionReviewComment')}
          </span>{' '}
          {reviewComment}
        </UserNotification>
      ) : null}
    </div>
  )
}

function useChatbotRevisionReload() {
  const client = useApolloClient()
  const [loading, setLoading] = useState(false)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      await client.refetchQueries({
        include: [QGetChatbotsInfoWithKnowledgeBasesDocument],
      })
    } finally {
      setLoading(false)
    }
  }, [client])

  return { loading, reload }
}

function ChatbotRevisionConflictNotice({
  message,
  onReload,
  reloading,
  testId,
}: {
  message: string
  onReload: () => void
  reloading: boolean
  testId: string
}) {
  const t = useTranslations()

  return (
    <div className="space-y-2" role="alert">
      <UserNotification type="error">{message}</UserNotification>
      <Button
        type="button"
        disabled={reloading}
        onClick={onReload}
        data={{ cy: testId }}
      >
        <Button.Label>
          {reloading
            ? t('manage.resources.chatbotRevisionReloading')
            : t('manage.resources.chatbotRevisionReload')}
        </Button.Label>
      </Button>
    </div>
  )
}

/**
 * Keep a clean Formik editor aligned with refetched server values while
 * preserving the user's input when the editor is dirty.
 */
function FormikInitialValuesSynchronizer<T extends FormikValues>({
  initialValues,
}: {
  initialValues: T
}) {
  const {
    dirty,
    initialValues: formikInitialValues,
    resetForm,
  } = useFormikContext<T>()
  const signature = JSON.stringify(initialValues)
  const formikInitialSignature = JSON.stringify(formikInitialValues)

  useEffect(() => {
    if (!dirty && formikInitialSignature !== signature) {
      resetForm({ values: initialValues })
    }
  }, [dirty, formikInitialSignature, initialValues, resetForm, signature])

  return null
}

export type {
  ChatbotRevisionValues,
  RevisionChatbot,
  RevisionReasoningConfig,
  StandardModeRevisionConfig,
}
export {
  ChatbotRevisionConflictNotice,
  ChatbotRevisionStatusNotice,
  FormikInitialValuesSynchronizer,
  getChatbotAuthoringRevision,
  getChatbotRevisionReviewComment,
  getChatbotRevisionStatus,
  getChatbotRevisionValues,
  getChatbotRevisionVersion,
  hasChatbotAuthoringRevision,
  isChatbotRevisionEditable,
  isChatbotRevisionPending,
  useChatbotRevisionReload,
}
