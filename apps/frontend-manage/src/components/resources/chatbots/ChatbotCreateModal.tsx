import { useMutation } from '@apollo/client'
import {
  CreateChatbotDocument,
  GetChatbotsInfoDocument,
} from '@klicker-uzh/graphql/dist/ops'
import {
  Button,
  FormikSelectField,
  FormikTextareaField,
  FormikTextField,
  Modal,
  UserNotification,
} from '@uzh-bf/design-system'
import { Form, Formik } from 'formik'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import * as Yup from 'yup'
import { getChatbotMutationErrorKey } from './chatbotErrorMessages'

interface OwnedCourse {
  id: string
  name: string
}

interface ChatbotCreateModalProps {
  courses: OwnedCourse[]
  onClose: () => void
  onCreated: (chatbotId: string) => void
}

function ChatbotCreateModal({
  courses,
  onClose,
  onCreated,
}: ChatbotCreateModalProps) {
  const t = useTranslations()
  const [createChatbot, { loading: isCreating }] = useMutation(
    CreateChatbotDocument
  )
  const [submitError, setSubmitError] = useState<string | null>(null)

  return (
    <Modal
      open
      title={t('manage.resources.createChatbot')}
      onClose={onClose}
      data={{ cy: 'create-chatbot-modal' }}
      dataCloseButton={{ cy: 'close-create-chatbot-modal' }}
    >
      <Formik
        validateOnMount
        initialValues={{
          name: '',
          description: '',
          courseId: courses[0]?.id ?? '',
        }}
        validationSchema={Yup.object({
          name: Yup.string()
            .trim()
            .required(t('manage.resources.chatbotNameRequired')),
          courseId: Yup.string().required(
            t('manage.resources.chatbotCourseRequired')
          ),
        })}
        onSubmit={async (values) => {
          setSubmitError(null)
          try {
            const result = await createChatbot({
              variables: {
                name: values.name.trim(),
                description: values.description.trim() || null,
                courseId: values.courseId,
              },
              refetchQueries: [{ query: GetChatbotsInfoDocument }],
              awaitRefetchQueries: true,
            })
            const chatbotId = result.data?.createChatbot.id
            if (!chatbotId) {
              throw new Error(t('manage.resources.chatbotCreateError'))
            }
            onCreated(chatbotId)
          } catch (error) {
            setSubmitError(t(getChatbotMutationErrorKey(error, 'create')))
          }
        }}
      >
        {({ isSubmitting, isValid }) => (
          <Form className="space-y-4">
            <p className="text-sm text-gray-600">
              {t('manage.resources.createChatbotDescription')}
            </p>
            <FormikTextField
              required
              disabled={isSubmitting || isCreating}
              name="name"
              label={t('manage.resources.chatbotName')}
              data={{ cy: 'create-chatbot-name' }}
            />
            <FormikTextareaField
              disabled={isSubmitting || isCreating}
              name="description"
              label={t('manage.resources.chatbotDescription')}
              data={{ cy: 'create-chatbot-description' }}
            />
            {courses.length > 0 ? (
              <FormikSelectField
                required
                disabled={isSubmitting || isCreating}
                name="courseId"
                label={t('manage.resources.chatbotCourse')}
                items={courses.map((course) => ({
                  value: course.id,
                  label: course.name,
                  data: { cy: `create-chatbot-course-${course.id}` },
                }))}
                data={{ cy: 'create-chatbot-course' }}
              />
            ) : (
              <UserNotification type="warning">
                {t('manage.resources.chatbotNoOwnedCourses')}
              </UserNotification>
            )}
            {submitError ? (
              <div role="alert">
                <UserNotification type="error">{submitError}</UserNotification>
              </div>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                data={{ cy: 'cancel-create-chatbot' }}
              >
                <Button.Label>{t('shared.generic.cancel')}</Button.Label>
              </Button>
              <Button
                primary
                type="submit"
                loading={isSubmitting}
                disabled={!isValid || isSubmitting || courses.length === 0}
                data={{ cy: 'submit-create-chatbot' }}
              >
                <Button.Label>
                  {t('manage.resources.createChatbot')}
                </Button.Label>
              </Button>
            </div>
          </Form>
        )}
      </Formik>
    </Modal>
  )
}

export default ChatbotCreateModal
