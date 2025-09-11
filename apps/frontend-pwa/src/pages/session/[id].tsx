import { useMutation, useQuery } from '@apollo/client'
import { faClock, faCommentDots } from '@fortawesome/free-regular-svg-icons'
import {
  faArrowsRotate,
  faCheck,
  faExclamationCircle,
  faQuestion,
  faRankingStar,
  faUsers,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  ElementBlockStatus,
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
  StepProgress,
  Tabs,
  UserNotification,
  toast,
} from '@uzh-bf/design-system'
import { Form, Formik } from 'formik'
import { GetServerSidePropsContext } from 'next'
import { useTranslations } from 'next-intl'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
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

  // TODO: provide proper correlationId
  const correlationId = '18513af0-f4b8-4098-b93d-9a77e29f08a5'

  if (QUESTION_GROUPS.CHOICES.includes(type)) {
    requestOptions = {
      ...requestOptions,
      body: JSON.stringify({
        correlationId,
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
        correlationId,
        instanceId,
        sessionId,
        response: { value: answer },
      }),
    }
  } else if (type === ElementType.Selection) {
    requestOptions = {
      ...requestOptions,
      body: JSON.stringify({
        correlationId,
        instanceId,
        sessionId,
        response: { selection: answer },
      }),
    }
  } else if (type === ElementType.CaseStudy) {
    requestOptions = {
      ...requestOptions,
      body: JSON.stringify({
        correlationId,
        instanceId,
        sessionId,
        response: { assessment: answer },
      }),
    }
  } else if (type === ElementType.Content) {
    requestOptions = {
      ...requestOptions,
      body: JSON.stringify({
        correlationId,
        instanceId,
        sessionId,
        response: { read: true },
      }),
    }
  } else {
    return null
  }

  try {
    await fetch(
      process.env.NEXT_PUBLIC_ADD_RESPONSE_URL as string,
      requestOptions
    )
  } catch (e) {
    console.log('Error sending response to secondary endpoint:', e)
  }
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

  const [setLiveQuizPin] = useMutation(SetLiveQuizPinDocument)
  const { data, loading, error, subscribeToMore, refetch } = useQuery(
    GetRunningLiveQuizDocument,
    { variables: { id } }
  )
  const { data: selfData } = useQuery(SelfDocument, {
    variables: { liveQuizId: id },
  })

  // if a block is active when the page is loaded or a new block is activated, switch to the corresponding block
  useEffect(() => {
    if (data?.studentLiveQuiz?.activeBlock) {
      const activeBlockIndex = data.studentLiveQuiz.blocks?.findIndex(
        (b) => b.id === data.studentLiveQuiz?.activeBlock?.id
      )

      if (activeBlockIndex !== -1 && typeof activeBlockIndex === 'number') {
        setSelectedBlock(activeBlockIndex)
      }
    } else if (selectedBlock === null) {
      const lastCompletedBlockIndex = data?.studentLiveQuiz?.blocks?.findIndex(
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
    blocks,
    displayName,
    description,
    beforeFirstBlock,
    isLiveQAEnabled,
    isConfusionFeedbackEnabled,
    isGamificationEnabled,
    isPartOfGamifiedCourse,
    course,
  } = data.studentLiveQuiz

  const feedbackAvailable = isLiveQAEnabled || isConfusionFeedbackEnabled
  const leaderboardAvailable = !!selfData?.self && !!isGamificationEnabled

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

  return (
    <Layout
      displayName={displayName}
      course={course ?? { name: 'KlickerUZH' }}
      mobileMenuItems={mobileMenuItems}
      setActiveMobilePage={setActiveView}
      liveQuizId={id}
      className={{ body: 'p-0 px-4 pb-4' }}
    >
      <LiveQuizSubscriber id={id} subscribeToMore={subscribeToMore} />
      <DynamicAccountSelector
        isGamificationEnabled={isGamificationEnabled}
        quizId={id}
      />

      <div className="md:mx-auto md:flex md:w-full md:max-w-7xl md:flex-row md:pt-5">
        {blocks && blocks.length > 0 ? (
          <div
            className={twMerge(
              'hidden flex-1 border-gray-300 bg-white md:pr-5',
              (isLiveQAEnabled ||
                isConfusionFeedbackEnabled ||
                (selfData?.self && isGamificationEnabled)) &&
                'md:w-1/2 md:border-r',
              activeView === 'questions' && 'block',
              'md:block'
            )}
          >
            <div
              className={twMerge(
                activeView === 'questions' ? '' : 'hidden',
                'md:block'
              )}
              key={`question-area-${activeBlock?.id}-${activeBlock?.status}`}
            >
              <>
                {blocks && blocks.length > 0 ? (
                  <StepProgress
                    value={
                      selectedBlock !== null
                        ? selectedBlock
                        : blocks[0]?.status !== ElementBlockStatus.Scheduled
                          ? 0
                          : -1
                    }
                    items={blocks?.map((block, ix) => ({
                      id: block.id,
                      ix,
                      label: t('shared.generic.blockN', { number: ix + 1 }),
                      blockStatus: block.status,
                      disabled: block.status === ElementBlockStatus.Scheduled,
                      className: twMerge(
                        block.id === activeBlock?.id &&
                          'bg-primary-100! hover:bg-primary-100 text-white hover:text-white'
                      ),
                    }))}
                    displayOffsetLeft={1}
                    displayOffsetRight={1}
                    formatter={({ element }) => (
                      <span className="w-full space-x-2">
                        <FontAwesomeIcon
                          icon={
                            element.blockStatus === ElementBlockStatus.Scheduled
                              ? faClock
                              : element.blockStatus ===
                                  ElementBlockStatus.Active
                                ? faUsers
                                : faCheck
                          }
                        />
                        <span>{element.label}</span>
                      </span>
                    )}
                    onItemClick={(_, item) => {
                      if (!item!.disabled) {
                        setSelectedBlock(Number(item!.ix))
                      }
                    }}
                    className={{ root: 'md:mt-0.25 mt-5 text-sm' }}
                  />
                ) : null}

                {beforeFirstBlock ? (
                  <div
                    data-cy="live-quiz-description"
                    className="mt-1.5 pt-4 md:pt-2"
                  >
                    <H2>{displayName}</H2>
                    {description !== null &&
                    typeof description !== 'undefined' &&
                    description !== '' &&
                    !description?.match(/^(<br>(\n)*)$/g) ? (
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
                ) : null}

                {activeBlock &&
                selectedBlock ===
                  blocks?.findIndex((b) => b.id === activeBlock.id) ? (
                  <QuestionArea
                    isBlockActive
                    quizId={id}
                    gamificationEnabled={isGamificationEnabled}
                    expiresAt={activeBlock.expiresAt}
                    instances={activeBlock.elements ?? []}
                    handleNewResponse={handleNewResponse}
                    timeLimit={activeBlock?.timeLimit ?? undefined}
                    execution={activeBlock?.execution ?? 0}
                  />
                ) : null}

                {selectedBlock !== null &&
                (!activeBlock ||
                  selectedBlock !==
                    blocks?.findIndex((b) => b.id === activeBlock.id)) &&
                blocks?.[selectedBlock] ? (
                  <QuestionArea
                    quizId={id}
                    gamificationEnabled={isGamificationEnabled}
                    instances={blocks?.[selectedBlock].elements ?? []}
                    execution={blocks?.[selectedBlock]?.execution ?? 0}
                    handleNewResponse={() => {}} // submissions are no longer possible
                  />
                ) : null}
              </>
            </div>
          </div>
        ) : null}

        <div
          className={twMerge(
            'bg-white md:w-1/2 md:pl-5',
            (!blocks || blocks.length === 0) && 'mx-auto',
            feedbackAvailable || leaderboardAvailable
              ? 'md:block'
              : 'md:hidden',
            (activeView === 'feedbacks' && feedbackAvailable) ||
              (activeView === 'leaderboard' && leaderboardAvailable)
              ? 'block'
              : 'hidden'
          )}
        >
          {/* right-side tabs on desktop (shown only when both features exist) */}
          {(isLiveQAEnabled || isConfusionFeedbackEnabled) &&
            selfData?.self &&
            isGamificationEnabled && (
              <Tabs
                defaultValue={rightTab}
                value={rightTab}
                tabs={
                  [
                    {
                      id: 'tab-feedbacks',
                      value: 'feedbacks',
                      label: t('shared.generic.feedbacks'),
                      data: { cy: 'tab-feedbacks' },
                    },
                    {
                      id: 'tab-leaderboard-right',
                      value: 'leaderboard',
                      label: t('shared.generic.leaderboard'),
                      data: { cy: 'tab-leaderboard-right' },
                    },
                  ] as any
                }
                onValueChange={(value) =>
                  setRightTab(value as 'feedbacks' | 'leaderboard')
                }
                className={{
                  root: 'mb-1.5 hidden md:block',
                  list: 'h-7.5 md:h-7.5 bg-gray-200',
                  trigger: 'h-6',
                }}
              >
                {' '}
              </Tabs>
            )}

          <FeedbackArea
            isConfusionFeedbackEnabled={isConfusionFeedbackEnabled}
            isLiveQAEnabled={isLiveQAEnabled}
            className={twMerge(
              // mobile: show only when on feedbacks view and available
              activeView === 'feedbacks' &&
                (isLiveQAEnabled || isConfusionFeedbackEnabled)
                ? 'block'
                : 'hidden',
              // desktop: show only when feedbacks tab selected and available
              rightTab === 'feedbacks' &&
                (isLiveQAEnabled || isConfusionFeedbackEnabled)
                ? 'md:block'
                : 'md:hidden'
            )}
          />
          <LiveQuizLeaderboard
            quizId={id}
            courseId={course?.id}
            isBeforeFirstBlock={beforeFirstBlock ?? false}
            showLeaderboardGamifiedQuizHint
            isPartOfGamifiedCourse={isPartOfGamifiedCourse}
            className={twMerge(
              // mobile visibility
              activeView === 'leaderboard' &&
                selfData?.self &&
                isGamificationEnabled
                ? 'block'
                : 'hidden',
              // desktop visibility
              rightTab === 'leaderboard' &&
                selfData?.self &&
                isGamificationEnabled
                ? 'md:block'
                : 'md:hidden',
              'min-h-full w-full'
            )}
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
    await apolloClient.query({
      query: GetRunningLiveQuizDocument,
      variables: { id: ctx.query?.id as string },
    })
  } catch (e) {
    // intentionally ignore GraphQL errors here (e.g., pin missing/invalid) -> handled in UI
  }

  await apolloClient.query({
    query: GetFeedbacksDocument,
    variables: {
      quizId: ctx.query?.id as string,
      skip: !ctx.query?.id,
    },
  })

  return addApolloState(apolloClient, {
    props: {
      id: ctx.params.id,
      messages: (await import(`@klicker-uzh/i18n/messages/${ctx.locale}`))
        .default,
    },
  })
}

export default Index
