import { useMutation } from '@apollo/client'
import {
  type Chatbot,
  ChatbotStatus,
  GetChatbotsInfoDocument,
  RequestChatbotPublicationDocument,
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
import { getChatbotMutationErrorKey } from './chatbotErrorMessages'
import type { ChatbotNavigationState } from './chatbotWorkspace'

type ChatbotPublicationRequestProps = {
  chatbot: Chatbot
  publishingAuthorized: boolean
  publishingAuthorizationLoading: boolean
  publishingAuthorizationError: boolean
  onNavigationStateChange?: (state: ChatbotNavigationState) => void
}

type PublicationFormValues = {
  useCase: string
  expectedStudentCount: string
  proposedCredits: string
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

function ChatbotPublicationReadOnly({ chatbot }: { chatbot: Chatbot }) {
  const t = useTranslations()
  const expectedStudentCount = readOnlyValue(
    chatbot.expectedStudentCount,
    t('shared.generic.unknown')
  )
  const proposedCredits = readOnlyValue(
    chatbot.creditInitialCredits,
    t('shared.generic.unknown')
  )
  const useCase = readOnlyValue(
    chatbot.publicationUseCase,
    t('shared.generic.unknown')
  )

  let stateDescription: string
  switch (chatbot.status) {
    case ChatbotStatus.PendingApproval:
      stateDescription = t('manage.resources.chatbotPublicationPending')
      break
    case ChatbotStatus.Paused:
      stateDescription = t('manage.resources.chatbotPublicationPaused')
      break
    case ChatbotStatus.Published:
      stateDescription = t('manage.resources.chatbotPublicationPublished')
      break
    default:
      stateDescription = t('manage.resources.chatbotPublicationReadonly')
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
      <dl className="grid gap-2 text-sm md:grid-cols-3">
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
        <div>
          <dt className="font-medium text-gray-600">
            {t('manage.resources.chatbotPublicationProposedCredits')}
          </dt>
          <dd className="mt-1 text-gray-900">{proposedCredits}</dd>
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
  onNavigationStateChange,
}: ChatbotPublicationRequestProps) {
  const t = useTranslations()
  const [requestChatbotPublication, { loading: requestLoading }] = useMutation(
    RequestChatbotPublicationDocument
  )
  const [requestError, setRequestError] = useState<string | null>(null)
  const [requestSuccess, setRequestSuccess] = useState(false)

  const editable =
    chatbot.status === ChatbotStatus.Draft ||
    chatbot.status === ChatbotStatus.Rejected
  // Completeness matches the server guard: a linked disclaimer only enables
  // submission when its normalized title and introduction are both non-empty.
  const hasDisclaimer = Boolean(
    chatbot.disclaimerSummary?.title?.trim() &&
      chatbot.disclaimerSummary?.introText?.trim()
  )
  const canSubmit =
    editable &&
    hasDisclaimer &&
    publishingAuthorized &&
    !publishingAuthorizationLoading &&
    !publishingAuthorizationError

  useEffect(() => {
    if (!editable) {
      onNavigationStateChange?.({ dirty: false, pending: false })
    }
  }, [editable, onNavigationStateChange])

  if (!editable) {
    return <ChatbotPublicationReadOnly chatbot={chatbot} />
  }

  const initialValues: PublicationFormValues = {
    useCase: chatbot.publicationUseCase ?? '',
    expectedStudentCount: chatbot.expectedStudentCount?.toString() ?? '',
    proposedCredits:
      chatbot.creditInitialCredits > 0
        ? chatbot.creditInitialCredits.toString()
        : '',
  }

  return (
    <Formik
      enableReinitialize
      initialValues={initialValues}
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
        proposedCredits: Yup.string()
          .trim()
          .required(
            t('manage.resources.chatbotPublicationProposedCreditsRequired')
          )
          .test(
            'positive-integer',
            t('manage.resources.chatbotPublicationProposedCreditsInvalid'),
            positiveInteger
          ),
      })}
      onSubmit={async (values) => {
        setRequestError(null)
        setRequestSuccess(false)
        try {
          const result = await requestChatbotPublication({
            variables: {
              id: chatbot.id,
              useCase: values.useCase.trim(),
              expectedStudentCount: Number(values.expectedStudentCount),
              proposedCredits: Number(values.proposedCredits),
            },
            refetchQueries: [{ query: GetChatbotsInfoDocument }],
            awaitRefetchQueries: true,
          })

          if (!result.data?.requestChatbotPublication) {
            throw new Error('Publication request returned no chatbot')
          }

          setRequestSuccess(true)
        } catch (error) {
          setRequestError(t(getChatbotMutationErrorKey(error, 'publication')))
        }
      }}
    >
      {({ dirty, isSubmitting, isValid }) => (
        <Form className="space-y-4" data-cy="chatbot-publication-request">
          {onNavigationStateChange ? (
            <PublicationNavigationStateReporter
              dirty={dirty}
              pending={isSubmitting || requestLoading}
              onChange={onNavigationStateChange}
            />
          ) : null}
          <div>
            <H4>{t('manage.resources.chatbotPublication')}</H4>
            <p className="mt-1 text-sm text-gray-600">
              {t('manage.resources.chatbotPublicationDescription')}
            </p>
          </div>

          {chatbot.status === ChatbotStatus.Rejected &&
          chatbot.reviewComment ? (
            <UserNotification type="error">
              <span className="font-semibold">
                {t('manage.resources.chatbotPublicationReviewComment')}
              </span>{' '}
              {chatbot.reviewComment}
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

          <FormikTextareaField
            required
            maxLength={2000}
            disabled={isSubmitting || requestLoading}
            name="useCase"
            label={t('manage.resources.chatbotPublicationUseCase')}
            data={{ cy: 'chatbot-publication-use-case' }}
          />
          <div className="grid gap-4 md:grid-cols-2">
            <FormikNumberField
              required
              min={1}
              precision={0}
              disabled={isSubmitting || requestLoading}
              name="expectedStudentCount"
              label={t(
                'manage.resources.chatbotPublicationExpectedStudentCount'
              )}
              data={{ cy: 'chatbot-publication-expected-student-count' }}
            />
            <FormikNumberField
              required
              min={1}
              precision={0}
              disabled={isSubmitting || requestLoading}
              name="proposedCredits"
              label={t('manage.resources.chatbotPublicationProposedCredits')}
              data={{ cy: 'chatbot-publication-proposed-credits' }}
            />
          </div>

          {requestError ? (
            <div role="alert">
              <UserNotification type="error">{requestError}</UserNotification>
            </div>
          ) : null}

          <div className="flex items-center gap-3">
            <Button
              primary
              type="submit"
              loading={isSubmitting || requestLoading}
              disabled={
                !isValid || !canSubmit || isSubmitting || requestLoading
              }
              data={{ cy: 'request-chatbot-publication' }}
            >
              <Button.Label>
                {chatbot.status === ChatbotStatus.Rejected
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
