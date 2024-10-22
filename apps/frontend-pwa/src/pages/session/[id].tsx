import { faCommentDots } from '@fortawesome/free-regular-svg-icons'
import { faQuestion, faRankingStar } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  ElementType,
  GetFeedbacksDocument,
  GetRunningSessionDocument,
  RunningSessionUpdatedDocument,
  SelfDocument,
  Session,
  SessionBlock,
} from '@klicker-uzh/graphql/dist/ops'
import { QUESTION_GROUPS } from '@klicker-uzh/shared-components/src/constants'
import { GetServerSidePropsContext } from 'next'
import { useEffect, useState } from 'react'
import { twMerge } from 'tailwind-merge'

import { useQuery } from '@apollo/client'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { addApolloState, initializeApollo } from '@lib/apollo'
import { useTranslations } from 'next-intl'
import Layout from '../../components/Layout'
import SessionLeaderboard from '../../components/common/SessionLeaderboard'
import FeedbackArea from '../../components/liveSession/FeedbackArea'
import QuestionArea from '../../components/liveSession/QuestionArea'

interface SubscriberProps {
  id: string
  subscribeToMore: any
}

function Subscriber({ id, subscribeToMore }: SubscriberProps) {
  useEffect(() => {
    subscribeToMore({
      document: RunningSessionUpdatedDocument,
      variables: {
        sessionId: id,
      },
      updateQuery: (
        prev: { session: Session },
        {
          subscriptionData,
        }: {
          subscriptionData: { data: { runningSessionUpdated: SessionBlock } }
        }
      ) => {
        if (!subscriptionData.data) return prev
        return Object.assign({}, prev, {
          session: {
            ...prev.session,
            activeBlock: subscriptionData.data.runningSessionUpdated,
          },
        })
      },
    })
  }, [id, subscribeToMore])

  return <div></div>
}

interface Props {
  id: string
}

function Index({ id }: Props) {
  const [activeMobilePage, setActiveMobilePage] = useState('questions')
  const t = useTranslations()

  const { data, subscribeToMore } = useQuery(GetRunningSessionDocument, {
    variables: { id },
  })

  const { data: selfData } = useQuery(SelfDocument)

  if (!data?.session) {
    return (
      <Layout>
        <Loader />
      </Layout>
    )
  }

  const {
    activeBlock,
    displayName,
    isLiveQAEnabled,
    isConfusionFeedbackEnabled,
    isModerationEnabled,
    isGamificationEnabled,
    namespace,
    status,
    course,
  } = data.session

  const handleNewResponse = async (
    type: ElementType,
    instanceId: number,
    answer: any
  ) => {
    let requestOptions: RequestInit = {
      method: 'POST',
      credentials: 'include',
    }
    if (QUESTION_GROUPS.CHOICES.includes(type)) {
      requestOptions = {
        ...requestOptions,
        body: JSON.stringify({
          instanceId: instanceId,
          sessionId: id,
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
          instanceId: instanceId,
          sessionId: id,
          response: { value: answer },
        }),
      }
    } else {
      return null
    }
    try {
      const response = await fetch(
        process.env.NEXT_PUBLIC_ADD_RESPONSE_URL as string,
        requestOptions
      )
    } catch (e) {
      console.log('error', e)
    }
  }

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
      unseenItems: activeBlock?.instances?.length,
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
    >
      <Subscriber id={id} subscribeToMore={subscribeToMore} />

      <div className="gap-4 md:mx-auto md:flex md:w-full md:max-w-7xl md:flex-row">
        <div
          className={twMerge(
            'hidden flex-1 bg-white md:rounded-lg md:border md:border-solid md:p-8 md:shadow',
            isLiveQAEnabled && 'md:w-1/2',
            activeMobilePage === 'questions' && 'block',
            (activeMobilePage === 'feedbacks' ||
              activeMobilePage === 'leaderboard') &&
              'md:block'
          )}
        >
          {!activeBlock ? (
            isGamificationEnabled ? (
              <div className={twMerge('min-h-full flex-1 bg-white')}>
                <SessionLeaderboard sessionId={id} />
              </div>
            ) : (
              <div>{t('pwa.session.noActiveQuestion')}</div>
            )
          ) : (
            <QuestionArea
              expiresAt={activeBlock.expiresAt}
              questions={
                activeBlock.instances
                  ?.map((question) => {
                    const questionData = question.questionData

                    // filter out question data types that are not supported by live session
                    if (
                      !questionData ||
                      questionData?.__typename === 'FlashcardQuestionData' ||
                      questionData?.__typename === 'ContentQuestionData'
                    ) {
                      return null
                    }

                    if (questionData.__typename === 'FreeTextQuestionData') {
                      return {
                        ...questionData,
                        instanceId: question.id,
                      }
                    } else if (
                      questionData.__typename === 'NumericalQuestionData'
                    ) {
                      return {
                        ...questionData,
                        instanceId: question.id,
                      }
                    } else if (
                      questionData.__typename === 'ChoicesQuestionData'
                    ) {
                      return {
                        ...questionData,
                        instanceId: question.id,
                      }
                    } else {
                      return null
                    }
                  })
                  .filter((q) => q !== null) ?? []
              }
              handleNewResponse={handleNewResponse}
              sessionId={id}
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
            <SessionLeaderboard sessionId={id} />
          </div>
        )}

        <div
          className={twMerge(
            'hidden flex-1 bg-white md:rounded-lg md:border md:border-solid md:p-8 md:shadow',
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
        destination: '/404',
        statusCode: 302,
      },
    }
  }

  const apolloClient = initializeApollo()

  await Promise.all([
    apolloClient.query({
      query: GetRunningSessionDocument,
      variables: {
        id: ctx.query?.id as string,
      },
    }),
    apolloClient.query({
      query: GetFeedbacksDocument,
      variables: {
        sessionId: ctx.query?.id as string,
      },
    }),
  ])

  return addApolloState(apolloClient, {
    props: {
      id: ctx.params.id,
      messages: (await import(`@klicker-uzh/i18n/messages/${ctx.locale}`))
        .default,
    },
  })
}

export default Index
