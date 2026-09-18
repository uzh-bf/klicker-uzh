import { useMutation } from '@apollo/client'
import {
  MSubmitChatbotRevisionDocument,
  MWithdrawChatbotRevisionDocument,
  ChatbotStatus,
  QGetChatbotsInfoWithKnowledgeBasesDocument,
} from '@klicker-uzh/graphql/dist/ops'
import {
  Button,
  FormikNumberField,
  FormikTextareaField,
  H4,
  UserNotification,
} from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import { Form, Formik } from 'formik'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import * as Yup from 'yup'
import {
  getChatbotMutationErrorKey,
  isChatbotRevisionConflict,
} from './chatbotErrorMessages'
import {
  ChatbotRevisionConflictNotice,
  FormikInitialValuesSynchronizer,
  getChatbotRevisionReviewComment,
  getChatbotRevisionStatus,
  getChatbotRevisionValues,
  getChatbotRevisionVersion,
  isChatbotRevisionPending,
  type RevisionChatbot,
  useChatbotRevisionReload,
} from './chatbotRevision'
import type { ChatbotNavigationState } from './chatbotWorkspace'

type ChatbotPublicationRequestProps = {
  chatbot: RevisionChatbot
  publishingAuthorized: boolean
  publishingAuthorizationLoading: boolean
  publishingAuthorizationError: boolean
  setupDirty?: boolean
  setupPending?: boolean
  onNavigationStateChange?: (state: ChatbotNavigationState) => void
  onRevisionConflict?: () => void
}

type PublicationFormValues = {
  useCase: string
  expectedStudentCount: string
}

const MAX_SIGNED_INT32 = 2_147_483_647

function positiveInteger(value: string | number | null | undefined) {
  const normalizedValue = value?.toString().trim()
  if (!normalizedValue) return false
  if (!/^\d+$/.test(normalizedValue)) return false

  const parsedValue = Number(normalizedValue)
  return parsedValue >= 1 && parsedValue <= MAX_SIGNED_INT32
}

function readOnlyValue(
  value: string | number | null | undefined,
  unknown: string
) {
  if (typeof value === 'number') return value.toLocaleString()
  return value?.trim() || unknown
}

function ChatbotPublicationAuthorizationNotice({
  authorized,
  loading,
  error,
}: {
  authorized: boolean
  loading: boolean
  error: boolean
}) {
  const t = useTranslations()

  if (loading) {
    return (
      <UserNotification>
        {t('manage.resources.chatbotPublicationAuthorizationChecking')}
      </UserNotification>
    )
  }

  if (error) {
    return (
      <UserNotification type="error">
        {t('manage.resources.chatbotPublicationAuthorizationUnavailable')}
      </UserNotification>
    )
  }

  if (!authorized) {
    return (
      <UserNotification type="warning">
        {t('manage.resources.chatbotPublicationUnauthorized')}
      </UserNotification>
    )
  }

  return null
}

function ChatbotPublicationReadOnly({ chatbot }: { chatbot: RevisionChatbot }) {
  const t = useTranslations()
  const revisionValues = getChatbotRevisionValues(chatbot)
  const expectedStudentCount = readOnlyValue(
    revisionValues.expectedStudentCount,
    t('shared.generic.unknown')
  )
  const useCase = readOnlyValue(
    revisionValues.publicationUseCase,
    t('shared.generic.unknown')
  )

  let stateDescription: string
  if (isChatbotRevisionPending(chatbot)) {
    stateDescription = t('manage.resources.chatbotPublicationPending')
  } else {
    switch (chatbot.status) {
      case ChatbotStatus.Paused:
        stateDescription = t('manage.resources.chatbotPublicationPaused')
        break
      case ChatbotStatus.Published:
        stateDescription = t('manage.resources.chatbotPublicationPublished')
        break
      default:
        stateDescription = t('manage.resources.chatbotPublicationReadonly')
    }
  }

  const publishedAtLabel = chatbot.publishedAt
    ? dayjs(chatbot.publishedAt).format('DD.MM.YYYY HH:mm')
    : t('shared.generic.unknown')

  return (
    <div
      className="space-y-3 rounded-md border border-gray-200 bg-gray-50 p-3"
      data-cy="chatbot-publication-readonly"
    >
      <UserNotification>{stateDescription}</UserNotification>
      <dl className="grid gap-2 text-sm md:grid-cols-2">
        <div>
          <dt className="font-medium text-gray-600">
            {t('manage.resources.chatbotPublicationUseCase')}
          </dt>
          <dd className="mt-1 whitespace-pre-wrap text-gray-900">{useCase}</dd>
        </div>
        <div>
          <dt className="font-medium text-gray-600">
            {t('manage.resources.chatbotPublicationExpectedStudentCount')}
          </dt>
          <dd className="mt-1 text-gray-900">{expectedStudentCount}</dd>
        </div>
      </dl>
      {chatbot.status === ChatbotStatus.Published ? (
        <p className="text-sm text-gray-600">
          {t('manage.resources.chatbotPublicationPublishedAt', {
            date: publishedAtLabel,
          })}
        </p>
      ) : null}
    </div>
  )
}

