import { Button, FormikTextareaField } from '@uzh-bf/design-system'
import { Form, Formik } from 'formik'
import { useTranslations } from 'next-intl'
import * as Yup from 'yup'

function ChatbotRejectionForm({
  id,
  disabled,
  onReject,
}: {
  id: string
  disabled: boolean
  onReject: (comment: string) => Promise<void>
}) {
  const t = useTranslations()

  return (
    <Formik
      initialValues={{ comment: '' }}
      validationSchema={Yup.object({ comment: Yup.string().trim().required() })}
      onSubmit={async ({ comment }) => {
        if (!disabled) await onReject(comment.trim())
      }}
    >
      {({ values, isSubmitting }) => (
        <Form className="space-y-3 border-t border-gray-200 pt-4">
          <FormikTextareaField
            name="comment"
            label={t('manage.admin.chatbotRejectionReason')}
            required
            disabled={disabled || isSubmitting}
            data={{ cy: `chatbot-rejection-reason-${id}` }}
          />
          <p className="text-sm text-gray-600">
            {t('manage.admin.chatbotRejectConsequence')}
          </p>
          <Button
            type="submit"
            disabled={disabled || isSubmitting || !values.comment.trim()}
            data={{ cy: `reject-chatbot-${id}` }}
          >
            <Button.Label>{t('manage.admin.chatbotReject')}</Button.Label>
          </Button>
        </Form>
      )}
    </Formik>
  )
}

export default ChatbotRejectionForm
