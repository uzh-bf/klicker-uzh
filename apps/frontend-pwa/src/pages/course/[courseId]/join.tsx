import { useMutation, useQuery } from '@apollo/client'
import {
  CreateParticipantAndJoinCourseDocument,
  GetBasicCourseInformationDocument,
  GetCourseOverviewDataDocument,
  JoinCourseWithPinDocument,
  SelfDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { initializeApollo } from '@lib/apollo'
import {
  Button,
  H2,
  Label,
  ThemeContext,
  UserNotification,
} from '@uzh-bf/design-system'
import { ErrorMessage, Field, Form, Formik } from 'formik'
import { GetServerSideProps } from 'next'
import { useRouter } from 'next/router'
import { useContext, useEffect, useState } from 'react'
import PinField from 'shared-components/src/PinField'
import { twMerge } from 'tailwind-merge'
import * as yup from 'yup'

import Layout from '../../../components/Layout'

const joinAndRegisterSchema = yup.object({
  username: yup
    .string()
    .required('Bitte geben Sie einen Benutzernamen ein')
    .min(5, 'Der Benutzername muss mindestens 5 Zeichen lang sein.')
    .max(10, 'Der Benutzername darf nicht länger als 10 Zeichen sein.'),
  password: yup
    .string()
    .required('Bitte geben Sie ein Passwort ein')
    .min(8, 'Das Passwort muss mindestens 8 Zeichen lang sein.'),
  passwordRepetition: yup.string().when('password', {
    is: (val: string) => val && val.length > 0,
    then: (schema) =>
      schema
        .required('Passwörter müssen übereinstimmen.')
        .min(8, 'Das Passwort muss mindestens 8 Zeichen lang sein.')
        .oneOf(
          [yup.ref('password'), null],
          'Passwörter müssen übereinstimmen.'
        ),
    otherwise: (schema) =>
      schema.oneOf([''], 'Passwörter müssen übereinstimmen.'),
  }),
  pin: yup
    .number()
    .typeError('Bitte geben Sie einen numerischen PIN ein.')
    .required('Bitte geben Sie den Kurs-PIN ein.'),
})

const joinCourseWithPinSchema = yup.object({
  pin: yup
    .number()
    .typeError('Bitte geben Sie einen numerischen PIN ein.')
    .required('Bitte geben Sie den Kurs-PIN ein.'),
})

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
  const router = useRouter()
  const theme = useContext(ThemeContext)
  const [showError, setError] = useState(false)
  const [initialPin, setInitialPin] = useState<string>('')

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
    { refetchQueries: [SelfDocument, GetCourseOverviewDataDocument] }
  )
  const [joinCourseWithPin] = useMutation(JoinCourseWithPinDocument, {
    refetchQueries: [GetCourseOverviewDataDocument],
  })

  if (loadingParticipant || courseLoading) {
    return <div>Loading...</div>
  }

  return (
    <Layout
      displayName="Kurs beitreten"
      courseName={displayName}
      courseColor={color}
    >
      <div className="max-w-sm mx-auto lg:max-w-md md:mb-4 md:p-8 md:pt-6 md:border md:rounded">
        <H2>Kurs &quot;{displayName}&quot; beitreten</H2>
        <div className="mb-5 ">
          Erstellen Sie hier Ihr KlickerUZH Konto für den Kurs {displayName}.
          Sollten Sie bereits über ein Konto verfügen, können sie die
          entsprechenden Anmeldedaten direkt im Formular eingeben.
        </div>
        {/* if the participant is logged in, a simplified form will be displayed */}
        {dataParticipant?.self ? (
          <Formik
            initialValues={{
              pin: initialPin,
            }}
            validationSchema={joinCourseWithPinSchema}
            onSubmit={async (values, { setSubmitting }) => {
              setSubmitting(true)
              const participant = await joinCourseWithPin({
                variables: {
                  courseId,
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
                    className={{ root: 'float-right mt-2 border-uzh-grey-80' }}
                    type="submit"
                    disabled={isSubmitting || !isValid}
                  >
                    <Button.Label>Kurs beitreten</Button.Label>
                  </Button>
                </Form>
              )
            }}
          </Formik>
        ) : (
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
                  <Label label="Nutzername" className={{ root: 'italic' }} />
                  <Field
                    name="username"
                    type="text"
                    className={twMerge(
                      'w-full rounded bg-uzh-grey-20 bg-opacity-50 border border-uzh-grey-60 mb-2',
                      theme.primaryBorderFocus,
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

                  <Label label="Passwort" className={{ root: 'italic' }} />
                  <Field
                    name="password"
                    type="password"
                    className={twMerge(
                      'w-full rounded bg-uzh-grey-20 bg-opacity-50 border border-uzh-grey-60 mb-2',
                      theme.primaryBorderFocus,
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
                    label="Passwort (Wiederholung)"
                    className={{ root: 'italic' }}
                  />
                  <Field
                    name="passwordRepetition"
                    type="password"
                    className={twMerge(
                      'w-full rounded bg-uzh-grey-20 bg-opacity-50 border border-uzh-grey-60 mb-2',
                      theme.primaryBorderFocus,
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
                    error={errors.pin}
                    touched={touched.pin}
                    value={values.pin}
                    setFieldValue={setFieldValue}
                  />

                  <Button
                    className={{ root: 'float-right mt-2 border-uzh-grey-80' }}
                    type="submit"
                    disabled={isSubmitting || !isValid}
                  >
                    <Button.Label>Kurs beitreten</Button.Label>
                  </Button>
                </Form>
              )
            }}
          </Formik>
        )}
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

export const getServerSideProps: GetServerSideProps = async (ctx) => {
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
      },
    }
  } catch {
    return { redirect: { destination: '/404', statusCode: 302 } }
  }
}

export default JoinCourse
