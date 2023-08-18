import { useMutation, useQuery } from '@apollo/client'
import {
  CreateParticipantAndJoinCourseDocument,
  GetBasicCourseInformationDocument,
  JoinCourseWithPinDocument,
  SelfDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { initializeApollo } from '@lib/apollo'
import {
  Button,
  H2,
  Label,
  PinField,
  UserNotification,
} from '@uzh-bf/design-system'
import { ErrorMessage, Field, Form, Formik } from 'formik'
import { GetServerSidePropsContext } from 'next'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import * as yup from 'yup'

import Loader from '@klicker-uzh/shared-components/src/Loader'
import Layout from '../../../components/Layout'

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

  const joinAndRegisterSchema = yup.object({
    username: yup
      .string()
      .required(t('pwa.profile.usernameRequired'))
      .min(5, t('pwa.profile.usernameMinLength', { length: '5' }))
      .max(10, t('pwa.profile.usernameMaxLength', { length: '10' })),
    password: yup
      .string()
      .required(t('pwa.profile.passwordRequired'))
      .min(8, t('pwa.profile.passwordMinLength', { length: '8' })),
    passwordRepetition: yup.string().when('password', {
      is: (val: string) => val && val.length > 0,
      then: (schema) =>
        schema
          .required(t('pwa.profile.identicalPasswords'))
          .min(8, t('pwa.profile.passwordMinLength', { length: '8' }))
          .oneOf(
            [yup.ref('password'), null],
            t('pwa.profile.identicalPasswords')
          ),
      otherwise: (schema) =>
        schema.oneOf([''], t('pwa.profile.identicalPasswords')),
    }),
    pin: yup
      .number()
      .typeError(t('pwa.joinCourse.coursePinNumerical'))
      .required(t('pwa.joinCourse.coursePinRequired')),
  })

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

  const [createParticipantAndJoinCourse] = useMutation(
    CreateParticipantAndJoinCourseDocument,
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
      <div className="max-w-sm mx-auto lg:max-w-md md:mb-4 md:p-8 md:pt-6 md:border md:rounded">
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
          </div>
        ) : (
          <div>
            <div className="mb-5 ">
              {t('pwa.joinCourse.introNewUser', { name: displayName })}
            </div>
            <Formik
              initialValues={{
                email: '',
                username: '',
                password: '',
                passwordRepetition: '',
                pin: initialPin,
              }}
              validationSchema={joinAndRegisterSchema}
              onSubmit={async (values, { setSubmitting }) => {
                setSubmitting(true)
                const participant = await createParticipantAndJoinCourse({
                  variables: {
                    courseId: courseId,
                    username: values.username,
                    password: values.password,
                    pin: Number(values.pin.replace(/\s/g, '')),
                  },
                })

                if (participant?.data?.createParticipantAndJoinCourse) {
                  router.push('/')
                } else {
                  setError(true)
                  setSubmitting(false)
                }
              }}
            >
              {({ errors, touched, isSubmitting, isValid }) => {
                return (
                  <Form>
                    <Label
                      label={t('shared.generic.username')}
                      className={{ root: 'italic' }}
                    />
                    <Field
                      name="username"
                      type="text"
                      className={twMerge(
                        'w-full rounded bg-uzh-grey-20 bg-opacity-50 border border-uzh-grey-60 mb-2 focus:border-primary-40',
                        errors.username &&
                          touched.username &&
                          'border-red-400 bg-red-50 mb-0'
                      )}
                      disabled={isSubmitting}
                    />
                    <ErrorMessage
                      name="username"
                      component="div"
                      className="text-sm text-red-400"
                    />

                    <Label
                      label={t('shared.generic.password')}
                      className={{ root: 'italic' }}
                    />
                    <Field
                      name="password"
                      type="password"
                      className={twMerge(
                        'w-full rounded bg-uzh-grey-20 bg-opacity-50 border border-uzh-grey-60 mb-2 focus:border-primary-40',
                        errors.password &&
                          touched.password &&
                          'border-red-400 bg-red-50 mb-0'
                      )}
                      disabled={isSubmitting}
                    />
                    <ErrorMessage
                      name="password"
                      component="div"
                      className="text-sm text-red-400"
                    />

                    <Label
                      label={t('shared.generic.passwordRepetition')}
                      className={{ root: 'italic' }}
                    />
                    <Field
                      name="passwordRepetition"
                      type="password"
                      className={twMerge(
                        'w-full rounded bg-uzh-grey-20 bg-opacity-50 border border-uzh-grey-60 mb-2 focus:border-primary-40',
                        errors.passwordRepetition &&
                          touched.passwordRepetition &&
                          'border-red-400 bg-red-50 mb-0'
                      )}
                      disabled={isSubmitting}
                    />
                    <ErrorMessage
                      name="passwordRepetition"
                      component="div"
                      className="text-sm text-red-400"
                    />

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
        messages: (
          await import(`@klicker-uzh/i18n/messages/${ctx.locale}.json`)
        ).default,
      },
    }
  } catch {
    return { redirect: { destination: '/404', statusCode: 302 } }
  }
}

export default JoinCourse
