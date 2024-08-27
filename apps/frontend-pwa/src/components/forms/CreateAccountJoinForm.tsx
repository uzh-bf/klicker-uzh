import { useLazyQuery } from '@apollo/client'
import { CheckValidCoursePinDocument } from '@klicker-uzh/graphql/dist/ops'
import {
  Button,
  FormikPinField,
  Toast,
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
    <div className="mx-auto w-72 py-4 sm:w-96 md:w-[28rem]">
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
              className={{ root: 'float-right' }}
              type="submit"
              // TODO: improve state that field is disabled for invalid pins
              disabled={isSubmitting}
              data={{ cy: 'signup-course' }}
            >
              {t('pwa.login.signup')}
            </Button>
          </Form>
        )}
      </Formik>
      <Toast
        openExternal={errorToast}
        setOpenExternal={setErrorToast}
        type="error"
      >
        {t('pwa.login.coursePinInvalid')}
      </Toast>
    </div>
  )
}

export default CreateAccountJoinForm
