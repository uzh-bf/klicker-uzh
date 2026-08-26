import { useMutation, useQuery } from '@apollo/client'
import {
  ApproveResponseExampleDocument,
  EditAndApproveResponseExampleDocument,
  GetChatbotResponseExamplesDocument,
  RejectResponseExampleDocument,
  type ResponseExampleDataFragment,
  ResponseExampleStatus,
  ResponseExampleStyle,
} from '@klicker-uzh/graphql/dist/ops'
import { Markdown } from '@klicker-uzh/markdown'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import {
  Badge,
  Button,
  FormLabel,
  Modal,
  SelectField,
  TextareaField,
  UserNotification,
} from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import ContentInput from '../../common/ContentInput'

type ResponseExample = ResponseExampleDataFragment

type EditValues = Pick<
  ResponseExample,
  'chatMode' | 'studentMessage' | 'referenceAnswer' | 'responseStyle'
>

type EditState = EditValues & Pick<ResponseExample, 'id' | 'updatedAt'>

const RESPONSE_EXAMPLE_STUDENT_MESSAGE_MAX_LENGTH = 4_000
const RESPONSE_EXAMPLE_REFERENCE_ANSWER_MAX_LENGTH = 20_000

const RESPONSE_EXAMPLE_STYLE_OPTIONS = [
  {
    value: ResponseExampleStyle.GuidedQuestions,
    labelKey: 'manage.resources.responseExampleStyleGuidedQuestions',
  },
  {
    value: ResponseExampleStyle.StepByStepExplanation,
    labelKey: 'manage.resources.responseExampleStyleStepByStepExplanation',
  },
  {
    value: ResponseExampleStyle.ConciseAnswer,
    labelKey: 'manage.resources.responseExampleStyleConciseAnswer',
  },
  {
    value: ResponseExampleStyle.ClarifyingQuestion,
    labelKey: 'manage.resources.responseExampleStyleClarifyingQuestion',
  },
  {
    value: ResponseExampleStyle.WorkedExample,
    labelKey: 'manage.resources.responseExampleStyleWorkedExample',
  },
  {
    value: ResponseExampleStyle.CompareOptions,
    labelKey: 'manage.resources.responseExampleStyleCompareOptions',
  },
] as const

function responseExampleStatusKey(status: ResponseExampleStatus) {
  switch (status) {
    case ResponseExampleStatus.Approved:
      return 'manage.resources.responseExampleApproved' as const
    case ResponseExampleStatus.Rejected:
      return 'manage.resources.responseExampleRejected' as const
    case ResponseExampleStatus.NeedsReview:
      return 'manage.resources.responseExampleNeedsReview' as const
    case ResponseExampleStatus.Candidate:
      return 'manage.resources.responseExampleCandidate' as const
    default:
      return status
  }
}

function responseExampleStatusClass(status: ResponseExampleStatus) {
  switch (status) {
    case ResponseExampleStatus.Approved:
      return 'bg-green-100 text-green-800 hover:bg-green-200'
    case ResponseExampleStatus.Rejected:
      return 'bg-red-100 text-red-800 hover:bg-red-200'
    case ResponseExampleStatus.NeedsReview:
      return 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
    case ResponseExampleStatus.Candidate:
      return 'bg-blue-100 text-blue-800 hover:bg-blue-200'
    default:
      return 'bg-gray-100 text-gray-800 hover:bg-gray-200'
  }
}

function responseExampleStyleKey(style: ResponseExample['responseStyle']) {
  return RESPONSE_EXAMPLE_STYLE_OPTIONS.find(
    (option) => option.value === style
  )!.labelKey
}

function actionErrorCode(error: unknown) {
  return (
    error as {
      graphQLErrors?: Array<{ extensions?: { code?: string } }>
    }
  ).graphQLErrors?.[0]?.extensions?.code
}

