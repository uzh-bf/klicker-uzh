import { useLazyQuery } from '@apollo/client'
import { CheckValidCoursePinDocument } from '@klicker-uzh/graphql/dist/ops'
import {
  Button,
  FormikPinField,
  H2,
  UserNotification,
} from '@uzh-bf/design-system'
import { Form, Formik } from 'formik'
import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { useState } from 'react'
import * as Yup from 'yup'
import Layout from '../components/Layout'

function JoinPage() {
  const t = useTranslations()
  const router = useRouter()
  const [checkValidCoursePin] = useLazyQuery(CheckValidCoursePinDocument)
  const [showError, setError] = useState<string | false>(false)

  const joinCourseWithPinSchema = Yup.object({
    pin: Yup.number()
      .typeError(t('pwa.joinCourse.coursePinNumerical'))
      .test(
        'len',
        t('pwa.joinCourse.coursePinRequired'),
        (val) => val !== undefined && val.toString().length === 9
      )
      .required(t('pwa.joinCourse.coursePinRequired')),
  })

  return (
    <Layout displayName={t('pwa.general.joinCourse')}>
      <div className="mx-auto max-w-sm md:mb-4 md:rounded md:border md:p-8 md:pt-6 lg:max-w-md">
        <H2>{t('pwa.general.joinCourse')}</H2>
        <div className="mb-5">{t('pwa.joinCourse.introLoggedInNoCourse')}</div>
        <Formik
          validateOnMount
          initialValues={{ pin: '' }}
          validationSchema={joinCourseWithPinSchema}
          onSubmit={async (values, { setSubmitting }) => {
            setSubmitting(true)
            const pin = values.pin.replace(/\s/g, '')
            const { data } = await checkValidCoursePin({
              variables: { pin: Number(pin) },
            })

            if (data?.checkValidCoursePin) {
              await router.push(
                `/course/${data.checkValidCoursePin}/join?pin=${pin}`
              )
            } else {
              setError(t('pwa.joinCourse.invalidPin'))
            }
            setSubmitting(false)
          }}
        >
          {({ isSubmitting, isValid }) => {
            return (
              <Form>
                <FormikPinField
                  required
                  name="pin"
                  length={9}
                  label={t('pwa.joinCourse.coursePinFormat')}
                  data={{ cy: 'join-course-pin-field' }}
                  className={{ inputItem: 'w-8', field: 'mb-2' }}
                />

                <Button
                  primary
                  type="submit"
                  disabled={isSubmitting || !isValid}
                  className={{
                    root: 'float-right mt-2',
                  }}
                  data={{ cy: 'join-course-submit-form' }}
                >
                  <Button.Label>{t('pwa.general.joinCourse')}</Button.Label>
                </Button>
              </Form>
            )
          }}
        </Formik>
        {showError && (
          <UserNotification
            message={
              typeof showError === 'string'
                ? showError
                : t('pwa.joinCourse.genericError')
            }
            type="error"
            className={{ root: 'mt-14' }}
          />
        )}
      </div>
    </Layout>
  )
}

export async function getStaticProps({ locale }: GetStaticPropsContext) {
  return {
    props: {
      messages: (await import(`@klicker-uzh/i18n/messages/${locale}`)).default,
    },
  }
}

export default JoinPage
