import { trpc } from '@lib/trpc'
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

  const utils = trpc.useUtils()

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

          const normalizedPin = values.pin.replace(/\s/g, '')

          try {
            const courseId = await utils.participant.checkValidCoursePin.fetch({
              pin: Number(normalizedPin),
            })

            if (courseId) {
              await router.push({
                pathname: '/course/[courseId]/join',
                query: { courseId, pin: normalizedPin },
              })
              return
            }

            toast({
              type: 'error',
              message: t('pwa.login.coursePinInvalid'),
              options: { duration: 6000 },
            })
            resetForm()
          } catch (error) {
            console.error(error)
            toast({
              type: 'error',
              message: t('shared.generic.systemError'),
              options: { duration: 6000 },
            })
          } finally {
            setSubmitting(false)
          }
        }}
      >
        {({ isSubmitting }) => (
          <Form className="flex flex-col">
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
              loading={isSubmitting}
              className={{ root: 'self-end' }}
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
