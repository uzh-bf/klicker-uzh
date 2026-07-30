import { useMutation, useQuery } from '@apollo/client'
import {
  CreateParticipantAccountDocument,
  GetBasicCourseInformationDocument,
  JoinCourseWithPinDocument,
  LearningAnalyticsChoice,
  SelfDocument,
  UserRole,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
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
import * as Yup from 'yup'
import Layout from '../../../components/Layout'
import CreateAccountForm from '../../../components/forms/CreateAccountForm'
import LearningAnalyticsChoiceField from '../../../components/learningAnalytics/LearningAnalyticsChoiceField'
import { learningAnalyticsRolloutEnabled } from '../../../lib/learningAnalytics'

function JoinCourse({
  courseId,
  displayName,
  color,
  courseLoading,
  isLearningAnalyticsEnabled,
}: {
  courseId: string
  displayName: string
  color: string
  courseLoading: boolean
  isLearningAnalyticsEnabled: boolean
}) {
  const t = useTranslations()
  const router = useRouter()
  const [showError, setError] = useState(false)
  const [initialPin, setInitialPin] = useState<string>('')
  const collectLearningAnalyticsChoice =
    learningAnalyticsRolloutEnabled && isLearningAnalyticsEnabled

  const joinCourseWithPinSchema = Yup.object({
    pin: Yup.number()
      .typeError(t('pwa.joinCourse.coursePinNumerical'))
      .test(
        'len',
        t('pwa.joinCourse.coursePinRequired'),
        (val) => val !== undefined && val.toString().length === 9
      )
      .required(t('pwa.joinCourse.coursePinRequired')),
    learningAnalyticsStatus: collectLearningAnalyticsChoice
      ? Yup.mixed<LearningAnalyticsChoice>()
          .oneOf(Object.values(LearningAnalyticsChoice))
          .notRequired()
      : Yup.mixed().notRequired(),
  })

  useEffect(() => {
    const pin = router.query.pin ? String(router.query.pin) : undefined
    setInitialPin(pin || '')
  }, [router.query.pin])

  const { loading: loadingParticipant, data: dataParticipant } =
    useQuery(SelfDocument)

  const [createParticipantAccount] = useMutation(
    CreateParticipantAccountDocument,
    { refetchQueries: [{ query: SelfDocument }] }
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
      <div className="mx-auto max-w-5xl md:mb-4 md:rounded md:border md:p-8 md:pt-6">
        <H2>{t('pwa.joinCourse.title', { name: displayName })}</H2>

        {/* if the participant is logged in, a simplified form will be displayed */}
        {dataParticipant?.self &&
        dataParticipant.self.role === UserRole.Participant ? (
          <div>
            <div className="mb-3">
              {t('pwa.joinCourse.introLoggedIn', { name: displayName })}
            </div>
            <Formik
              enableReinitialize
              validateOnMount
              initialValues={{
                pin: initialPin,
                learningAnalyticsStatus: '',
              }}
              validationSchema={joinCourseWithPinSchema}
              onSubmit={async (values, { setSubmitting }) => {
                setSubmitting(true)
                const participant = await joinCourseWithPin({
                  variables: {
                    pin: Number(values.pin.replace(/\s/g, '')),
                    learningAnalyticsStatus:
                      (values.learningAnalyticsStatus as LearningAnalyticsChoice) ||
                      undefined,
                  },
                })

                if (participant?.data?.joinCourseWithPin) {
                  await router.push(`/course/${courseId}`)
                } else {
                  setError(true)
                  setSubmitting(false)
                }
              }}
            >
              {({
                errors,
                isSubmitting,
                isValid,
                setFieldValue,
                touched,
                values,
              }) => {
                return (
                  <Form>
                    <FormikPinField
                      required
                      name="pin"
                      length={9}
                      label={t('pwa.joinCourse.coursePinFormat')}
                      className={{ inputItem: 'w-8', field: 'mb-2' }}
                    />
                    {collectLearningAnalyticsChoice ? (
                      <div className="my-4">
                        <LearningAnalyticsChoiceField
                          value={
                            values.learningAnalyticsStatus as
                              | LearningAnalyticsChoice
                              | ''
                          }
                          onChange={(choice) =>
                            setFieldValue('learningAnalyticsStatus', choice)
                          }
                          error={
                            touched.learningAnalyticsStatus
                              ? (errors.learningAnalyticsStatus as
                                  | string
                                  | undefined)
                              : undefined
                          }
                          idPrefix="join-learning-analytics"
                        />
                      </div>
                    ) : null}
                    <Button
                      primary
                      type="submit"
                      disabled={isSubmitting || !isValid}
                      className={{
                        root: 'float-right mt-2',
                      }}
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
            <div className="mb-5">
              {t('pwa.joinCourse.introNewUser', { name: displayName })}
            </div>
            <CreateAccountForm
              learningAnalyticsEnabled={collectLearningAnalyticsChoice}
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
                    courseId,
                    learningAnalyticsStatus:
                      values.learningAnalyticsStatus || undefined,
                  },
                })

                await router.push({
                  pathname: '/login',
                  query: {
                    newAccount: true,
                  },
                })
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
        destination: `${ctx.locale ? `/${ctx.locale}` : ''}/404`,
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
        isLearningAnalyticsEnabled:
          data?.basicCourseInformation?.isLearningAnalyticsEnabled ?? false,
        courseLoading: loading,
        messages: (await import(`@klicker-uzh/i18n/messages/${ctx.locale}`))
          .default,
      },
    }
  } catch {
    return {
      redirect: {
        destination: `${ctx.locale ? `/${ctx.locale}` : ''}/404`,
        statusCode: 302,
      },
    }
  }
}

export default JoinCourse
