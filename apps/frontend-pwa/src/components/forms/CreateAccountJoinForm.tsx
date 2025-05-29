import { useLazyQuery } from '@apollo/client'
import { CheckValidCoursePinDocument } from '@klicker-uzh/graphql/dist/ops'
import {
  Button,
  FormikPinField,
  ToastLegacy,
  UserNotification,
} from '@uzh-bf/design-system'
import { Form, Formik } from 'formik'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { useState } from 'react'
import * as yup from 'yup'

function CreateAccountJoinForm() {
  const t = useTranslations()
  const router = useRouter()

  const [errorToast, setErrorToast] = useState(false)
  const [checkValidCoursePin] = useLazyQuery(CheckValidCoursePinDocument)

  return (
    <div className="mx-auto w-full p-4">
      <UserNotification type="info">
        {t('pwa.login.existingParticipantAccount')}
      </UserNotification>
      <Formik
        initialValues={{ pin: '' }}
        validationSchema={yup.object({
          pin: yup
            .number()
            .typeError(t('pwa.joinCourse.coursePinNumerical'))
            .required(t('pwa.joinCourse.coursePinRequired')),
        })}
        onSubmit={async (values, { setSubmitting, resetForm }) => {
          setSubmitting(true)

          const { data } = await checkValidCoursePin({
            variables: { pin: parseInt(values.pin.replace(/\s/g, '')) },
          })

          if (data?.checkValidCoursePin) {
            router.push(
              `/course/${
                data.checkValidCoursePin
              }/join?pin=${values.pin.replace(/\s/g, '')}`
            )
          } else {
            setErrorToast(true)
            resetForm()
          }

          setSubmitting(false)
        }}
      >
        {({ isSubmitting }) => (
          <Form>
            <FormikPinField
              required
              label={t('pwa.joinCourse.coursePinFormat')}
              tooltip={t('pwa.login.joinCourseTooltip')}
              name="pin"
              className={{
                root: 'my-2',
                tooltip: 'max-w-[20rem] md:max-w-[30rem]',
              }}
              data={{ cy: 'pin-field' }}
            />
            <Button
              primary
              type="submit"
              // TODO: improve state that field is disabled for invalid pins
              disabled={isSubmitting}
              className={{ root: 'float-right' }}
              data={{ cy: 'signup-course' }}
            >
              <Button.Label>{t('pwa.login.signup')}</Button.Label>
            </Button>
          </Form>
        )}
      </Formik>
      <ToastLegacy
        dismissible
        openExternal={errorToast}
        onCloseExternal={() => setErrorToast(false)}
        type="error"
        duration={6000}
      >
        {t('pwa.login.coursePinInvalid')}
      </ToastLegacy>
    </div>
  )
}

export default CreateAccountJoinForm
