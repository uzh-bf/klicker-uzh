import { faCommentDots } from '@fortawesome/free-regular-svg-icons'
import { faQuestion, faRankingStar } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { GetRunningSessionDocument } from '@klicker-uzh/graphql/dist/ops'
import { GetServerSideProps } from 'next'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { QUESTION_GROUPS } from '../../constants'

import { useQuery } from '@apollo/client'
import { addApolloState, initializeApollo } from '@lib/apollo'
import { getParticipantToken } from '@lib/token'
import getConfig from 'next/config'
import Leaderboard from '../../components/common/Leaderboard'
import Layout from '../../components/Layout'
import FeedbackArea from '../../components/liveSession/FeedbackArea'
import QuestionArea from '../../components/liveSession/QuestionArea'

const { publicRuntimeConfig } = getConfig()

interface Props {
  id: string
}

function Index({ id }: Props) {
  const [activeMobilePage, setActiveMobilePage] = useState('questions')

  const { data } = useQuery(GetRunningSessionDocument, {
    variables: { id },
  })

  if (!data?.session) return <p>Loading...</p>

  const {
    activeBlock,
    displayName,
    isAudienceInteractionActive,
    isModerationEnabled,
    isGamificationEnabled,
    name,
    namespace,
    status,
    course,
  } = data.session

  const handleNewResponse = async (
    type: string,
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
        publicRuntimeConfig.ADD_RESPONSE_URL,
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
  }[] = [
    {
      value: 'questions',
      label: 'Questions',
      icon: <FontAwesomeIcon icon={faQuestion} size="lg" />,
      unseenItems: activeBlock?.instances?.length,
    },
  ]

  if (isAudienceInteractionActive) {
    mobileMenuItems.push({
      value: 'feedbacks',
      label: 'Feedbacks',
      icon: <FontAwesomeIcon icon={faCommentDots} size="lg" />,
    })
  }
  if (isGamificationEnabled) {
    mobileMenuItems.push({
      value: 'leaderboard',
      label: 'Leaderboard',
      icon: <FontAwesomeIcon icon={faRankingStar} size="lg" />,
    })
  }

  return (
    <Layout
      displayName={displayName}
      courseName={course?.displayName}
      courseColor={course?.color}
      mobileMenuItems={mobileMenuItems}
      setActiveMobilePage={setActiveMobilePage}
      pageNotFound={!id}
    >
      <div className="gap-4 md:flex md:flex-row md:w-full md:max-w-7xl md:m-auto">
        <div
          className={twMerge(
            'md:p-8 md:rounded-lg md:shadow md:border-solid md:border flex-1 bg-white hidden',
            isAudienceInteractionActive && 'md:w-1/2',
            activeMobilePage === 'questions' && 'block'
          )}
        >
          {!activeBlock ? (
            isGamificationEnabled ? (
              <div className={twMerge('w-full bg-white min-h-full')}>
                <Leaderboard sessionId={id} className="hidden md:block" />
                <div className="md:hidden">Keine Frage aktiv.</div>
              </div>
            ) : (
              <div>Keine Frage aktiv.</div>
            )
          ) : (
            <QuestionArea
              expiresAt={activeBlock?.expiresAt}
              questions={
                activeBlock?.instances.map((question: any) => {
                  return {
                    ...question.questionData,
                    instanceId: question.id,
                    attachments: question.attachments,
                  }
                }) || []
              }
              handleNewResponse={handleNewResponse}
              sessionId={id}
              timeLimit={activeBlock?.timeLimit as number}
              execution={activeBlock?.execution || 0}
            />
          )}
        </div>

        {isGamificationEnabled && (
          <div
            className={twMerge(
              'bg-white hidden min-h-full flex-1 md:p-8',
              activeMobilePage === 'leaderboard' && 'block md:hidden'
            )}
          >
            <Leaderboard sessionId={id} />
          </div>
        )}

        {isAudienceInteractionActive && (
          <div
            className={twMerge(
              'md:p-8 flex-1 bg-white md:border-solid md:shadow md:border hidden md:block d:rounded-lg',
              activeMobilePage === 'feedbacks' && 'block'
            )}
          >
            <FeedbackArea isModerationEnabled={isModerationEnabled} />
          </div>
        )}
      </div>
    </Layout>
  )
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  if (typeof ctx.params?.id !== 'string') {
    return {
      redirect: {
        destination: '/404',
        statusCode: 302,
      },
    }
  }

  const apolloClient = initializeApollo()

  const { participantToken, participant } = await getParticipantToken({
    apolloClient,
    ctx,
  })

  await apolloClient.query({
    query: GetRunningSessionDocument,
    variables: {
      id: ctx.query?.id as string,
    },
  })

  return addApolloState(apolloClient, {
    props: {
      id: ctx.params.id,
    },
  })
}

export default Index
