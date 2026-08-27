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
  FormLabel,
  H4,
  UserNotification,
} from '@uzh-bf/design-system'
import { Form, Formik, useField } from 'formik'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import * as Yup from 'yup'
import ContentInput from '../../common/ContentInput'
import ChatbotDisclaimerPreview from './ChatbotDisclaimerPreview'

const metadataEditableStatuses = [
  ChatbotStatus.Draft,
  ChatbotStatus.Rejected,
  ChatbotStatus.Published,
]

const disclaimerEditableStatuses = [ChatbotStatus.Draft, ChatbotStatus.Rejected]

function DisclaimerIntroField({ editorKey }: { editorKey: string }) {
  const t = useTranslations()
  const [field, meta, helpers] = useField<string>('introText')

  return (
    <div>
      <FormLabel
        required
        label={t('manage.resources.chatbotDisclaimerIntro')}
        labelType="small"
      />
      <ContentInput
        key={editorKey}
        toolbarPreset="basic"
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
        <p className="mt-1 text-sm text-red-700">{meta.error}</p>
      ) : null}
    </div>
  )
}

function ChatbotAuthoring({ chatbot }: { chatbot: Chatbot }) {
  const t = useTranslations()
  const [updateChatbot] = useMutation(UpdateChatbotDocument)
  const [saveDisclaimer] = useMutation(SaveChatbotDisclaimerDocument)
  const [metadataError, setMetadataError] = useState<string | null>(null)
  const [metadataSuccess, setMetadataSuccess] = useState(false)
  const [disclaimerError, setDisclaimerError] = useState<string | null>(null)
  const [disclaimerSuccess, setDisclaimerSuccess] = useState(false)

  const metadataEditable = metadataEditableStatuses.includes(chatbot.status)
  const disclaimerEditable = disclaimerEditableStatuses.includes(chatbot.status)
  const disclaimer = chatbot.disclaimerSummary
  const editorKey = `${chatbot.id}:${disclaimer?.id ?? 'new'}`

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
            {chatbot.courses.map((course) => course.name).join(', ')}
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
                  error instanceof Error
                    ? error.message
                    : t('manage.resources.chatbotMetadataSaveError')
                )
              }
            }}
          >
            {({ isSubmitting, isValid }) => (
              <Form className="space-y-3">
                <FormikTextField
                  required
                  name="name"
                  label={t('manage.resources.chatbotName')}
                  data={{ cy: 'chatbot-name' }}
                />
                <FormikTextareaField
                  name="description"
                  label={t('manage.resources.chatbotDescription')}
                  data={{ cy: 'chatbot-description' }}
                />
                {metadataError ? (
                  <UserNotification type="error">
                    {metadataError}
                  </UserNotification>
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
                  error instanceof Error
                    ? error.message
                    : t('manage.resources.chatbotDisclaimerSaveError')
                )
              }
            }}
          >
            {({ isSubmitting, isValid, values }) => (
              <Form className="space-y-4">
                <FormikTextField
                  required
                  name="title"
                  label={t('manage.resources.chatbotDisclaimerTitle')}
                  data={{ cy: 'chatbot-disclaimer-title' }}
                />
                <DisclaimerIntroField editorKey={editorKey} />
                {disclaimerError ? (
                  <UserNotification type="error">
                    {disclaimerError}
                  </UserNotification>
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
    </div>
  )
}

export { disclaimerEditableStatuses, metadataEditableStatuses }
export default ChatbotAuthoring
