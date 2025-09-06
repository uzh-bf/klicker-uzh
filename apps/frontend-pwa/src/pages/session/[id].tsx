import { useMutation, useQuery } from '@apollo/client'
import { faCommentDots } from '@fortawesome/free-regular-svg-icons'
import {
  faArrowsRotate,
  faExclamationCircle,
  faQuestion,
  faRankingStar,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  ElementType,
  GetFeedbacksDocument,
  GetRunningLiveQuizDocument,
  SelfDocument,
  SetLiveQuizPinDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Markdown } from '@klicker-uzh/markdown'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { QUESTION_GROUPS } from '@klicker-uzh/shared-components/src/constants'
import { addApolloState, initializeApollo } from '@lib/apollo'
import {
  Button,
  FormikAlphaNumericPinField,
  H1,
  H2,
  UserNotification,
  toast,
} from '@uzh-bf/design-system'
import { Form, Formik } from 'formik'
import { GetServerSidePropsContext } from 'next'
import { useTranslations } from 'next-intl'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/router'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import * as Yup from 'yup'
import Layout from '../../components/Layout'
import LiveQuizLeaderboard from '../../components/common/LiveQuizLeaderboard'
import FeedbackArea from '../../components/liveQuiz/FeedbackArea'
import LiveQuizSubscriber from '../../components/liveQuiz/LiveQuizSubscriber'
import QuestionArea from '../../components/liveQuiz/QuestionArea'

const DynamicAccountSelector = dynamic(
  () => import('../../components/liveQuiz/AccountSelector'),
  { ssr: false }
)

async function handleNewResponse(
  sessionId: string,
  instanceId: number,
  type: ElementType,
  answer: any
) {
  let requestOptions: RequestInit = {
    method: 'POST',
    credentials: 'include',
  }
  if (QUESTION_GROUPS.CHOICES.includes(type)) {
    requestOptions = {
      ...requestOptions,
      body: JSON.stringify({
        instanceId,
        sessionId,
        response: { choices: answer },
      }),
    }
  } else if (
    QUESTION_GROUPS.NUMERICAL.includes(type) ||
    QUESTION_GROUPS.FREE_TEXT.includes(type)
  ) {
    requestOptions = {
      ...requestOptions,
      body: JSON.stringify({
        instanceId,
        sessionId,
        response: { value: answer },
      }),
    }
  } else if (type === ElementType.Selection) {
    requestOptions = {
      ...requestOptions,
      body: JSON.stringify({
        instanceId,
        sessionId,
        response: { selection: answer },
      }),
    }
  } else if (type === ElementType.CaseStudy) {
    requestOptions = {
      ...requestOptions,
      body: JSON.stringify({
        instanceId,
        sessionId,
        response: { assessment: answer },
      }),
    }
  } else if (type === ElementType.Content) {
    requestOptions = {
      ...requestOptions,
      body: JSON.stringify({
        instanceId,
        sessionId,
        response: { read: true },
      }),
    }
  } else {
    return null
  }

  try {
    // Always send to primary endpoint (Azure Function)
    await fetch(
      process.env.NEXT_PUBLIC_ADD_RESPONSE_URL as string,
      requestOptions
    )
  } catch (e) {
    console.error('Error sending response to primary endpoint:', e)
  }

  try {
    const isDualModeEnabled =
      process.env.NEXT_PUBLIC_ENABLE_DUAL_RESPONSE_MODE === 'true'

    console.log('Dual mode enabled:', isDualModeEnabled)

    // Only send to secondary endpoint (Hatchet) if dual mode is enabled
    if (isDualModeEnabled && process.env.NEXT_PUBLIC_ADD_RESPONSE_V2_URL) {
      await fetch(
        process.env.NEXT_PUBLIC_ADD_RESPONSE_V2_URL as string,
        requestOptions
      )
    }
  } catch (e) {
    console.log('Error sending response to secondary endpoint:', e)
  }
}

