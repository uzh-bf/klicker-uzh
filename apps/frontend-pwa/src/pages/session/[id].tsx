// TODO: remove solution data in a more specialized query than getSession (only the active instances are required)

import { faCommentDots } from '@fortawesome/free-regular-svg-icons'
import { faQuestion, faRankingStar } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Session } from '@klicker-uzh/graphql/dist/ops'
import { GetServerSideProps } from 'next'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
// import { useQuery } from '@apollo/client'

import { addApolloState } from '@lib/apollo'
import FeedbackArea from '../../components/liveSession/FeedbackArea'
import MobileMenuBar from '../../components/liveSession/MobileMenuBar'
import QuestionArea from '../../components/liveSession/QuestionArea'
import { getSessionData } from '@lib/joinData'

function Index({ activeBlock, blocks, displayName, execution, id, isAudienceInteractionActive, isFeedbackChannelPublic, name, namespace, status }: Session) {
  const router = useRouter()
  const sessionId = router.query.id as string
  const [activeMobilePage, setActiveMobilePage] = useState('questions')

  // TODO: remove hardcoded parameters and replace them by their corresponding values from DB
  const isFeedbackChannelActive = true // session.feedbackChannelActive
  const isSessionGamified = true

  // TODO: implement response handling for user response to question
  const handleNewResponse = () => {}

  const mobileMenuItems = [
    {
      value: 'questions',
      label: 'Questions',
      icon: <FontAwesomeIcon icon={faQuestion} size="lg" />,
    },
    {
      value: 'feedbacks',
      label: 'Feedback',
      icon: <FontAwesomeIcon icon={faCommentDots} size="lg" />,
    },
    {
      value: 'leaderboard',
      label: 'Leaderboard',
      icon: <FontAwesomeIcon icon={faRankingStar} size="lg" />,
    },
  ]

  return (
    <div className="md:p-1.5 w-full h-full bg-uzh-grey-60">
      <Head>
        <title>Live Session</title>
        <meta
          name="description"
          content={'Live Session ' + displayName}
          charSet="utf-8"
        ></meta>
      </Head>

      <div className="absolute flex flex-row bottom-16 md:bottom-0 top-0 left-0 right-0 md:p-1.5 overflow-auto gap-1.5 bg-white md:bg-uzh-grey-60 md:overflow-scroll min-h-screen h-max">
        <div
          className={twMerge(
            'p-4 md:rounded-lg md:border-2 md:border-solid md:border-uzh-blue-40 w-full bg-white hidden md:block min-h-full',
            (isFeedbackChannelActive || isAudienceInteractionActive) &&
              'md:w-1/2',
            activeMobilePage === 'questions' && 'block'
          )}
        >
          {/* // TODO replace check through activeInstances.length > 0 */}
          {activeBlock === -1 ||
          activeBlock === blocks?.length ? (
            'Keine Frage aktiv.'
          ) : (
            <QuestionArea
              expiresAt={blocks[activeBlock].expiresAt}
              questions={blocks[activeBlock].instances.map(
                (question: any) => question.questionData
              )}
              handleNewResponse={handleNewResponse}
              sessionId={sessionId}
              timeLimit={blocks[activeBlock].timeLimit as number}
            />
          )}
        </div>

        {isSessionGamified && (
          <div
            className={twMerge(
              'w-full md:w-1/2 p-4 bg-white md:border-2 md:border-solid md:rounded-lg md:border-uzh-blue-40 hidden md:block min-h-full',
              activeMobilePage === 'leaderboard' && 'block'
            )}
          >
            LEADERBOARD
          </div>
        )}

        {(isFeedbackChannelActive || isAudienceInteractionActive) && (
          <div
            className={twMerge(
              'w-full md:w-1/2 p-4 bg-white md:border-2 md:border-solid md:rounded-lg md:border-uzh-blue-40 hidden md:block min-h-full',
              activeMobilePage === 'feedbacks' && 'block'
            )}
          >
            <FeedbackArea feedbacks={[]} />
          </div>
        )}
      </div>

      <div className="absolute bottom-0 w-full h-16 md:hidden">
        <MobileMenuBar
          menuItems={mobileMenuItems}
          onClick={setActiveMobilePage}
        />
      </div>
    </div>
  )
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const withNewSessionData = await getSessionData(ctx)

  return addApolloState(withNewSessionData.apolloClient, {
    props: {
      ...withNewSessionData.result,
    },
  })
}

export default Index