function ChatbotPublicationRequest({
  chatbot,
  publishingAuthorized,
  publishingAuthorizationLoading,
  publishingAuthorizationError,
  setupDirty = false,
  setupPending = false,
  onNavigationStateChange,
  onRevisionConflict,
}: ChatbotPublicationRequestProps) {
  const t = useTranslations()
  const [submitChatbotRevision, { loading: submitLoading }] = useMutation(
    MSubmitChatbotRevisionDocument
  )
  const [withdrawChatbotRevision, { loading: withdrawLoading }] = useMutation(
    MWithdrawChatbotRevisionDocument
  )
  const [requestError, setRequestError] = useState<string | null>(null)
  const [requestSuccess, setRequestSuccess] = useState(false)
  const [withdrawSuccess, setWithdrawSuccess] = useState(false)
  const [revisionConflict, setRevisionConflict] = useState(false)
  const { loading: revisionReloading, reload: reloadRevision } =
    useChatbotRevisionReload()

  const editable =
    !isChatbotRevisionPending(chatbot) &&
    (chatbot.status === ChatbotStatus.Draft ||
      chatbot.status === ChatbotStatus.Rejected ||
      chatbot.status === ChatbotStatus.Published)
  // Completeness matches the server guard: a linked disclaimer only enables
  // submission when its normalized title and introduction are both non-empty.
  const revisionValues = getChatbotRevisionValues(chatbot)
  const hasDisclaimer = Boolean(
    revisionValues.disclaimerTitle?.trim() &&
      revisionValues.disclaimerIntroText?.trim()
  )
  const canSubmit =
    editable &&
    hasDisclaimer &&
    publishingAuthorized &&
    !publishingAuthorizationLoading &&
    !publishingAuthorizationError &&
    !setupDirty &&
    !setupPending

  const publicationValues: PublicationFormValues = {
    useCase: revisionValues.publicationUseCase ?? '',
    expectedStudentCount: revisionValues.expectedStudentCount?.toString() ?? '',
  }

  useEffect(() => {
    if (!editable) {
      onNavigationStateChange?.({ dirty: false, pending: false })
    }
  }, [editable, onNavigationStateChange])

  const pending = isChatbotRevisionPending(chatbot)
  const revisionStatus = getChatbotRevisionStatus(chatbot)
  const rejected =
    chatbot.status === ChatbotStatus.Rejected ||
    revisionStatus === ChatbotStatus.Rejected
  const reviewComment = getChatbotRevisionReviewComment(chatbot)

  const reloadAfterConflict = async () => {
    await reloadRevision()
    setRevisionConflict(false)
  }

  const handleWithdraw = async () => {
    setRequestError(null)
    setWithdrawSuccess(false)
    try {
      const result = await withdrawChatbotRevision({
        variables: {
          chatbotId: chatbot.id,
          expectedRevisionVersion: getChatbotRevisionVersion(chatbot),
        },
        refetchQueries: [{ query: QGetChatbotsInfoWithKnowledgeBasesDocument }],
        awaitRefetchQueries: true,
      })
      if (!result.data?.withdrawChatbotRevision) {
        throw new Error('Revision withdrawal returned no chatbot')
      }
      setWithdrawSuccess(true)
    } catch (error) {
      if (isChatbotRevisionConflict(error)) {
        setRevisionConflict(true)
        onRevisionConflict?.()
      }
      setRequestError(t(getChatbotMutationErrorKey(error, 'publication')))
    }
  }

  if (pending) {
    return (
      <div className="space-y-3" data-cy="chatbot-publication-request">
        <ChatbotPublicationReadOnly chatbot={chatbot} />
        <Button
          type="button"
          loading={withdrawLoading}
          disabled={withdrawLoading || setupPending || revisionReloading}
          onClick={() => void handleWithdraw()}
          data={{ cy: 'withdraw-chatbot-revision' }}
        >
          <Button.Label>
            {t('manage.resources.chatbotRevisionWithdraw')}
          </Button.Label>
        </Button>
        {revisionConflict ? (
          <ChatbotRevisionConflictNotice
            message={t('manage.resources.chatbotRevisionConflict')}
            onReload={() => void reloadAfterConflict()}
            reloading={revisionReloading}
            testId="chatbot-revision-reload-publication"
          />
        ) : null}
        {withdrawSuccess ? (
          <span className="text-sm text-green-700" role="status">
            {t('manage.resources.chatbotRevisionWithdrawn')}
          </span>
        ) : null}
        {requestError ? (
          <div role="alert">
            <UserNotification type="error">{requestError}</UserNotification>
          </div>
        ) : null}
      </div>
    )
  }

  if (!editable) {
    return <ChatbotPublicationReadOnly chatbot={chatbot} />
  }

  return (
    <Formik
      initialValues={publicationValues}
      validateOnMount
      validationSchema={Yup.object({
        useCase: Yup.string()
          .trim()
          .required(t('manage.resources.chatbotPublicationUseCaseRequired'))
          .max(2000, t('manage.resources.chatbotPublicationUseCaseTooLong')),
        expectedStudentCount: Yup.string()
          .trim()
          .required(
            t('manage.resources.chatbotPublicationExpectedStudentCountRequired')
          )
          .test(
            'positive-integer',
            t('manage.resources.chatbotPublicationExpectedStudentCountInvalid'),
            positiveInteger
          ),
      })}
      onSubmit={async (values) => {
        setRequestError(null)
        setRequestSuccess(false)
        setRevisionConflict(false)
        try {
          const result = await submitChatbotRevision({
            variables: {
              chatbotId: chatbot.id,
              expectedRevisionVersion: getChatbotRevisionVersion(chatbot),
              useCase: values.useCase.trim(),
              expectedStudentCount: Number(values.expectedStudentCount),
            },
            refetchQueries: [
              { query: QGetChatbotsInfoWithKnowledgeBasesDocument },
            ],
            awaitRefetchQueries: true,
          })

          if (!result.data?.submitChatbotRevision) {
            throw new Error('Publication request returned no chatbot')
          }

          setRequestSuccess(true)
        } catch (error) {
          if (isChatbotRevisionConflict(error)) {
            setRevisionConflict(true)
            onRevisionConflict?.()
          }
          setRequestError(t(getChatbotMutationErrorKey(error, 'publication')))
        }
      }}
    >
      {({ dirty, isSubmitting, isValid }) => (
        <Form className="space-y-4" data-cy="chatbot-publication-request">
          <FormikInitialValuesSynchronizer initialValues={publicationValues} />
          {revisionConflict ? (
            <ChatbotRevisionConflictNotice
              message={t('manage.resources.chatbotRevisionConflict')}
              onReload={() => void reloadAfterConflict()}
              reloading={revisionReloading}
              testId="chatbot-revision-reload-publication"
            />
          ) : null}
          {onNavigationStateChange ? (
            <PublicationNavigationStateReporter
              dirty={dirty}
              pending={isSubmitting || submitLoading}
              onChange={onNavigationStateChange}
            />
          ) : null}
          <div>
            <H4>{t('manage.resources.chatbotPublication')}</H4>
            <p className="mt-1 text-sm text-gray-600">
              {t('manage.resources.chatbotPublicationDescription')}
            </p>
          </div>

          {rejected && reviewComment ? (
            <UserNotification type="error">
              <span className="font-semibold">
                {t('manage.resources.chatbotPublicationReviewComment')}
              </span>{' '}
              {reviewComment}
            </UserNotification>
          ) : null}

          <ChatbotPublicationAuthorizationNotice
            authorized={publishingAuthorized}
            loading={publishingAuthorizationLoading}
            error={publishingAuthorizationError}
          />

          {!hasDisclaimer ? (
            <UserNotification type="warning">
              {t('manage.resources.chatbotPublicationDisclaimerRequired')}
            </UserNotification>
          ) : null}

          {setupDirty || setupPending ? (
            <UserNotification
              type="warning"
              data={{ cy: 'chatbot-publication-unsaved-setup' }}
            >
              {t('manage.resources.chatbotPublicationUnsavedSetup')}
            </UserNotification>
          ) : null}

          <FormikTextareaField
            required
            maxLength={2000}
            disabled={
              isSubmitting || submitLoading || setupPending || revisionConflict
            }
            name="useCase"
            label={t('manage.resources.chatbotPublicationUseCase')}
            data={{ cy: 'chatbot-publication-use-case' }}
          />
          <FormikNumberField
            required
            min={1}
            precision={0}
            disabled={
              isSubmitting || submitLoading || setupPending || revisionConflict
            }
            name="expectedStudentCount"
            label={t('manage.resources.chatbotPublicationExpectedStudentCount')}
            data={{ cy: 'chatbot-publication-expected-student-count' }}
          />

          {requestError ? (
            <div role="alert">
              <UserNotification type="error">{requestError}</UserNotification>
            </div>
          ) : null}

          <div className="flex items-center gap-3">
            <Button
              primary
              type="submit"
              loading={isSubmitting || submitLoading}
              disabled={!isValid || !canSubmit || isSubmitting || submitLoading}
              data={{ cy: 'request-chatbot-publication' }}
            >
              <Button.Label>
                {rejected
                  ? t('manage.resources.resubmitChatbotPublication')
                  : t('manage.resources.requestChatbotPublication')}
              </Button.Label>
            </Button>
            {requestSuccess ? (
              <span
                className="text-sm text-green-700"
                role="status"
                aria-live="polite"
              >
                {t('manage.resources.chatbotPublicationSubmitted')}
              </span>
            ) : null}
          </div>
        </Form>
      )}
    </Formik>
  )
}

function PublicationNavigationStateReporter({
  dirty,
  pending,
  onChange,
}: ChatbotNavigationState & {
  onChange: (state: ChatbotNavigationState) => void
}) {
  useEffect(() => {
    onChange({ dirty, pending })
  }, [dirty, onChange, pending])

  useEffect(() => {
    return () => onChange({ dirty: false, pending: false })
  }, [onChange])

  return null
}

export default ChatbotPublicationRequest
