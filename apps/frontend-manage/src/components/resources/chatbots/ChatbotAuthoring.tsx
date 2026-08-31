import { useMutation } from '@apollo/client'
import {
  type Chatbot,
  ChatbotStatus,
  GetChatbotsInfoDocument,
  SaveChatbotDisclaimerDocument,
  UpdateChatbotDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Markdown } from '@klicker-uzh/markdown'
import {
  Button,
  FormikTextareaField,
  FormikTextField,
  H4,
  Label,
  UserNotification,
} from '@uzh-bf/design-system'
import { Form, Formik, useField } from 'formik'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import * as Yup from 'yup'
import ContentInput from '../../common/ContentInput'
import ChatbotDisclaimerPreview from './ChatbotDisclaimerPreview'
import ChatbotPublicationRequest from './ChatbotPublicationRequest'
import { getChatbotMutationErrorKey } from './chatbotErrorMessages'
import type {
  ChatbotNavigationState,
  ChatbotSetupStep,
  ChatbotWorkspaceView,
} from './chatbotWorkspace'
import { hasCompleteDisclaimer } from './chatbotWorkspace'

const metadataEditableStatuses = [
  ChatbotStatus.Draft,
  ChatbotStatus.Rejected,
  ChatbotStatus.Published,
]

const disclaimerEditableStatuses = [ChatbotStatus.Draft, ChatbotStatus.Rejected]

type SetupStepItem = {
  step: ChatbotSetupStep
  label: string
  description: string
}

