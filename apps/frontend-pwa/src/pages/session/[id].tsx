import { faCommentDots } from '@fortawesome/free-regular-svg-icons'
import { faQuestion, faRankingStar } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  ElementType,
  GetFeedbacksDocument,
  GetRunningLiveQuizDocument,
  SelfDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { QUESTION_GROUPS } from '@klicker-uzh/shared-components/src/constants'
import { GetServerSidePropsContext } from 'next'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'

import { useQuery } from '@apollo/client'
import { Markdown } from '@klicker-uzh/markdown'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { addApolloState, initializeApollo } from '@lib/apollo'
import { H3, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import dynamic from 'next/dynamic'
import Layout from '../../components/Layout'
import LiveQuizLeaderboard from '../../components/common/LiveQuizLeaderboard'
import FeedbackArea from '../../components/liveQuiz/FeedbackArea'
import LiveQuizSubscriber from '../../components/liveQuiz/LiveQuizSubscriber'
import QuestionArea from '../../components/liveQuiz/QuestionArea'

const DynamicAccountSelector = dynamic(
  () => import('../../components/liveQuiz/AccountSelector'),
  { ssr: false }
)

function Index({ id }: { id: string }) {
  const t = useTranslations()
  const [activeMobilePage, setActiveMobilePage] = useState('questions')

  const { data, subscribeToMore } = useQuery(GetRunningLiveQuizDocument, {
    variables: { id },
  })
  const { data: selfData } = useQuery(SelfDocument)

  if (!data?.studentLiveQuiz) {
    return (
      <Layout>
        <Loader />
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
    isModerationEnabled,
    isGamificationEnabled,
    namespace,
    status,
    course,
  } = data.studentLiveQuiz

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
    } else if (type === ElementType.Selection) {
      requestOptions = {
        ...requestOptions,
        body: JSON.stringify({
          instanceId: instanceId,
          sessionId: id,
          response: { selection: answer },
        }),
      }
    } else if (type === ElementType.CaseStudy) {
      requestOptions = {
        ...requestOptions,
        body: JSON.stringify({
          instanceId: instanceId,
          sessionId: id,
          response: { assessment: answer },
        }),
      }
    } else if (type === ElementType.Content) {
      requestOptions = {
        ...requestOptions,
        body: JSON.stringify({
          instanceId: instanceId,
          sessionId: id,
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
    >
      <LiveQuizSubscriber id={id} subscribeToMore={subscribeToMore} />
      <DynamicAccountSelector
        isGamificationEnabled={isGamificationEnabled}
        quizId={id}
      />

      <div className="md:mx-auto md:flex md:w-full md:max-w-7xl md:flex-row">
        <div
          className={twMerge(
            'hidden flex-1 border-gray-300 bg-white md:border-r md:pr-5',
            isLiveQAEnabled && 'md:w-1/2',
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
              <div data-cy="live-quiz-description">
                <H3>{displayName}</H3>
                <Markdown content={description} />
                <UserNotification type="info" className={{ root: 'mt-4' }}>
                  {t('pwa.liveQuiz.noActiveQuestion')}
                </UserNotification>
              </div>
            ) : isGamificationEnabled ? (
              <div className={twMerge('min-h-full flex-1 bg-white')}>
                <LiveQuizLeaderboard quizId={id} />
              </div>
            ) : (
              <UserNotification type="info">
                {t('pwa.liveQuiz.noActiveQuestion')}
              </UserNotification>
            )
          ) : (
            <QuestionArea
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
        destination: '/404',
        statusCode: 302,
      },
    }
  }

  const apolloClient = initializeApollo()

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

  return addApolloState(apolloClient, {
    props: {
      id: ctx.params.id,
      messages: (await import(`@klicker-uzh/i18n/messages/${ctx.locale}`))
        .default,
    },
  })
}

export default Index
