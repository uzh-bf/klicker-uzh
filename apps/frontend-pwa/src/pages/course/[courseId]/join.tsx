import Loader from '@klicker-uzh/shared-components/src/Loader'
import { createTRPCSSRClient, trpc } from '@lib/trpc'
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

const PARTICIPANT_ROLE = 'PARTICIPANT'

function JoinCourse({
  courseId,
  displayName,
  color,
  courseLoading,
}: {
  courseId: string
  displayName: string
  color: string
  courseLoading: boolean
}) {
  const t = useTranslations()
  const router = useRouter()
  const [showError, setError] = useState<string | false>(false)
  const [initialPin, setInitialPin] = useState<string>('')

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

  useEffect(() => {
    const pin = router.query.pin ? String(router.query.pin) : undefined
    setInitialPin(pin || '')
  }, [router.query.pin])

  const { isLoading: loadingParticipant, data: dataParticipant } =
    trpc.participant.self.useQuery()
  const joinCourseWithPin = trpc.participant.joinCourseWithPin.useMutation()
  const createParticipantAccount = trpc.participant.createAccount.useMutation()
  const utils = trpc.useUtils()

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
        dataParticipant.self.role === PARTICIPANT_ROLE ? (
          <div>
            <div className="mb-3">
              {t('pwa.joinCourse.introLoggedIn', { name: displayName })}
            </div>
            <Formik
              validateOnMount
              initialValues={{
                pin: initialPin,
              }}
              validationSchema={joinCourseWithPinSchema}
              onSubmit={async (values, { setSubmitting }) => {
                setSubmitting(true)
                setError(false)

                try {
                  const participant = await joinCourseWithPin.mutateAsync({
                    pin: Number(values.pin.replace(/\s/g, '')),
                  })

                  if (participant) {
                    await Promise.all([
                      utils.participant.self.invalidate(),
                      utils.participant.participations.invalidate(),
                    ])
                    await router.push('/')
                    return
                  }

                  setError(t('pwa.joinCourse.invalidPin'))
                } catch (error) {
                  console.error(error)
                  setError(t('pwa.joinCourse.genericError'))
                } finally {
                  setSubmitting(false)
                }
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
                      className={{ inputItem: 'w-8', field: 'mb-2' }}
                    />
                    <Button
                      primary
                      type="submit"
                      disabled={isSubmitting || !isValid}
                      loading={isSubmitting}
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
              initialUsername={generatePassword.generate({
                length: 10,
                uppercase: true,
                symbols: false,
                numbers: true,
              })}
              handleSubmit={async (values) => {
                await createParticipantAccount.mutateAsync({
                  email: values.email.trim().toLowerCase(),
                  username: values.username.trim(),
                  password: values.password.trim(),
                  isProfilePublic: values.isProfilePublic,
                  courseId,
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
            message={showError}
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

  const trpcClient = createTRPCSSRClient(ctx)

  try {
    const { basicCourseInformation } =
      await trpcClient.course.basicCourseInformation.query({
        courseId: ctx.params.courseId,
      })

    return {
      props: {
        courseId: ctx.params.courseId,
        displayName: basicCourseInformation?.displayName,
        color: basicCourseInformation?.color,
        description: basicCourseInformation?.description,
        courseLoading: false,
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
