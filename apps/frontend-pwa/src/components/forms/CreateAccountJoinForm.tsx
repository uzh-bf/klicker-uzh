import { useLazyQuery } from '@apollo/client'
import { CheckValidCoursePinDocument } from '@klicker-uzh/graphql/dist/ops'
import {
  Button,
  FormikPinField,
  toast,
  UserNotification,
} from '@uzh-bf/design-system'
import { Form, Formik } from 'formik'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import * as yup from 'yup'

function CreateAccountJoinForm() {
  const t = useTranslations()
  const router = useRouter()

  const [checkValidCoursePin] = useLazyQuery(CheckValidCoursePinDocument)

  return (
    <div className="mx-auto w-full py-4">
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
            toast({
              type: 'error',
              message: t('pwa.login.coursePinInvalid'),
              options: { duration: 6000 },
            })
            resetForm()
          }

          setSubmitting(false)
        }}
      >
        {({ isSubmitting }) => (
          <Form>
            <FormikPinField
              required
              length={9}
              label={t('pwa.joinCourse.coursePinFormat')}
              tooltip={t('pwa.login.joinCourseTooltip')}
              name="pin"
              className={{ field: 'mb-3 mt-2', inputItem: 'w-8' }}
              data={{ cy: 'pin-field' }}
            />
            <Button
              primary
              type="submit"
              // TODO: add validation and disable button for invalid / incomplete pints
              disabled={isSubmitting}
              className={{ root: 'float-right' }}
              data={{ cy: 'signup-course' }}
            >
              <Button.Label>{t('pwa.login.signup')}</Button.Label>
            </Button>
          </Form>
        )}
      </Formik>
    </div>
  )
}

export default CreateAccountJoinForm
