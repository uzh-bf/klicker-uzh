import { useMutation } from '@apollo/client'
import { faCommentDots } from '@fortawesome/free-regular-svg-icons'
import {
  faArrowsRotate,
  faCheck,
  faExclamationCircle,
  faQuestion,
  faRankingStar,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { SetLiveQuizPinDocument } from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { createTRPCSSRClient, trpc, type RouterOutputs } from '@lib/trpc'
import {
  Button,
  FormikAlphaNumericPinField,
  H1,
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
  UserNotification,
  toast,
} from '@uzh-bf/design-system'
import { Form, Formik } from 'formik'
import { GetServerSidePropsContext } from 'next'
import { useTranslations } from 'next-intl'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import * as Yup from 'yup'
import Layout from '../../components/Layout'
import LiveQuizQuestionColumn from '../../components/liveQuiz/LiveQuizQuestionColumn'
import LiveQuizSidebarColumn from '../../components/liveQuiz/LiveQuizSidebarColumn'
import LiveQuizSubscriber from '../../components/liveQuiz/LiveQuizSubscriber'
import {
  ElementBlockStatus,
  ElementType,
  type StudentLiveQuizData,
} from '../../components/liveQuiz/types'

const DynamicAccountSelector = dynamic(
  () => import('../../components/liveQuiz/AccountSelector'),
  { ssr: false }
)

async function handleNewResponse({
  liveQuizId,
  instanceId,
  type,
  answer,
  correlationKey,
}: {
  liveQuizId: string
  instanceId: number
  type: ElementType
  answer: any
  correlationKey?: string | null
}): // statusCode: 0 = client-side invalid input / general error; otherwise HTTP status codes 200, 208, 400, 401, 404, 500
Promise<{ statusCode: number; responseTimestamp?: number }> {
  let requestOptions: RequestInit = {
    method: 'POST',
    credentials: 'include',
  }

  if (
    type === ElementType.Sc ||
    type === ElementType.Mc ||
    type === ElementType.Kprim
  ) {
    requestOptions = {
      ...requestOptions,
      body: JSON.stringify({
        correlationKey,
        instanceId,
        liveQuizId,
        response: { choices: answer },
      }),
    }
  } else if (type === ElementType.Numerical || type === ElementType.FreeText) {
    requestOptions = {
      ...requestOptions,
      body: JSON.stringify({
        correlationKey,
        instanceId,
        liveQuizId,
        response: { value: answer },
      }),
    }
  } else if (type === ElementType.Selection) {
    requestOptions = {
      ...requestOptions,
      body: JSON.stringify({
        correlationKey,
        instanceId,
        liveQuizId,
        response: { selection: answer },
      }),
    }
  } else if (type === ElementType.CaseStudy) {
    requestOptions = {
      ...requestOptions,
      body: JSON.stringify({
        correlationKey,
        instanceId,
        liveQuizId,
        response: { assessment: answer },
      }),
    }
  } else if (type === ElementType.Content) {
    requestOptions = {
      ...requestOptions,
      body: JSON.stringify({
        correlationKey,
        instanceId,
        liveQuizId,
        response: { viewed: true },
      }),
    }
  } else {
    return { statusCode: 1 }
  }

  try {
    const response = await fetch(
      process.env.NEXT_PUBLIC_ADD_RESPONSE_URL as string,
      requestOptions
    )

    let responseTimestamp: number | undefined
    try {
      const json = await response.json()
      if (json && typeof json.responseTimestamp === 'number') {
        responseTimestamp = json.responseTimestamp
      }
    } catch (_) {
      // ignore JSON parse errors; not all responses may have a body
    }
    return { statusCode: response.status, responseTimestamp }
  } catch (e) {
    console.log('error', e)
    return { statusCode: 1 }
  }
}

function hasLiveQuizError(error: any, message: string) {
  return (
    error?.message === message ||
    error?.graphQLErrors?.some((err: any) => err.message === message)
  )
}

function hasLiveQuizPinError(error: any) {
  return (
    hasLiveQuizError(error, 'LIVE_QUIZ_PIN_MISSING') ||
    hasLiveQuizError(error, 'LIVE_QUIZ_PIN_MISSING_ASSESSMENT') ||
    hasLiveQuizError(error, 'LIVE_QUIZ_PIN_INVALID')
  )
}

function Index({ id }: { id: string }) {
  const t = useTranslations()
  const router = useRouter()
  const [selectedBlock, setSelectedBlock] = useState<number | null>(null)
  const [activeView, setActiveView] = useState<
    'questions' | 'feedbacks' | 'leaderboard'
  >('questions')
  const [rightTab, setRightTab] = useState<'feedbacks' | 'leaderboard'>(
    'feedbacks'
  )
  const [isDesktop, setIsDesktop] = useState<boolean>(false)

  const [setLiveQuizPin] = useMutation(SetLiveQuizPinDocument)
  const {
    data,
    isLoading: loading,
    isFetching,
    error,
    refetch,
  } = trpc.participant.runningLiveQuiz.useQuery(
    { id },
    {
      retry: (failureCount, error) =>
        hasLiveQuizPinError(error) ? false : failureCount < 3,
    }
  )
  const { data: selfData } = trpc.participant.self.useQuery({ liveQuizId: id })

  // if a block is active when the page is loaded or a new block is activated, switch to the corresponding block
  useEffect(() => {
    if (data?.studentLiveQuiz?.activeBlock) {
      const activeBlockIndex = data.studentLiveQuiz.blocks?.findIndex(
        (b) => b.id === data.studentLiveQuiz?.activeBlock?.id
      )

      if (activeBlockIndex !== -1 && typeof activeBlockIndex === 'number') {
        setSelectedBlock(activeBlockIndex)
      }
    } else if (selectedBlock === null || selectedBlock === -1) {
      const lastCompletedBlockIndex =
        data?.studentLiveQuiz?.blocks?.findLastIndex(
          (b) => b.status === ElementBlockStatus.Executed
        )

      if (
        lastCompletedBlockIndex !== -1 &&
        typeof lastCompletedBlockIndex === 'number'
      ) {
        setSelectedBlock(lastCompletedBlockIndex)
      } else {
        setSelectedBlock(-1)
      }
    }
  }, [data])

  // keep right-side tab valid when availability changes, without overriding user choice
  useEffect(() => {
    const feedbackAvailable =
      data?.studentLiveQuiz?.isLiveQAEnabled ||
      data?.studentLiveQuiz?.isConfusionFeedbackEnabled
    const leaderboardAvailable =
      !!selfData?.self && !!data?.studentLiveQuiz?.isGamificationEnabled
    if (
      rightTab === 'feedbacks' &&
      !feedbackAvailable &&
      leaderboardAvailable
    ) {
      setRightTab('leaderboard')
    } else if (
      rightTab === 'leaderboard' &&
      !leaderboardAvailable &&
      feedbackAvailable
    ) {
      setRightTab('feedbacks')
    }
  }, [
    data?.studentLiveQuiz?.isLiveQAEnabled,
    data?.studentLiveQuiz?.isConfusionFeedbackEnabled,
    data?.studentLiveQuiz?.isGamificationEnabled,
    selfData?.self,
    rightTab,
  ])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const mediaQuery = window.matchMedia('(min-width: 768px)')
    const handleChange = (event: MediaQueryListEvent) => {
      setIsDesktop(event.matches)
    }

    setIsDesktop(mediaQuery.matches)

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleChange)
    } else if (typeof mediaQuery.addListener === 'function') {
      mediaQuery.addListener(handleChange)
    }

    return () => {
      if (typeof mediaQuery.removeEventListener === 'function') {
        mediaQuery.removeEventListener('change', handleChange)
      } else if (typeof mediaQuery.removeListener === 'function') {
        mediaQuery.removeListener(handleChange)
      }
    }
  }, [])

  // if the live quiz was loaded correctly, but does not contain any blocks, directly switch to the feedback view
  useEffect(() => {
    if (
      data?.studentLiveQuiz?.id &&
      (!data?.studentLiveQuiz?.blocks ||
        data?.studentLiveQuiz?.blocks.length === 0)
    ) {
      setActiveView('feedbacks')
    }
  }, [data?.studentLiveQuiz])

  // pin error handling
  const isPinMissing =
    hasLiveQuizError(error, 'LIVE_QUIZ_PIN_MISSING') ||
    hasLiveQuizError(error, 'LIVE_QUIZ_PIN_MISSING_ASSESSMENT')
  const isPinInvalid = hasLiveQuizError(error, 'LIVE_QUIZ_PIN_INVALID')
  const handleLiveQuizRetry = async () => {
    try {
      await refetch({ throwOnError: true })
    } catch (error) {
      console.error('Error refreshing live quiz session:', error)
      toast({
        type: 'error',
        message: t('shared.generic.systemError'),
      })
    }
  }

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
                  variables: {
                    liveQuizId: id,
                    pin: values.pin,
                  },
                })

                try {
                  await refetch({ throwOnError: true })
                } catch (error) {
                  console.error(
                    'Error loading live quiz after PIN entry:',
                    error
                  )
                  toast({
                    type: 'error',
                    message: hasLiveQuizPinError(error)
                      ? t('pwa.liveQuiz.invalidPin')
                      : t('shared.generic.systemError'),
                  })
                }
              } catch (error) {
                console.error('Error setting live quiz PIN:', error)
                toast({
                  type: 'error',
                  message: hasLiveQuizPinError(error)
                    ? t('pwa.liveQuiz.invalidPin')
                    : t('shared.generic.systemError'),
                })
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
                  <Button.Icon icon={faCheck} loading={isSubmitting} />
                  <Button.Label>{t('pwa.liveQuiz.submitPin')}</Button.Label>
                </Button>
              </Form>
            )}
          </Formik>
        </div>
      </Layout>
    )
  }

  if (loading) {
    return (
      <Layout>
        <Loader />
      </Layout>
    )
  }

  if (error && !data?.studentLiveQuiz) {
    return (
      <Layout>
        <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
          <UserNotification
            type="error"
            message={t('shared.generic.systemError')}
          />
          <Button
            onClick={() => void handleLiveQuizRetry()}
            className={{ root: 'h-8' }}
            disabled={isFetching}
          >
            <Button.Icon icon={faArrowsRotate} loading={isFetching} />
            <Button.Label>{t('pwa.liveQuiz.refreshPage')}</Button.Label>
          </Button>
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
    blocks,
    displayName,
    description,
    beforeFirstBlock,
    isLiveQAEnabled,
    isConfusionFeedbackEnabled,
    isGamificationEnabled,
    isAssessmentEnabled,
    isPartOfGamifiedCourse,
    course,
  } = data.studentLiveQuiz

  const feedbackAvailable = isLiveQAEnabled || isConfusionFeedbackEnabled
  const leaderboardAvailable = !!selfData?.self && !!isGamificationEnabled
  const hasQuestionPanel = !!(blocks && blocks.length > 0)
  const hasSidebarPanel = feedbackAvailable || leaderboardAvailable
  const questionBlocks = blocks as StudentLiveQuizData['blocks']
  const questionActiveBlock = activeBlock as StudentLiveQuizData['activeBlock']

  const mobileMenuItems: {
    value: string
    label: string
    icon: React.ReactElement
    unseenItems?: number
    showBadge?: boolean
    data?: { cy?: string; test?: string }
  }[] = [
    ...(!blocks || blocks.length === 0
      ? []
      : [
          {
            value: 'questions',
            label: t('shared.generic.questions'),
            icon: <FontAwesomeIcon icon={faQuestion} size="lg" />,
            unseenItems: activeBlock?.elements?.length,
            data: { cy: 'mobile-menu-questions' },
          },
        ]),
    ...(isLiveQAEnabled || isConfusionFeedbackEnabled
      ? [
          {
            value: 'feedbacks',
            label: t('shared.generic.feedbacks'),
            icon: <FontAwesomeIcon icon={faCommentDots} size="lg" />,
            data: { cy: 'mobile-menu-feedbacks' },
          },
        ]
      : []),
    ...(selfData?.self && isGamificationEnabled
      ? [
          {
            value: 'leaderboard',
            label: t('shared.generic.leaderboard'),
            icon: <FontAwesomeIcon icon={faRankingStar} size="lg" />,
            data: { cy: 'mobile-menu-leaderboard' },
          },
        ]
      : []),
  ]

  const renderQuestionColumn = (extraClassName?: string) => {
    if (!hasQuestionPanel) {
      return null
    }

    return (
      <LiveQuizQuestionColumn
        quizId={id}
        blocks={questionBlocks}
        activeBlock={questionActiveBlock}
        beforeFirstBlock={beforeFirstBlock}
        displayName={displayName}
        description={description}
        selectedBlock={selectedBlock}
        onSelectBlock={setSelectedBlock}
        isGamificationEnabled={isGamificationEnabled}
        handleNewResponse={handleNewResponse}
        className={extraClassName}
      />
    )
  }

  const renderSidebarColumn = (
    extraClassName?: string,
    { standalone }: { standalone?: boolean } = {}
  ) => {
    if (!hasSidebarPanel) {
      return null
    }

    return (
      <LiveQuizSidebarColumn
        quizId={id}
        courseId={course?.id}
        activeView={activeView}
        feedbackAvailable={feedbackAvailable}
        leaderboardAvailable={leaderboardAvailable}
        isLiveQAEnabled={isLiveQAEnabled}
        isConfusionFeedbackEnabled={isConfusionFeedbackEnabled}
        isGamificationEnabled={isGamificationEnabled}
        hasParticipant={!!selfData?.self}
        rightTab={rightTab}
        onRightTabChange={setRightTab}
        beforeFirstBlock={beforeFirstBlock}
        isPartOfGamifiedCourse={isPartOfGamifiedCourse}
        isAssessmentEnabled={isAssessmentEnabled}
        isStandalone={standalone}
        className={extraClassName}
      />
    )
  }

  return (
    <Layout
      displayName={displayName}
      course={course ?? { name: 'KlickerUZH' }}
      mobileMenuItems={mobileMenuItems}
      setActiveMobilePage={setActiveView}
      liveQuizId={id}
      className={{ body: 'p-0 px-4 pb-4' }}
    >
      <LiveQuizSubscriber id={id} onChanged={refetch} />
      <DynamicAccountSelector
        isGamificationEnabled={isGamificationEnabled}
        quizId={id}
      />

      <div className="md:mx-auto md:w-full md:max-w-[88rem] md:pt-5">
        {error ? (
          <UserNotification
            type="error"
            message={t('shared.generic.systemError')}
            className={{ root: 'mb-3' }}
          />
        ) : null}
        {isDesktop ? (
          hasQuestionPanel && hasSidebarPanel ? (
            <ResizablePanelGroup
              direction="horizontal"
              autoSaveId={`live-quiz-${id}-panels`}
              className="flex h-full w-full"
            >
              <ResizablePanel
                defaultSize={60}
                minSize={45}
                className="h-full min-w-0 pr-5"
              >
                {renderQuestionColumn()}
              </ResizablePanel>
              <ResizableHandle withHandle />
              <ResizablePanel
                defaultSize={40}
                minSize={25}
                className="h-full min-w-0 pl-5"
              >
                {renderSidebarColumn()}
              </ResizablePanel>
            </ResizablePanelGroup>
          ) : hasQuestionPanel ? (
            renderQuestionColumn()
          ) : hasSidebarPanel ? (
            renderSidebarColumn('md:w-1/2', { standalone: true })
          ) : null
        ) : (
          <>
            {activeView === 'questions' ? renderQuestionColumn() : null}
            {activeView !== 'questions' ? renderSidebarColumn() : null}
          </>
        )}
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

  const authorizationHeader = ctx.req.cookies?.[
    'next-auth.participant-session-token'
  ]
    ? {
        authorization: `Bearer ${
          ctx.req.cookies?.['next-auth.participant-session-token'] ?? ''
        }`,
      }
    : undefined
  const trpcClient = createTRPCSSRClient(ctx, authorizationHeader)
  let liveQuiz: RouterOutputs['participant']['runningLiveQuiz'] | null = null

  try {
    liveQuiz = await trpcClient.participant.runningLiveQuiz.query({
      id: ctx.params.id,
    })
  } catch (e: any) {
    // if the user is requesting an assessment quiz from the PWA domain, redirect them to the assessment domain
    if (
      hasLiveQuizError(e, 'LIVE_QUIZ_PIN_MISSING_ASSESSMENT') &&
      ctx.req.headers.host &&
      !process.env.APP_ORIGIN_ASSESSMENT_PWA!.includes(ctx.req.headers.host)
    ) {
      return {
        redirect: {
          destination: `${
            process.env.APP_ORIGIN_ASSESSMENT_PWA ?? ''
          }${ctx.locale ? `/${ctx.locale}` : ''}/session/${ctx.params?.id as string}`,
          permanent: false,
        },
      }
    }

    // if the user is requesting a standard PWA quiz with PIN protection from the assessment domain, redirect them to the PWA domain
    if (
      hasLiveQuizError(e, 'LIVE_QUIZ_PIN_MISSING') &&
      ctx.req.headers.host &&
      !process.env.APP_ORIGIN_PWA!.includes(ctx.req.headers.host)
    ) {
      return {
        redirect: {
          destination: `${
            process.env.APP_ORIGIN_PWA ?? ''
          }${ctx.locale ? `/${ctx.locale}` : ''}/session/${ctx.params?.id as string}`,
          permanent: false,
        },
      }
    }

    // if the user is requesting access to an assessment live quiz and is not authenticated, redirect to the assessment login
    if (hasLiveQuizError(e, 'UNAUTHORIZED_ASSESSMENT')) {
      return {
        redirect: {
          destination: `${
            process.env.APP_ORIGIN_ASSESSMENT_PWA ?? ''
          }${ctx.locale ? `/${ctx.locale}` : ''}/login?redirect_to=${encodeURIComponent(
            ctx.req.url && ctx.req.url.startsWith('/')
              ? ctx.req.url
              : `/session/${ctx.params?.id as string}`
          )}`,
          permanent: false,
        },
      }
    }

    // if the user does not have a valid participation in the requested live quiz, redirect to the assessment home page with a warning toast
    if (hasLiveQuizError(e, 'MISSING_ASSESSMENT_COURSE_PARTICIPATION')) {
      return {
        redirect: {
          destination: `${
            process.env.APP_ORIGIN_ASSESSMENT_PWA ?? ''
          }${ctx.locale ? `/${ctx.locale}` : ''}/?error=missing_assessment_course_participation`,
          permanent: false,
        },
      }
    }

    // ignore all other errors that might be thrown -> they will be handled in the component
  }

  // if the fetch was successful, redirect based on the assessment boolean
  // -> if student entered valid PIN for an assessment quiz and then visits quiz through PWA domain (or vice-versa)
  if (liveQuiz?.studentLiveQuiz) {
    if (
      liveQuiz.studentLiveQuiz.isAssessmentEnabled &&
      ctx.req.headers.host &&
      !process.env.APP_ORIGIN_ASSESSMENT_PWA!.includes(ctx.req.headers.host)
    ) {
      return {
        redirect: {
          destination: `${
            process.env.APP_ORIGIN_ASSESSMENT_PWA ?? ''
          }${ctx.locale ? `/${ctx.locale}` : ''}/session/${ctx.params?.id as string}`,
          permanent: false,
        },
      }
    }

    if (
      !liveQuiz.studentLiveQuiz.isAssessmentEnabled &&
      ctx.req.headers.host &&
      !process.env.APP_ORIGIN_PWA!.includes(ctx.req.headers.host)
    ) {
      return {
        redirect: {
          destination: `${
            process.env.APP_ORIGIN_PWA ?? ''
          }${ctx.locale ? `/${ctx.locale}` : ''}/session/${ctx.params?.id as string}`,
          permanent: false,
        },
      }
    }
  }

  return {
    props: {
      id: ctx.params.id,
      messages: (await import(`@klicker-uzh/i18n/messages/${ctx.locale}`))
        .default,
    },
  }
}

export default Index