function NavigationStateReporter({
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

function DisclaimerIntroField({
  disabled,
  editorId,
  errorId,
  labelId,
}: {
  disabled: boolean
  editorId: string
  errorId: string
  labelId: string
}) {
  const t = useTranslations()
  const [field, meta, helpers] = useField<string>('introText')

  return (
    <div>
      <Label
        id={labelId}
        forId={editorId}
        required
        label={t('manage.resources.chatbotDisclaimerIntro')}
        className={{
          root: 'my-auto mr-2 min-w-max font-bold mt-1 -mb-0.5 leading-6 text-gray-600',
        }}
      />
      <ContentInput
        id={editorId}
        aria-labelledby={labelId}
        aria-describedby={meta.error && meta.touched ? errorId : undefined}
        aria-required
        aria-invalid={Boolean(meta.error && meta.touched)}
        toolbarPreset="basic"
        disabled={disabled}
        content={field.value}
        onChange={(value: string) => {
          helpers.setValue(value)
          helpers.setTouched(true)
        }}
        error={meta.error}
        touched={meta.touched}
        placeholder={t(
          'manage.resources.chatbotDisclaimerIntroEditorPlaceholder'
        )}
        className={{ editor: 'min-h-32' }}
        data={{ cy: 'chatbot-disclaimer-intro' }}
      />
      {meta.error && meta.touched ? (
        <p id={errorId} className="mt-1 text-sm text-red-700" role="alert">
          {meta.error}
        </p>
      ) : null}
    </div>
  )
}

function SetupProgress({ step }: { step: ChatbotSetupStep }) {
  const t = useTranslations()
  const items: SetupStepItem[] = [
    {
      step: 'basics',
      label: t('manage.resources.chatbotSetupBasics'),
      description: t('manage.resources.chatbotSetupBasicsDescription'),
    },
    {
      step: 'disclaimer',
      label: t('manage.resources.chatbotSetupDisclaimer'),
      description: t('manage.resources.chatbotSetupDisclaimerDescription'),
    },
    {
      step: 'review',
      label: t('manage.resources.chatbotSetupReview'),
      description: t('manage.resources.chatbotSetupReviewDescription'),
    },
  ]
  const currentIndex = items.findIndex((item) => item.step === step)

  return (
    <>
      <ol
        aria-label={t('manage.resources.chatbotSetupProgress')}
        className="grid gap-2 sm:grid-cols-3"
        data-cy="chatbot-setup-progress"
      >
        {items.map((item, index) => {
          const current = item.step === step
          const complete = index < currentIndex
          return (
            <li
              key={item.step}
              aria-current={current ? 'step' : undefined}
              className={
                current
                  ? 'rounded-md border border-primary-300 bg-primary-50 p-3'
                  : 'rounded-md border border-gray-200 bg-gray-50 p-3'
              }
              data-cy={`chatbot-setup-step-${item.step}`}
            >
              <div className="flex items-center gap-2 text-sm font-semibold">
                <span
                  aria-hidden
                  className={
                    current || complete
                      ? 'flex h-6 w-6 items-center justify-center rounded-full bg-primary-600 text-xs text-white'
                      : 'flex h-6 w-6 items-center justify-center rounded-full border border-gray-300 text-xs text-gray-600'
                  }
                >
                  {complete ? '✓' : index + 1}
                </span>
                <span>{item.label}</span>
                <span className="sr-only">
                  {complete
                    ? t('manage.resources.chatbotSetupStepCompleted')
                    : current
                      ? t('manage.resources.chatbotSetupStepCurrent')
                      : t('manage.resources.chatbotSetupStepNotCompleted')}
                </span>
              </div>
              <p className="mt-1 pl-8 text-xs text-gray-600">
                {item.description}
              </p>
            </li>
          )
        })}
      </ol>
      <p className="sr-only" role="status" aria-live="polite">
        {t('manage.resources.chatbotSetupStepAnnouncement', {
          step: items[currentIndex]?.label ?? '',
        })}
      </p>
    </>
  )
}

function SetupStepHeader({
  step,
  onNavigate,
}: {
  step: ChatbotSetupStep
  onNavigate: (view: ChatbotWorkspaceView, step?: ChatbotSetupStep) => void
}) {
  const t = useTranslations()
  const previousNavigation =
    step === 'basics'
      ? () => onNavigate('overview')
      : () =>
          onNavigate('setup', step === 'disclaimer' ? 'basics' : 'disclaimer')

  return (
    <div className="space-y-4" data-cy="chatbot-setup">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <H4>{t('manage.resources.chatbotSetupTitle')}</H4>
          <p className="mt-1 text-sm text-gray-600">
            {t('manage.resources.chatbotSetupDescription')}
          </p>
        </div>
        <Button
          type="button"
          onClick={previousNavigation}
          data={{ cy: 'chatbot-setup-back' }}
        >
          <Button.Label>{t('shared.generic.back')}</Button.Label>
        </Button>
      </div>
      <SetupProgress step={step} />
    </div>
  )
}

function SetupStepFooter({
  action,
  disabled,
  loading,
  savingLabel,
  success,
  successMessage,
  testId,
}: {
  action: string
  disabled: boolean
  loading: boolean
  savingLabel: string
  success?: boolean
  successMessage?: string
  testId: string
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 pt-4">
      <span className="text-xs text-gray-500" aria-live="polite">
        {loading ? savingLabel : null}
      </span>
      <div className="flex items-center gap-3">
        <Button
          primary
          type="submit"
          loading={loading}
          disabled={disabled}
          data={{ cy: testId }}
        >
          <Button.Label>{action}</Button.Label>
        </Button>
        {success && successMessage ? (
          <span
            className="text-sm text-green-700"
            role="status"
            aria-live="polite"
          >
            {successMessage}
          </span>
        ) : null}
      </div>
    </div>
  )
}

function ChatbotAuthoring({
  chatbot,
  step,
  publishingAuthorized,
  publishingAuthorizationLoading,
  publishingAuthorizationError,
  onNavigate,
  onNavigationStateChange,
}: {
  chatbot: Chatbot
  step: ChatbotSetupStep
  publishingAuthorized: boolean
  publishingAuthorizationLoading: boolean
  publishingAuthorizationError: boolean
  onNavigate: (
    view: ChatbotWorkspaceView,
    step?: ChatbotSetupStep,
    internal?: boolean
  ) => void
  onNavigationStateChange: (state: ChatbotNavigationState) => void
}) {
  const t = useTranslations()
  const [updateChatbot] = useMutation(UpdateChatbotDocument)
  const [saveDisclaimer] = useMutation(SaveChatbotDisclaimerDocument)
  const [metadataError, setMetadataError] = useState<string | null>(null)
  const [metadataSuccess, setMetadataSuccess] = useState(false)
  const [disclaimerError, setDisclaimerError] = useState<string | null>(null)
  const [advanceToReview, setAdvanceToReview] = useState(false)
  const [metadataNavigationState, setMetadataNavigationState] =
    useState<ChatbotNavigationState>({ dirty: false, pending: false })
  const [disclaimerNavigationState, setDisclaimerNavigationState] =
    useState<ChatbotNavigationState>({ dirty: false, pending: false })
  const [publicationNavigationState, setPublicationNavigationState] =
    useState<ChatbotNavigationState>({ dirty: false, pending: false })

  const metadataEditable = metadataEditableStatuses.includes(chatbot.status)
  const disclaimerEditable = disclaimerEditableStatuses.includes(chatbot.status)
  const disclaimer = chatbot.disclaimerSummary
  const editorKey = `${chatbot.id}:${disclaimer?.id ?? 'new'}`
  const published = chatbot.status === ChatbotStatus.Published

  useEffect(() => {
    onNavigationStateChange({
      dirty:
        metadataNavigationState.dirty ||
        disclaimerNavigationState.dirty ||
        publicationNavigationState.dirty,
      pending:
        metadataNavigationState.pending ||
        disclaimerNavigationState.pending ||
        publicationNavigationState.pending,
    })
  }, [
    disclaimerNavigationState,
    metadataNavigationState,
    onNavigationStateChange,
    publicationNavigationState,
  ])

  useEffect(() => {
    if (!metadataEditable) {
      setMetadataNavigationState({ dirty: false, pending: false })
    }
    if (!disclaimerEditable) {
      setDisclaimerNavigationState({ dirty: false, pending: false })
    }
  }, [disclaimerEditable, metadataEditable])

  useEffect(() => {
    if (!advanceToReview || !hasCompleteDisclaimer(chatbot)) return
    setAdvanceToReview(false)
    onNavigate('setup', 'review', true)
  }, [advanceToReview, chatbot, onNavigate])

  useEffect(() => {
    if (
      advanceToReview &&
      (step !== 'disclaimer' || disclaimerNavigationState.dirty)
    ) {
      setAdvanceToReview(false)
    }
  }, [advanceToReview, disclaimerNavigationState.dirty, step])

  const navigateAfterSave = (nextStep: ChatbotSetupStep) => {
    onNavigate('setup', nextStep, true)
  }

  return (
    <div className="space-y-6" data-cy="chatbot-authoring">
      <SetupStepHeader step={step} onNavigate={onNavigate} />

      {step === 'basics' ? (
        <section
          className="space-y-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
          data-cy="chatbot-setup-basics"
        >
          <div>
            <H4>{t('manage.resources.chatbotSetupBasicsTitle')}</H4>
            <p className="mt-1 text-sm text-gray-600">
              {t('manage.resources.chatbotSetupBasicsDescriptionLong')}
            </p>
          </div>
          <div>
            <div className="text-sm font-medium text-gray-700">
              {t('manage.resources.chatbotCourse')}
            </div>
            <div
              className="mt-1 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700"
              data-cy="chatbot-course-readonly"
            >
              {(chatbot.courses ?? []).map((course) => course.name).join(', ')}
            </div>
            <p className="mt-1 text-xs text-gray-500">
              {t('manage.resources.chatbotCourseReadonly')}
            </p>
          </div>
          {metadataEditable ? (
            <Formik
              enableReinitialize
              validateOnMount
              initialValues={{
                name: chatbot.name,
                description: chatbot.description ?? '',
              }}
              validationSchema={Yup.object({
                name: Yup.string()
                  .trim()
                  .required(t('manage.resources.chatbotNameRequired')),
              })}
              onSubmit={async (values, { resetForm }) => {
                setMetadataError(null)
                setMetadataSuccess(false)
                const normalizedValues = {
                  name: values.name.trim(),
                  description: values.description.trim(),
                }
                try {
                  await updateChatbot({
                    variables: {
                      id: chatbot.id,
                      name: normalizedValues.name,
                      description: normalizedValues.description || null,
                    },
                    refetchQueries: [{ query: GetChatbotsInfoDocument }],
                    awaitRefetchQueries: true,
                  })
                  resetForm({ values: normalizedValues })
                  setMetadataSuccess(true)
                  if (!published) navigateAfterSave('disclaimer')
                } catch (error) {
                  setMetadataError(
                    t(getChatbotMutationErrorKey(error, 'metadata'))
                  )
                }
              }}
            >
              {({ dirty, isSubmitting, isValid }) => (
                <Form className="space-y-4">
                  <NavigationStateReporter
                    dirty={dirty}
                    pending={isSubmitting}
                    onChange={setMetadataNavigationState}
                  />
                  <FormikTextField
                    required
                    disabled={isSubmitting}
                    name="name"
                    label={t('manage.resources.chatbotName')}
                    data={{ cy: 'chatbot-name' }}
                  />
                  <FormikTextareaField
                    disabled={isSubmitting}
                    name="description"
                    label={t('manage.resources.chatbotDescription')}
                    data={{ cy: 'chatbot-description' }}
                  />
                  {metadataError ? (
                    <div role="alert">
                      <UserNotification type="error">
                        {metadataError}
                      </UserNotification>
                    </div>
                  ) : null}
                  <SetupStepFooter
                    action={
                      published
                        ? t('manage.resources.saveChatbotMetadata')
                        : t('manage.resources.chatbotSetupSaveAndContinue')
                    }
                    disabled={!isValid || isSubmitting}
                    loading={isSubmitting}
                    savingLabel={t('manage.resources.chatbotSetupSaving')}
                    success={published && metadataSuccess}
                    successMessage={t(
                      'manage.resources.chatbotMetadataSaveSuccess'
                    )}
                    testId="save-chatbot-metadata"
                  />
                </Form>
              )}
            </Formik>
          ) : (
            <UserNotification>
              {t('manage.resources.chatbotMetadataReadonly')}
            </UserNotification>
          )}
        </section>
      ) : null}

      {step === 'disclaimer' ? (
        <section
          className="space-y-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
          data-cy="chatbot-setup-disclaimer"
        >
          <div>
            <H4>{t('manage.resources.chatbotSetupDisclaimerTitle')}</H4>
            <p className="mt-1 text-sm text-gray-600">
              {t('manage.resources.chatbotSetupDisclaimerDescriptionLong')}
            </p>
          </div>
          {disclaimerEditable ? (
            <Formik
              key={editorKey}
              enableReinitialize
              validateOnMount
              initialValues={{
                title: disclaimer?.title ?? '',
                introText: disclaimer?.introText ?? '',
              }}
              validationSchema={Yup.object({
                title: Yup.string()
                  .trim()
                  .max(160, t('manage.resources.chatbotDisclaimerTitleTooLong'))
                  .required(
                    t('manage.resources.chatbotDisclaimerTitleRequired')
                  ),
                introText: Yup.string()
                  .trim()
                  .max(
                    10_000,
                    t('manage.resources.chatbotDisclaimerIntroTooLong')
                  )
                  .test({
                    message: t(
                      'manage.resources.chatbotDisclaimerIntroRequired'
                    ),
                    test: (value) => {
                      const normalizedValue = value?.trim()
                      return Boolean(
                        normalizedValue && !/^<br>\s*$/i.test(normalizedValue)
                      )
                    },
                  }),
              })}
              onSubmit={async (values, { resetForm }) => {
                setDisclaimerError(null)
                const normalizedValues = {
                  title: values.title.trim(),
                  introText: values.introText.trim(),
                }
                try {
                  await saveDisclaimer({
                    variables: {
                      chatbotId: chatbot.id,
                      expectedDisclaimerId: disclaimer?.id ?? null,
                      title: normalizedValues.title,
                      introText: normalizedValues.introText,
                    },
                    refetchQueries: [{ query: GetChatbotsInfoDocument }],
                    awaitRefetchQueries: true,
                  })
                  resetForm({ values: normalizedValues })
                  setAdvanceToReview(true)
                } catch (error) {
                  setDisclaimerError(
                    t(getChatbotMutationErrorKey(error, 'disclaimer'))
                  )
                }
              }}
            >
              {({ dirty, isSubmitting, isValid, values }) => (
                <Form className="space-y-4">
                  <NavigationStateReporter
                    dirty={dirty}
                    pending={isSubmitting}
                    onChange={setDisclaimerNavigationState}
                  />
                  <FormikTextField
                    required
                    disabled={isSubmitting}
                    name="title"
                    label={t('manage.resources.chatbotDisclaimerTitle')}
                    data={{ cy: 'chatbot-disclaimer-title' }}
                  />
                  <DisclaimerIntroField
                    disabled={isSubmitting}
                    editorId={`chatbot-disclaimer-intro-${chatbot.id}`}
                    errorId={`chatbot-disclaimer-intro-error-${chatbot.id}`}
                    labelId={`chatbot-disclaimer-intro-label-${chatbot.id}`}
                  />
                  {disclaimerError ? (
                    <div role="alert">
                      <UserNotification
                        id="chatbot-disclaimer-save-error"
                        type="error"
                      >
                        {disclaimerError}
                      </UserNotification>
                    </div>
                  ) : null}
                  <div className="border-t border-gray-200 pt-4">
                    <H4>{t('manage.resources.chatbotDisclaimerPreview')}</H4>
                    <p className="mb-3 text-sm text-gray-600">
                      {t(
                        'manage.resources.chatbotDisclaimerPreviewDescription'
                      )}
                    </p>
                    <ChatbotDisclaimerPreview
                      title={values.title}
                      introText={values.introText}
                    />
                  </div>
                  <SetupStepFooter
                    action={t('manage.resources.chatbotSetupSaveAndContinue')}
                    disabled={!isValid || isSubmitting}
                    loading={isSubmitting}
                    savingLabel={t('manage.resources.chatbotSetupSaving')}
                    testId="save-chatbot-disclaimer"
                  />
                </Form>
              )}
            </Formik>
          ) : (
            <>
              <UserNotification>
                {t('manage.resources.chatbotDisclaimerReadonly')}
              </UserNotification>
              <ChatbotDisclaimerPreview
                title={disclaimer?.title ?? ''}
                introText={disclaimer?.introText ?? ''}
              />
            </>
          )}
        </section>
      ) : null}

      {step === 'review' ? (
        <section
          className="space-y-5 rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
          data-cy="chatbot-setup-review"
        >
          <div>
            <H4>{t('manage.resources.chatbotSetupReviewTitle')}</H4>
            <p className="mt-1 text-sm text-gray-600">
              {t('manage.resources.chatbotSetupReviewDescriptionLong')}
            </p>
          </div>

          <div className="rounded-md border border-gray-200 bg-gray-50 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h5 className="font-semibold text-gray-900">
                {t('manage.resources.chatbotSetupBasicsTitle')}
              </h5>
              <Button
                type="button"
                onClick={() => onNavigate('setup', 'basics')}
                data={{ cy: 'chatbot-setup-edit-basics' }}
              >
                <Button.Label>
                  {t('manage.resources.chatbotSetupEdit')}
                </Button.Label>
              </Button>
            </div>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="font-medium text-gray-600">
                  {t('manage.resources.chatbotName')}
                </dt>
                <dd
                  className="mt-1 text-gray-900"
                  data-cy="chatbot-review-name"
                >
                  {chatbot.name}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-gray-600">
                  {t('manage.resources.chatbotCourse')}
                </dt>
                <dd
                  className="mt-1 text-gray-900"
                  data-cy="chatbot-review-course"
                >
                  {(chatbot.courses ?? [])
                    .map((course) => course.name)
                    .join(', ')}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="font-medium text-gray-600">
                  {t('manage.resources.chatbotDescription')}
                </dt>
                <dd className="mt-1 whitespace-pre-wrap text-gray-900">
                  {chatbot.description?.trim() || t('shared.generic.unknown')}
                </dd>
              </div>
            </dl>
          </div>

          <div className="rounded-md border border-gray-200 bg-gray-50 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h5 className="font-semibold text-gray-900">
                {t('manage.resources.chatbotSetupDisclaimerTitle')}
              </h5>
              <Button
                type="button"
                onClick={() => onNavigate('setup', 'disclaimer')}
                data={{ cy: 'chatbot-setup-edit-disclaimer' }}
              >
                <Button.Label>
                  {t('manage.resources.chatbotSetupEdit')}
                </Button.Label>
              </Button>
            </div>
            <h6 className="font-medium text-gray-900">
              {disclaimer?.title ||
                t('manage.resources.chatbotDisclaimerTitlePlaceholder')}
            </h6>
            <div
              className="mt-2 text-sm text-gray-700"
              data-cy="chatbot-review-disclaimer"
            >
              {disclaimer?.introText ? (
                <Markdown
                  content={disclaimer.introText}
                  withProse
                  className={{ root: 'prose prose-sm max-w-none' }}
                />
              ) : (
                t('manage.resources.chatbotDisclaimerIntroPlaceholder')
              )}
            </div>
          </div>

          <UserNotification>
            {t('manage.resources.chatbotSetupPublicationNote')}
          </UserNotification>

          <div className="border-t border-gray-200 pt-4">
            <ChatbotPublicationRequest
              chatbot={chatbot}
              publishingAuthorized={publishingAuthorized}
              publishingAuthorizationLoading={publishingAuthorizationLoading}
              publishingAuthorizationError={publishingAuthorizationError}
              onNavigationStateChange={setPublicationNavigationState}
            />
          </div>
        </section>
      ) : null}
    </div>
  )
}

export { disclaimerEditableStatuses, metadataEditableStatuses }
export default ChatbotAuthoring
