import { useMutation } from '@apollo/client'
import { JoinCourseWithPinDocument } from '@klicker-uzh/graphql/dist/ops'
import { Button, H2, UserNotification } from '@uzh-bf/design-system'
import { Form, Formik } from 'formik'
import { useRouter } from 'next/router'
import { useState } from 'react'
import PinField from 'shared-components/src/PinField'
import Layout from '../components/Layout'
import { joinCourseWithPinSchema } from './course/[courseId]/join'

function JoinPage() {
  const router = useRouter()
  const [joinCourseWithPin] = useMutation(JoinCourseWithPinDocument)
  const [showError, setError] = useState(false)

  return (
    <Layout displayName="Kurs beitreten">
      <div className="max-w-sm mx-auto lg:max-w-md md:mb-4 md:p-8 md:pt-6 md:border md:rounded">
        <H2>Kurs beitreten</H2>
        <div className="mb-5 ">
          Sie sind bereits eingeloggt und können einem Kurs durch die Eingabe
          des entsprechenden PINs direkt beitreten.
        </div>
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
          {({
            errors,
            touched,
            values,
            isSubmitting,
            isValid,
            setFieldValue,
          }) => {
            return (
              <Form>
                <PinField
                  name="pin"
                  label="Kurs-PIN (Format: ### ### ###)"
                  error={errors.pin}
                  touched={touched.pin}
                  value={values.pin}
                  setFieldValue={setFieldValue}
                />

                <Button
                  className={{
                    root: 'float-right mt-2 border-uzh-grey-80',
                  }}
                  type="submit"
                  disabled={isSubmitting || !isValid}
                >
                  <Button.Label>Kurs beitreten</Button.Label>
                </Button>
              </Form>
            )
          }}
        </Formik>
        {showError && (
          <UserNotification
            message="Es gab einen Fehler bei Ihrer Eingabe, bitte überprüfen Sie diese erneut."
            notificationType="error"
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
        ...require(`shared-components/src/intl-messages/${locale}.json`),
      },
    },
  }
}

export default JoinPage
