// TODO: remove solution data in a more specialized query than getSession (only the active instances are required)

import { useQuery } from '@apollo/client'
import { faCommentDots } from '@fortawesome/free-regular-svg-icons'
import { faQuestion, faRankingStar } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { SelfDocument, Session } from '@klicker-uzh/graphql/dist/ops'
import { GetServerSideProps } from 'next'
import { useRouter } from 'next/router'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'

import { addApolloState } from '@lib/apollo'
import { getSessionData } from '@lib/joinData'
import Leaderboard from '../../components/common/Leaderboard'
import Layout from '../../components/Layout'
import FeedbackArea from '../../components/liveSession/FeedbackArea'
import QuestionArea from '../../components/liveSession/QuestionArea'

function Index({
  activeBlock,
  displayName,
  id,
  isAudienceInteractionActive,
  isFeedbackChannelPublic,
  isGamificationEnabled,
  name,
  namespace,
  status,
}: Session) {
  const {
    loading: loadingParticipant,
    error: errorParticipant,
    data: dataParticipant,
  } = useQuery(SelfDocument)
  console.log(dataParticipant)

  const router = useRouter()
  const sessionId = router.query.id as string
  const [activeMobilePage, setActiveMobilePage] = useState('questions')

  // TODO: implement response handling for user response to question
  const handleNewResponse = () => {}

  const mobileMenuItems = [
    {
      value: 'questions',
      label: 'Questions',
      icon: <FontAwesomeIcon icon={faQuestion} size="lg" />,
    },
  ]

  if (isFeedbackChannelPublic || isAudienceInteractionActive) {
    mobileMenuItems.push({
      value: 'feedbacks',
      label: 'Feedback',
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
      displayName={`Live Session - ${displayName}`}
      mobileMenuItems={mobileMenuItems}
      setActiveMobilePage={setActiveMobilePage}
      participant={dataParticipant?.self || undefined}
    >
      <div
        className={twMerge(
          'p-4 md:rounded-lg md:border-2 md:border-solid md:border-uzh-blue-40 w-full bg-white hidden md:block min-h-full',
          (isFeedbackChannelPublic || isAudienceInteractionActive) &&
            'md:w-1/2',
          activeMobilePage === 'questions' && 'block'
        )}
      >
        {!activeBlock ? (
          isGamificationEnabled ? (
            <div
              className={twMerge('w-full bg-white hidden md:block min-h-full')}
            >
              <Leaderboard />
            </div>
          ) : (
            'Keine Frage aktiv.'
          )
        ) : (
          <QuestionArea
            expiresAt={activeBlock?.expiresAt}
            questions={
              activeBlock?.instances.map((question: any) => {
                return { ...question.questionData, instanceId: question.id }
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
            'w-full p-4 bg-white hidden min-h-full',
            activeMobilePage === 'leaderboard' && 'block md:hidden'
          )}
        >
          <Leaderboard />
        </div>
      )}

      {(isFeedbackChannelPublic || isAudienceInteractionActive) && (
        <div
          className={twMerge(
            'w-full md:w-1/2 p-4 bg-white md:border-2 md:border-solid md:rounded-lg md:border-uzh-blue-40 hidden md:block min-h-full',
            activeMobilePage === 'feedbacks' && 'block'
          )}
        >
          <FeedbackArea feedbacks={[]} />
        </div>
      )}
    </Layout>
  )
}

// TODO: handle Apollo error that occurs when the session does not exist / is not running
// --> show alternative page with error message but without Apollo error
export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const withNewSessionData = await getSessionData(ctx)

  return addApolloState(withNewSessionData.apolloClient, {
    props: {
      ...withNewSessionData.result,
    },
  })
}

export default Index
