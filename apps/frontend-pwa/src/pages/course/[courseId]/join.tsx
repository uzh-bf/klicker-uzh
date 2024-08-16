import { useMutation, useQuery } from '@apollo/client'
import {
  CreateParticipantAccountDocument,
  // CreateParticipantAndJoinCourseDocument,
  GetBasicCourseInformationDocument,
  JoinCourseWithPinDocument,
  SelfDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { initializeApollo } from '@lib/apollo'
import {
  Button,
  FormikPinField,
  H2,
  UserNotification,
} from '@uzh-bf/design-system'
import { Form, Formik } from 'formik'
import generatePassword from 'generate-password'
import { GetServerSidePropsContext } from 'next'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import * as yup from 'yup'

import Loader from '@klicker-uzh/shared-components/src/Loader'
import Layout from '../../../components/Layout'
import CreateAccountForm from '../../../components/forms/CreateAccountForm'

function JoinCourse({
  courseId,
  displayName,
  color,
  description,
  courseLoading,
}: {
  courseId: string
  displayName: string
  color: string
  description: string
  courseLoading: boolean
}) {
  const t = useTranslations()
  const router = useRouter()
  const [showError, setError] = useState(false)
  const [initialPin, setInitialPin] = useState<string>('')

  const joinCourseWithPinSchema = yup.object({
    pin: yup
      .number()
      .typeError(t('pwa.joinCourse.coursePinNumerical'))
      .required(t('pwa.joinCourse.coursePinRequired')),
  })

  useEffect(() => {
    const pin = router.query.pin
      ? String(router.query.pin)
          .match(/.{1,3}/g)
          ?.join(' ')
      : undefined
    setInitialPin(pin || '')
  }, [router.query.pin])

  const { loading: loadingParticipant, data: dataParticipant } =
    useQuery(SelfDocument)

  const [createParticipantAccount] = useMutation(
    CreateParticipantAccountDocument,
    { refetchQueries: [SelfDocument] }
  )
  const [joinCourseWithPin] = useMutation(JoinCourseWithPinDocument)

  if (loadingParticipant || courseLoading) {
    return (
      <Layout
        displayName={t('pwa.general.joinCourse')}
        course={{ displayName: displayName, color: color, id: courseId }}
      >
        <Loader />
      </Layout>
    )
  }

  return (
    <Layout
      displayName={t('pwa.general.joinCourse')}
      course={{ displayName: displayName, color: color, id: courseId }}
    >
      <div className="max-w-5xl mx-auto md:mb-4 md:p-8 md:pt-6 md:border md:rounded">
        <H2>{t('pwa.joinCourse.title', { name: displayName })}</H2>

        {/* if the participant is logged in, a simplified form will be displayed */}
        {dataParticipant?.self ? (
          <div>
            <div className="mb-5 ">
              {t('pwa.joinCourse.introLoggedIn', { name: displayName })}
            </div>
            <Formik
              initialValues={{
                pin: initialPin,
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
                  setSubmitting(false)
                }
              }}
            >
              {({ isSubmitting, isValid }) => {
                return (
                  <Form>
                    <FormikPinField
                      name="pin"
                      label={t('pwa.joinCourse.coursePinFormat')}
                    />
                    <Button
                      className={{
                        root: 'float-right mt-2 border-uzh-grey-80',
                      }}
                      type="submit"
                      disabled={isSubmitting || !isValid}
                      data={{ cy: 'join-course' }}
                    >
                      <Button.Label>{t('pwa.general.joinCourse')}</Button.Label>
                    </Button>
                  </Form>
                )
              }}
            </Formik>
          </div>
        ) : (
          <div>
            <div className="mb-5 ">
              {t('pwa.joinCourse.introNewUser', { name: displayName })}
            </div>
            <CreateAccountForm
              initialUsername={generatePassword.generate({
                length: 10,
                uppercase: true,
                symbols: false,
                numbers: true,
              })}
              handleSubmit={async (values) => {
                await createParticipantAccount({
                  variables: {
                    email: values.email.trim().toLowerCase(),
                    username: values.username.trim(),
                    password: values.password.trim(),
                    isProfilePublic: values.isProfilePublic,
                  },
                })

                router.reload()
              }}
            />
          </div>
        )}
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

export async function getServerSideProps(ctx: GetServerSidePropsContext) {
  if (typeof ctx.params?.courseId !== 'string') {
    return {
      redirect: {
        destination: '/404',
        statusCode: 302,
      },
    }
  }

  const apolloClient = initializeApollo()

  try {
    const { data, loading } = await apolloClient.query({
      query: GetBasicCourseInformationDocument,
      variables: {
        courseId: ctx.params.courseId,
      },
    })

    return {
      props: {
        courseId: ctx.params.courseId,
        displayName: data?.basicCourseInformation?.displayName,
        color: data?.basicCourseInformation?.color,
        description: data?.basicCourseInformation?.description,
        courseLoading: loading,
        messages: (await import(`@klicker-uzh/i18n/messages/${ctx.locale}`))
          .default,
      },
    }
  } catch {
    return { redirect: { destination: '/404', statusCode: 302 } }
  }
}

export default JoinCourse
