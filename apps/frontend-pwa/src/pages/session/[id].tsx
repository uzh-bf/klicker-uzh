import { faCommentDots } from '@fortawesome/free-regular-svg-icons'
import { faQuestion, faRankingStar } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Session } from '@klicker-uzh/graphql/dist/ops'
import { GetServerSideProps } from 'next'
import { useRouter } from 'next/router'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { QUESTION_GROUPS } from '../../constants'

import { addApolloState } from '@lib/apollo'
import { getRunningSessionData } from '@lib/joinData'
import getConfig from 'next/config'
import Leaderboard from '../../components/common/Leaderboard'
import Layout from '../../components/Layout'
import FeedbackArea from '../../components/liveSession/FeedbackArea'
import QuestionArea from '../../components/liveSession/QuestionArea'

const { publicRuntimeConfig } = getConfig()

function Index({
  activeBlock,
  displayName,
  id,
  isAudienceInteractionActive,
  isModerationEnabled,
  isGamificationEnabled,
  name,
  namespace,
  status,
  course,
}: Session) {
  const router = useRouter()
  const sessionId = router.query.id as string
  const [activeMobilePage, setActiveMobilePage] = useState('questions')

  console.log(course)

  const handleNewResponse = async (
    type: string,
    instanceId: number,
    answer: any
  ) => {
    let requestOptions = {}
    if (QUESTION_GROUPS.CHOICES.includes(type)) {
      requestOptions = {
        method: 'POST',
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
        method: 'POST',
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
        publicRuntimeConfig.ADDRESPONSE_URL,
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
      mobileMenuItems={mobileMenuItems}
      setActiveMobilePage={setActiveMobilePage}
      pageNotFound={!id}
    >
      <div className="gap-4 md:flex md:flex-row md:w-full md:max-w-7xl md:m-auto">
        <div
          className={twMerge(
            'md:p-4 md:rounded-lg md:shadow md:border-solid md:border flex-1 bg-white hidden md:overflow-scroll',
            isAudienceInteractionActive && 'md:w-1/2',
            activeMobilePage === 'questions' && 'block'
          )}
        >
          {!activeBlock ? (
            isGamificationEnabled ? (
              <div className={twMerge('w-full bg-white min-h-full')}>
                <Leaderboard
                  sessionId={sessionId}
                  className="hidden md:block"
                />
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
              sessionId={sessionId}
              timeLimit={activeBlock?.timeLimit as number}
              execution={activeBlock?.execution || 0}
            />
          )}
        </div>

        {isGamificationEnabled && (
          <div
            className={twMerge(
              'bg-white hidden min-h-full flex-1 md:p-4',
              activeMobilePage === 'leaderboard' && 'block md:hidden'
            )}
          >
            <Leaderboard sessionId={sessionId} />
          </div>
        )}

        {isAudienceInteractionActive && (
          <div
            className={twMerge(
              'md:p-4 flex-1 bg-white md:border-solid md:shadow md:border hidden md:block md:overflow-scroll md:rounded-lg',
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
  const withNewSessionData = await getRunningSessionData(ctx)

  return addApolloState(withNewSessionData.apolloClient, {
    props: {
      ...withNewSessionData.result,
    },
  })
}

export default Index