function ChatbotResponseExampleReview({ chatbotId }: { chatbotId: string }) {
  const t = useTranslations()
  const [editValues, setEditValues] = useState<EditState | null>(null)
  const [activeActionId, setActiveActionId] = useState<string | null>(null)
  const [reviewError, setReviewError] = useState<string | null>(null)

  const {
    data,
    loading,
    error,
    refetch: refetchExamples,
  } = useQuery(GetChatbotResponseExamplesDocument, {
    variables: { chatbotId },
    fetchPolicy: 'network-only',
  })
  const [approveResponseExample, { loading: approving }] = useMutation(
    ApproveResponseExampleDocument
  )
  const [editAndApproveResponseExample, { loading: editing }] = useMutation(
    EditAndApproveResponseExampleDocument
  )
  const [rejectResponseExample, { loading: rejecting }] = useMutation(
    RejectResponseExampleDocument
  )
  const [staleEditId, setStaleEditId] = useState<string | null>(null)

  const examples = data?.getChatbotResponseExamples?.examples ?? []
  const chatModes = data?.getChatbotResponseExamples?.chatModes ?? []
  const isMutating = approving || editing || rejecting

  const chatModeLabel = (mode: string) => {
    if (mode === 'tutor') return t('chat.modes.tutor')
    if (mode === 'explainer') return t('chat.modes.explainer')
    return mode
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, (letter) => letter.toUpperCase())
  }

  const openEditor = (example: ResponseExample) => {
    setReviewError(null)
    setStaleEditId(null)
    setEditValues({
      id: example.id,
      updatedAt: example.updatedAt,
      chatMode: example.chatMode,
      studentMessage: example.studentMessage,
      referenceAnswer: example.referenceAnswer,
      responseStyle: example.responseStyle,
    })
  }

  const closeEditor = () => {
    if (editing) return
    setEditValues(null)
    setStaleEditId(null)
    setReviewError(null)
  }

  const setEditValue = <K extends keyof EditValues>(
    key: K,
    value: EditValues[K]
  ) => {
    setEditValues((current) =>
      current ? { ...current, [key]: value } : current
    )
  }

  const handleApprove = async (id: string) => {
    setActiveActionId(id)
    setReviewError(null)

    try {
      const result = await approveResponseExample({ variables: { id } })
      if (!result.data?.approveResponseExample) {
        setReviewError(t('manage.resources.responseExampleReviewForbidden'))
        return
      }
    } catch (error) {
      setReviewError(
        actionErrorCode(error) === 'RESPONSE_EXAMPLE_SOURCES_REQUIRED'
          ? t('manage.resources.responseExampleSourcesRequired')
          : actionErrorCode(error) === 'RESPONSE_EXAMPLE_MODE_UNAVAILABLE'
            ? t('manage.resources.responseExampleModeUnavailable')
            : actionErrorCode(error) === 'RESPONSE_EXAMPLE_DUPLICATE'
              ? t('manage.resources.responseExampleDuplicate')
              : t('manage.resources.responseExampleReviewActionError')
      )
    } finally {
      setActiveActionId(null)
    }
  }

  const handleReject = async (id: string) => {
    setActiveActionId(id)
    setReviewError(null)

    try {
      const result = await rejectResponseExample({ variables: { id } })
      if (!result.data?.rejectResponseExample) {
        setReviewError(t('manage.resources.responseExampleReviewForbidden'))
        return
      }
    } catch (error) {
      const code = actionErrorCode(error)
      setReviewError(
        code === 'RESPONSE_EXAMPLE_DUPLICATE'
          ? t('manage.resources.responseExampleDuplicate')
          : t('manage.resources.responseExampleReviewActionError')
      )
    } finally {
      setActiveActionId(null)
    }
  }

  const handleEditAndApprove = async () => {
    if (!editValues) return

    setReviewError(null)
    try {
      const result = await editAndApproveResponseExample({
        variables: {
          id: editValues.id,
          chatMode: editValues.chatMode,
          studentMessage: editValues.studentMessage,
          referenceAnswer: editValues.referenceAnswer,
          responseStyle: editValues.responseStyle,
          expectedUpdatedAt: editValues.updatedAt,
        },
      })
      if (!result.data?.editAndApproveResponseExample) {
        setReviewError(t('manage.resources.responseExampleReviewForbidden'))
        return
      }
      closeEditor()
    } catch (error) {
      const code = actionErrorCode(error)
      if (code === 'RESPONSE_EXAMPLE_STALE_UPDATE') {
        setStaleEditId(editValues.id)
        setReviewError(t('manage.resources.responseExampleStaleUpdate'))
        try {
          await refetchExamples()
        } catch {
          // Keep the lecturer's draft open even if the refresh is unavailable.
        }
        return
      }

      setReviewError(
        code === 'RESPONSE_EXAMPLE_SOURCES_REQUIRED'
          ? t('manage.resources.responseExampleSourcesRequired')
          : code === 'RESPONSE_EXAMPLE_MODE_UNAVAILABLE'
            ? t('manage.resources.responseExampleModeUnavailable')
            : code === 'RESPONSE_EXAMPLE_DUPLICATE'
              ? t('manage.resources.responseExampleDuplicate')
              : t('manage.resources.responseExampleReviewActionError')
      )
    }
  }

  const hasInvalidEdit =
    !editValues ||
    editValues.studentMessage.length >
      RESPONSE_EXAMPLE_STUDENT_MESSAGE_MAX_LENGTH ||
    editValues.referenceAnswer.length >
      RESPONSE_EXAMPLE_REFERENCE_ANSWER_MAX_LENGTH

  const hasIncompleteEdit =
    !editValues ||
    [
      editValues.chatMode,
      editValues.studentMessage,
      editValues.referenceAnswer,
      editValues.responseStyle,
    ].some((value) => value.trim().length === 0)

  return (
    <section className="border-t pt-4" data-cy="response-examples-review">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-medium text-gray-700">
          {t('manage.resources.responseExamples')}
        </h3>
        <span className="text-xs text-gray-500">
          {t('manage.resources.responseExamplesDescription')}
        </span>
      </div>

      {loading && (
        <div
          role="status"
          aria-live="polite"
          data-cy="response-examples-loading"
        >
          <Loader />
          <span className="sr-only">
            {t('manage.resources.responseExamplesLoading')}
          </span>
        </div>
      )}

      {!loading && error && (
        <UserNotification
          type="error"
          message={t('manage.resources.responseExamplesError')}
          data={{ cy: 'response-examples-error' }}
        />
      )}

      {!loading && !error && examples.length === 0 && (
        <UserNotification
          type="info"
          message={t('manage.resources.responseExamplesEmpty')}
          data={{ cy: 'response-examples-empty' }}
        />
      )}

      {reviewError && (
        <UserNotification
          className={{ root: 'mb-3' }}
          type="error"
          message={reviewError}
          data={{ cy: 'response-examples-action-error' }}
        />
      )}

      {!loading && !error && examples.length > 0 && (
        <div className="space-y-3" data-cy="response-examples-list">
          {examples.map((example) => {
            const chatModeAvailable = chatModes.includes(example.chatMode)
            const actionBusy = isMutating && activeActionId === example.id
            const citationParityComplete =
              example.hasCompleteEligibleCitationParity

            return (
              <article
                key={example.id}
                className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
                data-cy={`response-example-${example.id}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span data-cy={`response-example-status-${example.id}`}>
                      <Badge
                        className={twMerge(
                          'whitespace-nowrap',
                          responseExampleStatusClass(example.status)
                        )}
                      >
                        {t(responseExampleStatusKey(example.status))}
                      </Badge>
                    </span>
                    <span className="text-xs text-gray-500">
                      {t('manage.resources.responseExampleEditChatMode')}:{' '}
                      {chatModeLabel(example.chatMode)}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500">
                    {t('manage.resources.responseExampleResponseStyle')}:{' '}
                    <span className="font-medium text-gray-700">
                      {t(responseExampleStyleKey(example.responseStyle))}
                    </span>
                  </span>
                </div>

                <dl className="mt-3 space-y-3 text-sm">
                  <div>
                    <dt className="font-medium text-gray-700">
                      {t('manage.resources.responseExampleQuestion')}
                    </dt>
                    <dd className="mt-1 whitespace-pre-wrap text-gray-600">
                      {example.studentMessage}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-gray-700">
                      {t('manage.resources.responseExampleReferenceAnswer')}
                    </dt>
                    <dd className="prose prose-sm mt-1 max-w-none text-gray-600">
                      <Markdown
                        className={{ root: 'leading-6' }}
                        content={example.referenceAnswer}
                      />
                    </dd>
                  </div>
                </dl>

                <div className="mt-3 border-t pt-3">
                  <div className="text-xs font-medium text-gray-700">
                    {t('manage.resources.responseExampleSources')}
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    {t('manage.resources.responseExampleSourcesDescription')}
                  </p>
                  <p
                    className={twMerge(
                      'mt-1 text-xs font-medium',
                      citationParityComplete
                        ? 'text-green-700'
                        : 'text-yellow-700'
                    )}
                    data-cy={`response-example-citation-parity-${example.id}`}
                  >
                    {citationParityComplete
                      ? t(
                          'manage.resources.responseExampleCitationParityComplete'
                        )
                      : t(
                          'manage.resources.responseExampleCitationParityIncomplete'
                        )}
                  </p>
                  {example.evidenceReferences.length === 0 ? (
                    <p className="mt-1 text-xs text-gray-500">
                      {t('manage.resources.responseExampleNoSources')}
                    </p>
                  ) : (
                    <ul
                      className="mt-2 space-y-2 text-xs text-gray-600"
                      data-cy={`response-example-evidence-${example.id}`}
                    >
                      {example.evidenceReferences.map((reference) => (
                        <li
                          key={reference.id}
                          className="rounded border border-gray-100 bg-gray-50 p-2"
                        >
                          <div className="flex items-start gap-2">
                            <span className="sr-only">
                              {t(
                                'manage.resources.responseExampleCitationLabel',
                                { index: reference.citationIndex }
                              )}
                            </span>
                            <span
                              aria-hidden="true"
                              className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded bg-blue-50 font-mono text-xs font-semibold text-blue-700"
                            >
                              {reference.citationIndex}
                            </span>
                            <div className="min-w-0">
                              <div className="font-medium text-gray-800">
                                {reference.citationAnchor}
                              </div>
                              <div
                                className={twMerge(
                                  'mt-1 font-medium',
                                  reference.evidenceEligible
                                    ? 'text-green-700'
                                    : 'text-yellow-700'
                                )}
                              >
                                {reference.evidenceEligible
                                  ? t(
                                      'manage.resources.responseExampleSourceAvailable'
                                    )
                                  : t(
                                      'manage.resources.responseExampleSourceUnavailable'
                                    )}
                              </div>
                            </div>
                          </div>
                          <details className="mt-2 text-xs text-gray-500">
                            <summary className="cursor-pointer select-none">
                              {t(
                                'manage.resources.responseExampleSourceDetails'
                              )}
                            </summary>
                            <div className="mt-1 grid gap-x-3 gap-y-1 sm:grid-cols-2">
                              <span className="break-all">
                                <span className="font-medium text-gray-700">
                                  {t(
                                    'manage.resources.responseExampleSourceId'
                                  )}
                                  :
                                </span>{' '}
                                {reference.sourceId}
                              </span>
                              <span className="break-all">
                                <span className="font-medium text-gray-700">
                                  {t('manage.resources.responseExampleChunkId')}
                                  :
                                </span>{' '}
                                {reference.chunkId}
                              </span>
                              <span className="break-all">
                                <span className="font-medium text-gray-700">
                                  {t(
                                    'manage.resources.responseExampleContentHash'
                                  )}
                                  :
                                </span>{' '}
                                {reference.contentHash}
                              </span>
                            </div>
                          </details>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {(example.canApprove ||
                  example.canEditAndApprove ||
                  example.canReject) && (
                  <div className="mt-3 flex flex-wrap gap-2 border-t pt-3">
                    {example.canApprove &&
                      (!citationParityComplete || !chatModeAvailable) && (
                        <p className="basis-full text-xs text-yellow-700">
                          {!chatModeAvailable
                            ? t(
                                'manage.resources.responseExampleModeUnavailable'
                              )
                            : t(
                                'manage.resources.responseExampleSourcesRequired'
                              )}
                        </p>
                      )}
                    {example.canApprove && (
                      <Button
                        primary
                        disabled={
                          isMutating ||
                          !chatModeAvailable ||
                          !citationParityComplete
                        }
                        loading={actionBusy && approving}
                        onClick={() => void handleApprove(example.id)}
                        data={{
                          cy: `response-example-approve-${example.id}`,
                        }}
                      >
                        <Button.Label>
                          {t('manage.resources.responseExampleApprove')}
                        </Button.Label>
                      </Button>
                    )}
                    {example.canEditAndApprove && (
                      <Button
                        disabled={isMutating}
                        onClick={() => openEditor(example)}
                        data={{
                          cy: `response-example-edit-approve-${example.id}`,
                        }}
                      >
                        <Button.Label>
                          {t('manage.resources.responseExampleEditAndApprove')}
                        </Button.Label>
                      </Button>
                    )}
                    {example.canReject && (
                      <Button
                        disabled={isMutating}
                        loading={actionBusy && rejecting}
                        onClick={() => void handleReject(example.id)}
                        data={{
                          cy: `response-example-reject-${example.id}`,
                        }}
                      >
                        <Button.Label>
                          {t('manage.resources.responseExampleReject')}
                        </Button.Label>
                      </Button>
                    )}
                  </div>
                )}
              </article>
            )
          })}
        </div>
      )}

      {editValues && (
        <Modal
          open
          onClose={closeEditor}
          title={t('manage.resources.responseExampleEditTitle')}
          primaryLabel={t('manage.resources.responseExampleSave')}
          primaryButtonStyle="primary"
          primaryDisabled={
            hasIncompleteEdit ||
            hasInvalidEdit ||
            editing ||
            staleEditId === editValues.id
          }
          primaryLoading={editing}
          onPrimaryAction={() => void handleEditAndApprove()}
          secondaryLabel={t('shared.generic.cancel')}
          onSecondaryAction={closeEditor}
          escapeDisabled={editing}
          dataContent={{ cy: 'response-example-edit-modal' }}
          dataPrimaryAction={{ cy: 'response-example-edit-submit' }}
          dataSecondaryAction={{ cy: 'response-example-edit-cancel' }}
          className={{ content: 'max-w-2xl pb-2' }}
        >
          {reviewError && (
            <UserNotification
              className={{ root: 'mb-3' }}
              type="error"
              message={reviewError}
              data={{ cy: 'response-example-edit-error' }}
            />
          )}
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <SelectField
                value={editValues.chatMode}
                onChange={(value) => setEditValue('chatMode', value)}
                label={t('manage.resources.responseExampleEditChatMode')}
                required
                items={chatModes.map((mode) => ({
                  value: mode,
                  label: chatModeLabel(mode),
                }))}
                data={{ cy: 'response-example-edit-chat-mode' }}
              />
              <SelectField
                value={editValues.responseStyle}
                onChange={(value) =>
                  setEditValue(
                    'responseStyle',
                    value as ResponseExample['responseStyle']
                  )
                }
                label={t('manage.resources.responseExampleEditResponseStyle')}
                required
                items={RESPONSE_EXAMPLE_STYLE_OPTIONS.map(
                  ({ value, labelKey }) => ({
                    value,
                    label: t(labelKey),
                  })
                )}
                data={{ cy: 'response-example-edit-response-style' }}
              />
            </div>
            <TextareaField
              value={editValues.studentMessage}
              onChange={(value) => setEditValue('studentMessage', value)}
              label={t('manage.resources.responseExampleEditQuestion')}
              maxLength={RESPONSE_EXAMPLE_STUDENT_MESSAGE_MAX_LENGTH}
              required
              data={{ cy: 'response-example-edit-question' }}
            />
            <div>
              <FormLabel
                required
                label={t('manage.resources.responseExampleEditReferenceAnswer')}
                labelType="small"
              />
              <ContentInput
                content={editValues.referenceAnswer}
                touched={false}
                onChange={(value: string) =>
                  setEditValue('referenceAnswer', value)
                }
                placeholder={t(
                  'manage.resources.responseExampleEditReferenceAnswerPlaceholder'
                )}
                data={{ cy: 'response-example-edit-reference-answer' }}
                className={{ editor: 'min-h-48' }}
              />
              <p className="mt-1 text-xs text-gray-500">
                {t(
                  'manage.resources.responseExampleEditReferenceAnswerLength',
                  {
                    count: editValues.referenceAnswer.length,
                    max: RESPONSE_EXAMPLE_REFERENCE_ANSWER_MAX_LENGTH,
                  }
                )}
              </p>
            </div>
          </div>
        </Modal>
      )}
    </section>
  )
}

export default ChatbotResponseExampleReview
