import { useMutation } from '@apollo/client'
import { MRequestCatalystAccessDocument } from '@klicker-uzh/graphql/dist/ops'
import {
  Button,
  FormikTextareaField,
  FormikTextField,
  UserNotification,
} from '@uzh-bf/design-system'
import { Form, Formik } from 'formik'
import { useTranslations } from 'next-intl'
import * as Yup from 'yup'

function CatalystRequestForm({ onSuccess }: { onSuccess: () => void }) {
  const t = useTranslations()

  const [requestCatalystAccess] = useMutation(MRequestCatalystAccessDocument)

  return (
    <Formik
      isInitialValid={false}
      validateOnMount
      initialValues={{
        institution: '',
        useCase: '',
      }}
      validationSchema={Yup.object().shape({
        institution: Yup.string()
          .required(t('manage.support.catalystRequest.institutionRequired'))
          .min(2, t('manage.support.catalystRequest.institutionMin'))
          .max(160, t('manage.support.catalystRequest.institutionMax')),
        useCase: Yup.string()
          .required(t('manage.support.catalystRequest.useCaseRequired'))
          .min(20, t('manage.support.catalystRequest.useCaseMin'))
          .max(2000, t('manage.support.catalystRequest.useCaseMax')),
      })}
      onSubmit={async (values, { setSubmitting }) => {
        try {
          const result = await requestCatalystAccess({
            variables: {
              institution: values.institution,
              useCase: values.useCase,
            },
          })
          if (result.data?.requestCatalystAccess) {
            onSuccess()
          }
        } catch (error) {
          // Errors are surfaced through the stable GraphQL error contract;
          // no request content is logged client-side.
          console.error('Catalyst access request failed')
        }
        setSubmitting(false)
      }}
    >
      {({ isSubmitting, isValid, status }) => (
        <Form className="flex flex-col gap-3">
          <div className="prose text-sm leading-5">
            {t('manage.support.catalystRequest.explanation')}
          </div>

          <FormikTextField
            required
            name="institution"
            label={t('manage.support.catalystRequest.institution')}
            data={{ cy: 'catalyst-request-institution' }}
          />

          <FormikTextareaField
            name="useCase"
            id="useCase"
            rows="4"
            label={t('manage.support.catalystRequest.useCase')}
            data={{ cy: 'catalyst-request-use-case' }}
            maxLength={2000}
          />

          {status?.submissionFailed && (
            <UserNotification type="error">
              {t('shared.generic.systemError')}
            </UserNotification>
          )}

          <div className="flex flex-row justify-end gap-2">
            <Button
              variant="default"
              onClick={() => onSuccess()}
              data={{ cy: 'catalyst-request-cancel' }}
            >
              {t('shared.generic.cancel')}
            </Button>
            <Button
              variant="primary"
              type="submit"
              disabled={isSubmitting || !isValid}
              loading={isSubmitting}
              data={{ cy: 'catalyst-request-submit' }}
            >
              {t('manage.support.catalystRequest.submit')}
            </Button>
          </div>
        </Form>
      )}
    </Formik>
  )
}

export default CatalystRequestForm