function Index({ id }: { id: string }) {
  const t = useTranslations()
  const router = useRouter()
  const [activeMobilePage, setActiveMobilePage] = useState('questions')

  const [setLiveQuizPin] = useMutation(SetLiveQuizPinDocument)
  const { data, loading, error, subscribeToMore, refetch } = useQuery(
    GetRunningLiveQuizDocument,
    { variables: { id } }
  )
  const { data: selfData } = useQuery(SelfDocument, {
    variables: { liveQuizId: id },
  })

  if (loading) {
    return (
      <Layout>
        <Loader />
      </Layout>
    )
  }

  // pin error handling
  const isPinMissing =
    error?.graphQLErrors?.some((e) => e.message === 'LIVE_QUIZ_PIN_MISSING') ||
    error?.message === 'LIVE_QUIZ_PIN_MISSING'
  const isPinInvalid =
    error?.graphQLErrors?.some((e) => e.message === 'LIVE_QUIZ_PIN_INVALID') ||
    error?.message === 'LIVE_QUIZ_PIN_INVALID'

  if (isPinMissing || isPinInvalid) {
    return (
      <Layout>
        <div className="mx-auto flex h-full w-full max-w-md flex-col items-center justify-center gap-4 py-8 text-center">
          <H1>{t('pwa.liveQuiz.enterPinTitle')}</H1>
          <p className="text-gray-600">{t('pwa.liveQuiz.pinRequired')}</p>
          <Formik
            enableReinitialize
            validateOnMount
            initialValues={{
              pin:
                typeof router.query.pin === 'string'
                  ? (router.query.pin as string)
                  : '',
            }}
            validationSchema={Yup.object({
              pin: Yup.string()
                .length(6, t('pwa.liveQuiz.pinRequired'))
                .required(t('pwa.liveQuiz.pinRequired')),
            })}
            onSubmit={async (values, { setSubmitting }) => {
              try {
                await setLiveQuizPin({
                  variables: { liveQuizId: id, pin: values.pin },
                })
                await refetch()
              } catch (e: any) {
                // show toast on invalid pin
                const msg = t('pwa.liveQuiz.invalidPin')
                toast({ type: 'error', message: msg })
              } finally {
                setSubmitting(false)
              }
            }}
          >
            {({ handleSubmit, isSubmitting, isValid }) => (
              <Form
                onSubmit={handleSubmit}
                className="flex w-max flex-col items-end gap-4"
              >
                <FormikAlphaNumericPinField
                  name="pin"
                  uppercaseOnly
                  label={t('pwa.liveQuiz.enterPinLabel')}
                  length={6}
                  data={{ cy: 'live-quiz-pin-input' }}
                />
                <Button
                  primary
                  type="submit"
                  disabled={isSubmitting || !isValid}
                  className={{ root: 'w-full' }}
                  data={{ cy: 'live-quiz-submit-pin' }}
                >
                  <Button.Label>{t('pwa.liveQuiz.submitPin')}</Button.Label>
                </Button>
              </Form>
            )}
          </Formik>
        </div>
      </Layout>
    )
  }

  if (!data?.studentLiveQuiz) {
    return (
      <Layout>
        <div className="flex h-full flex-col items-center justify-center text-center">
          <div className="flex flex-row items-center gap-4 text-red-600">
            <FontAwesomeIcon icon={faExclamationCircle} size="3x" />
            <H1 className={{ root: 'mb-0' }}>
              {t('pwa.liveQuiz.noQuizTitle')}
            </H1>
          </div>
          <p className="my-4 max-w-96 text-gray-600">
            {t('pwa.liveQuiz.noQuizDescription')}
          </p>
          <Button onClick={() => router.reload()} className={{ root: 'h-8' }}>
            <Button.Icon icon={faArrowsRotate} />
            <Button.Label>{t('pwa.liveQuiz.refreshPage')}</Button.Label>
          </Button>
        </div>
      </Layout>
    )
  }

  const {
    activeBlock,
    displayName,
    description,
    beforeFirstBlock,
    isLiveQAEnabled,
    isConfusionFeedbackEnabled,
    isGamificationEnabled,
    isPartOfGamifiedCourse,
    course,
  } = data.studentLiveQuiz

  const mobileMenuItems: {
    value: string
    label: string
    icon: React.ReactElement
    unseenItems?: number
    showBadge?: boolean
    data?: { cy?: string; test?: string }
  }[] = [
    {
      value: 'questions',
      label: t('shared.generic.questions'),
      icon: <FontAwesomeIcon icon={faQuestion} size="lg" />,
      unseenItems: activeBlock?.elements?.length,
      data: { cy: 'mobile-menu-questions' },
    },
  ]

  if (isLiveQAEnabled || isConfusionFeedbackEnabled) {
    mobileMenuItems.push({
      value: 'feedbacks',
      label: t('shared.generic.feedbacks'),
      icon: <FontAwesomeIcon icon={faCommentDots} size="lg" />,
      data: { cy: 'mobile-menu-feedbacks' },
    })
  }
  if (selfData?.self && isGamificationEnabled) {
    mobileMenuItems.push({
      value: 'leaderboard',
      label: t('shared.generic.leaderboard'),
      icon: <FontAwesomeIcon icon={faRankingStar} size="lg" />,
      data: { cy: 'mobile-menu-leaderboard' },
    })
  }

  return (
    <Layout
      displayName={displayName}
      course={course ?? { name: 'KlickerUZH' }}
      mobileMenuItems={mobileMenuItems}
      setActiveMobilePage={setActiveMobilePage}
      liveQuizId={id}
      className={{ body: 'p-0 px-4 pb-4' }}
    >
      <LiveQuizSubscriber id={id} subscribeToMore={subscribeToMore} />
      <DynamicAccountSelector
        isGamificationEnabled={isGamificationEnabled}
        quizId={id}
      />

      <div className="md:mx-auto md:flex md:w-full md:max-w-7xl md:flex-row md:pt-3">
        <div
          className={twMerge(
            'hidden flex-1 border-gray-300 bg-white md:pr-5',
            (isLiveQAEnabled || isConfusionFeedbackEnabled) &&
              'md:w-1/2 md:border-r',
            activeMobilePage === 'questions' && 'block',
            (activeMobilePage === 'feedbacks' ||
              activeMobilePage === 'leaderboard') &&
              'md:block'
          )}
        >
          {!activeBlock ? (
            beforeFirstBlock &&
            description !== null &&
            typeof description !== 'undefined' &&
            description !== '' ? (
              <div data-cy="live-quiz-description" className="pt-4 md:pt-2">
                <H2>{displayName}</H2>
                {!description?.match(/^(<br>(\n)*)$/g) && description !== '' ? (
                  <Markdown content={description} />
                ) : (
                  <UserNotification
                    type="info"
                    className={{ root: 'mt-1.5 md:text-base' }}
                  >
                    {t.rich('pwa.liveQuiz.noActiveQuestion', {
                      reload: (text) => (
                        <span
                          className="cursor-pointer underline"
                          onClick={() => router.reload()}
                          data-cy="reload-live-quiz"
                        >
                          {text}
                        </span>
                      ),
                    })}
                  </UserNotification>
                )}
              </div>
            ) : isGamificationEnabled ? (
              <div className={twMerge('min-h-full flex-1 bg-white')}>
                <LiveQuizLeaderboard
                  quizId={id}
                  courseId={course?.id}
                  isBeforeFirstBlock={beforeFirstBlock ?? false}
                  showLeaderboardGamifiedQuizHint
                  isPartOfGamifiedCourse={isPartOfGamifiedCourse}
                />
              </div>
            ) : (
              <UserNotification type="info" className={{ root: 'mt-4' }}>
                {t.rich('pwa.liveQuiz.noActiveQuestion', {
                  reload: (text) => (
                    <span
                      className="cursor-pointer underline"
                      onClick={() => router.reload()}
                      data-cy="reload-live-quiz"
                    >
                      {text}
                    </span>
                  ),
                })}
              </UserNotification>
            )
          ) : (
            <QuestionArea
              gamificationEnabled={isGamificationEnabled}
              expiresAt={activeBlock.expiresAt}
              instances={activeBlock.elements ?? []}
              handleNewResponse={handleNewResponse}
              quizId={id}
              timeLimit={activeBlock?.timeLimit ?? undefined}
              execution={activeBlock?.execution ?? 0}
            />
          )}
        </div>

        {selfData?.self && isGamificationEnabled && (
          <div
            className={twMerge(
              'hidden min-h-full flex-1 bg-white md:p-8',
              activeMobilePage === 'leaderboard' && 'block md:hidden'
            )}
          >
            <LiveQuizLeaderboard quizId={id} />
          </div>
        )}

        <div
          className={twMerge(
            'hidden flex-1 bg-white md:pl-5',
            (isLiveQAEnabled || isConfusionFeedbackEnabled) && 'md:block',
            activeMobilePage === 'feedbacks' &&
              (isLiveQAEnabled || isConfusionFeedbackEnabled) &&
              'block'
          )}
        >
          <FeedbackArea
            isConfusionFeedbackEnabled={isConfusionFeedbackEnabled}
            isLiveQAEnabled={isLiveQAEnabled}
          />
        </div>
      </div>
    </Layout>
  )
}

export async function getServerSideProps(ctx: GetServerSidePropsContext) {
  if (typeof ctx.params?.id !== 'string') {
    return {
      redirect: {
        destination: `${ctx.locale ? `/${ctx.locale}` : ''}/404`,
        statusCode: 302,
      },
    }
  }

  const apolloClient = initializeApollo()

  try {
    await Promise.all([
      apolloClient.query({
        query: GetRunningLiveQuizDocument,
        variables: {
          id: ctx.query?.id as string,
        },
      }),
      apolloClient.query({
        query: GetFeedbacksDocument,
        variables: {
          quizId: ctx.query?.id as string,
          skip: !ctx.query?.id,
        },
      }),
    ])
  } catch (e) {
    // Intentionally ignore GraphQL errors here (e.g., pin missing/invalid)
  }

  return addApolloState(apolloClient, {
    props: {
      id: ctx.params.id,
      messages: (await import(`@klicker-uzh/i18n/messages/${ctx.locale}`))
        .default,
    },
  })
}

export default Index
