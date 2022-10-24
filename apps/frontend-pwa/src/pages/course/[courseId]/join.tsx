import { useMutation, useQuery } from '@apollo/client'
import {
  CreateParticipantAndJoinCourseDocument,
  GetBasicCourseInformationDocument,
  SelfDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { initializeApollo } from '@lib/apollo'
import { Button, H2, Label } from '@uzh-bf/design-system'
import { ErrorMessage, Field, Form, Formik } from 'formik'
import { GetServerSideProps } from 'next'
import { useRouter } from 'next/router'
import { twMerge } from 'tailwind-merge'
import * as yup from 'yup'

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
  const { loading: loadingParticipant, data: dataParticipant } =
    useQuery(SelfDocument)

  const [createParticipantAndJoinCourse] = useMutation(
    CreateParticipantAndJoinCourseDocument
  )

  const router = useRouter()

  // TODO: detect if the user is logged in already and if so, reuse the join course query to join the course or create new join course query

  if (loadingParticipant || courseLoading) {
    return <div>Loading...</div>
  }

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

  return (
    <Layout
      displayName="Kurs beitreten"
      courseName={displayName}
      courseColor={color}
    >
      <H2>Kurs &quot;{displayName}&quot; beitreten</H2>
      <div>{description}</div>
      {dataParticipant?.self ? (
        <div>Join Course with existing account</div>
      ) : (
        <div>
          <Formik
            initialValues={{
              email: '',
              username: '',
              password: '',
              passwordRepetition: '',
              pin: '',
            }}
            validationSchema={joinAndRegisterSchema}
            onSubmit={async (values, { setSubmitting }) => {
              setSubmitting(true)
              const participant = await createParticipantAndJoinCourse({
                variables: {
                  courseId: courseId,
                  username: values.username,
                  password: values.password,
                  pin: Number(values.pin),
                },
              })

              if (participant) {
                router.push('/')
              } else {
                console.warn('Error while joining course')
              }
              setSubmitting(false)
            }}
          >
            {({ errors, touched, isSubmitting }) => {
              return (
                <div className="mb-10">
                  <Form className="w-72 sm:w-96">
                    <Label label="Nutzername" className={'italic'} />
                    <Field
                      name="username"
                      type="text"
                      className={twMerge(
                        'w-full rounded bg-uzh-grey-20 bg-opacity-50 border border-uzh-grey-60 focus:border-uzh-blue-50 mb-2',
                        errors.username &&
                          touched.username &&
                          'border-red-400 bg-red-50 mb-0'
                      )}
                    />
                    <ErrorMessage
                      name="username"
                      component="div"
                      className="text-sm text-red-400"
                    />

                    <Label label="Passwort" className={'italic'} />
                    <Field
                      name="password"
                      type="password"
                      className={twMerge(
                        'w-full rounded bg-uzh-grey-20 bg-opacity-50 border border-uzh-grey-60 focus:border-uzh-blue-50 mb-2',
                        errors.password &&
                          touched.password &&
                          'border-red-400 bg-red-50 mb-0'
                      )}
                    />
                    <ErrorMessage
                      name="password"
                      component="div"
                      className="text-sm text-red-400"
                    />

                    <Label
                      label="Passwort (Wiederholung)"
                      className={'italic'}
                    />
                    <Field
                      name="passwordRepetition"
                      type="password"
                      className={twMerge(
                        'w-full rounded bg-uzh-grey-20 bg-opacity-50 border border-uzh-grey-60 focus:border-uzh-blue-50 mb-2',
                        errors.passwordRepetition &&
                          touched.passwordRepetition &&
                          'border-red-400 bg-red-50 mb-0'
                      )}
                    />
                    <ErrorMessage
                      name="passwordRepetition"
                      component="div"
                      className="text-sm text-red-400"
                    />

                    <Label label="Kurs-PIN" className={'italic'} />
                    <Field
                      name="pin"
                      type="text"
                      className={twMerge(
                        'w-full rounded bg-uzh-grey-20 bg-opacity-50 border border-uzh-grey-60 focus:border-uzh-blue-50 mb-2',
                        errors.pin &&
                          touched.pin &&
                          'border-red-400 bg-red-50 mb-0'
                      )}
                    />
                    <ErrorMessage
                      name="pin"
                      component="div"
                      className="text-sm text-red-400"
                    />

                    <Button
                      className="float-right mt-2 border-uzh-grey-80"
                      type="submit"
                      disabled={isSubmitting}
                    >
                      <Button.Label>Kurs beitreten</Button.Label>
                    </Button>
                  </Form>
                </div>
              )
            }}
          </Formik>
        </div>
      )}
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

// ! TEST CASES
// 1. Course does not exist - ALL OK
// 2. Course exists, user is not logged in - ALL OK
// 3. Course exists, user is not logged in but has an account - ALL OK
// 4. Course exists, user is not logged in but has an account and is a participant already - ALL OK
// 5. Course exists, user is logged in - // TODO
// 6. Course exists, user is logged in and already joined the course - // TODO
