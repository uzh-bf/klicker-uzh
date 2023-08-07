import { useMutation } from '@apollo/client'
import { JoinCourseWithPinDocument } from '@klicker-uzh/graphql/dist/ops'
import { Button, H2, PinField, UserNotification } from '@uzh-bf/design-system'
import { Form, Formik } from 'formik'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { useState } from 'react'
import * as yup from 'yup'
import Layout from '../components/Layout'

function JoinPage() {
  const t = useTranslations()
  const router = useRouter()
  const [joinCourseWithPin] = useMutation(JoinCourseWithPinDocument)
  const [showError, setError] = useState(false)

  const joinCourseWithPinSchema = yup.object({
    pin: yup
      .number()
      .typeError(t('pwa.joinCourse.coursePinNumerical'))
      .required(t('pwa.joinCourse.coursePinRequired')),
  })

  return (
    <Layout displayName={t('pwa.general.joinCourse')}>
      <div className="max-w-sm mx-auto lg:max-w-md md:mb-4 md:p-8 md:pt-6 md:border md:rounded">
        <H2>{t('pwa.general.joinCourse')}</H2>
        <div className="mb-5 ">{t('pwa.joinCourse.introLoggedInNoCourse')}</div>
        <Formik
          initialValues={{
            pin: '',
          }}
          validationSchema={joinCourseWithPinSchema}
          onSubmit={async (values, { setSubmitting }) => {
            setSubmitting(true)
            const participant = await joinCourseWithPin({
              variables: {
                pin: Number(values.pin.replace(/\s/g, '')),
              },
            })

            if (participant?.data?.joinCourseWithPin) {
              router.push('/')
            } else {
              setError(true)
            }
            setSubmitting(false)
          }}
        >
          {({ isSubmitting, isValid }) => {
            return (
              <Form>
                <PinField
                  name="pin"
                  label={t('pwa.joinCourse.coursePinFormat')}
                />

                <Button
                  className={{
                    root: 'float-right mt-2 border-uzh-grey-80',
                  }}
                  type="submit"
                  disabled={isSubmitting || !isValid}
                >
                  <Button.Label>{t('pwa.general.joinCourse')}</Button.Label>
                </Button>
              </Form>
            )
          }}
        </Formik>
        {showError && (
          <UserNotification
            message="Es gab einen Fehler bei Ihrer Eingabe, bitte überprüfen Sie diese erneut."
            type="error"
            className={{ root: 'mt-14' }}
          />
        )}
      </div>
    </Layout>
  )
}

export function getStaticProps({ locale }: any) {
  return {
    props: {
      messages: {
        ...require(`@klicker-uzh/shared-components/src/intl-messages/${locale}.json`),
      },
    },
  }
}

export default JoinPage
