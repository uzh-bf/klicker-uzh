import { useMutation } from '@apollo/client'
import {
  type Chatbot,
  ChatbotStatus,
  GetChatbotsInfoDocument,
  SaveChatbotDisclaimerDocument,
  UpdateChatbotDocument,
} from '@klicker-uzh/graphql/dist/ops'
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
import type { ChatbotNavigationState } from './chatbotWorkspace'

const metadataEditableStatuses = [
  ChatbotStatus.Draft,
  ChatbotStatus.Rejected,
  ChatbotStatus.Published,
]

const disclaimerEditableStatuses = [ChatbotStatus.Draft, ChatbotStatus.Rejected]

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

function ChatbotAuthoring({
  chatbot,
  publishingAuthorized,
  publishingAuthorizationLoading,
  publishingAuthorizationError,
  onNavigationStateChange,
}: {
  chatbot: Chatbot
  publishingAuthorized: boolean
  publishingAuthorizationLoading: boolean
  publishingAuthorizationError: boolean
  onNavigationStateChange: (state: ChatbotNavigationState) => void
}) {
  const t = useTranslations()
  const [updateChatbot] = useMutation(UpdateChatbotDocument)
  const [saveDisclaimer] = useMutation(SaveChatbotDisclaimerDocument)
  const [metadataError, setMetadataError] = useState<string | null>(null)
  const [metadataSuccess, setMetadataSuccess] = useState(false)
  const [disclaimerError, setDisclaimerError] = useState<string | null>(null)
  const [disclaimerSuccess, setDisclaimerSuccess] = useState(false)
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

  return (
    <div className="space-y-6" data-cy="chatbot-authoring">
      <section className="space-y-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <H4>{t('manage.resources.chatbotMetadata')}</H4>
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
            onSubmit={async (values) => {
              setMetadataError(null)
              setMetadataSuccess(false)
              try {
                await updateChatbot({
                  variables: {
                    id: chatbot.id,
                    name: values.name.trim(),
                    description: values.description.trim() || null,
                  },
                  refetchQueries: [{ query: GetChatbotsInfoDocument }],
                  awaitRefetchQueries: true,
                })
                setMetadataSuccess(true)
              } catch (error) {
                setMetadataError(
                  t(getChatbotMutationErrorKey(error, 'metadata'))
                )
              }
            }}
          >
            {({ dirty, isSubmitting, isValid }) => (
              <Form className="space-y-3">
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
                <div className="flex items-center gap-3">
                  <Button
                    primary
                    type="submit"
                    loading={isSubmitting}
                    disabled={!isValid || isSubmitting}
                    data={{ cy: 'save-chatbot-metadata' }}
                  >
                    <Button.Label>
                      {t('manage.resources.saveChatbotMetadata')}
                    </Button.Label>
                  </Button>
                  {metadataSuccess ? (
                    <span
                      className="text-sm text-green-700"
                      role="status"
                      aria-live="polite"
                    >
                      {t('manage.resources.chatbotMetadataSaveSuccess')}
                    </span>
                  ) : null}
                </div>
              </Form>
            )}
          </Formik>
        ) : (
          <UserNotification>
            {t('manage.resources.chatbotMetadataReadonly')}
          </UserNotification>
        )}
      </section>

      <section className="space-y-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <H4>{t('manage.resources.chatbotDisclaimerAuthoring')}</H4>
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
                .required(t('manage.resources.chatbotDisclaimerTitleRequired')),
              introText: Yup.string()
                .trim()
                .max(
                  10_000,
                  t('manage.resources.chatbotDisclaimerIntroTooLong')
                )
                .test({
                  message: t('manage.resources.chatbotDisclaimerIntroRequired'),
                  test: (value) => {
                    const normalizedValue = value?.trim()
                    return Boolean(
                      normalizedValue && !/^<br>\s*$/i.test(normalizedValue)
                    )
                  },
                }),
            })}
            onSubmit={async (values) => {
              setDisclaimerError(null)
              setDisclaimerSuccess(false)
              try {
                await saveDisclaimer({
                  variables: {
                    chatbotId: chatbot.id,
                    expectedDisclaimerId: disclaimer?.id ?? null,
                    title: values.title.trim(),
                    introText: values.introText.trim(),
                  },
                  refetchQueries: [{ query: GetChatbotsInfoDocument }],
                  awaitRefetchQueries: true,
                })
                setDisclaimerSuccess(true)
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
                <div className="flex items-center gap-3">
                  <Button
                    primary
                    type="submit"
                    loading={isSubmitting}
                    disabled={!isValid || isSubmitting}
                    data={{ cy: 'save-chatbot-disclaimer' }}
                  >
                    <Button.Label>
                      {t('manage.resources.saveChatbotDisclaimer')}
                    </Button.Label>
                  </Button>
                  {disclaimerSuccess ? (
                    <span
                      className="text-sm text-green-700"
                      role="status"
                      aria-live="polite"
                    >
                      {t('manage.resources.chatbotDisclaimerSaveSuccess')}
                    </span>
                  ) : null}
                </div>
                <div className="border-t border-gray-200 pt-4">
                  <H4>{t('manage.resources.chatbotDisclaimerPreview')}</H4>
                  <p className="mb-3 text-sm text-gray-600">
                    {t('manage.resources.chatbotDisclaimerPreviewDescription')}
                  </p>
                  <ChatbotDisclaimerPreview
                    title={values.title}
                    introText={values.introText}
                  />
                </div>
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

      <section className="space-y-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <ChatbotPublicationRequest
          chatbot={chatbot}
          publishingAuthorized={publishingAuthorized}
          publishingAuthorizationLoading={publishingAuthorizationLoading}
          publishingAuthorizationError={publishingAuthorizationError}
          onNavigationStateChange={setPublicationNavigationState}
        />
      </section>
    </div>
  )
}

export { disclaimerEditableStatuses, metadataEditableStatuses }
export default ChatbotAuthoring
