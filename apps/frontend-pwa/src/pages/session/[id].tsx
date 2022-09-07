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

import { addApolloState } from '@lib/apollo'
import { getSessionData } from '@lib/joinData'
import FeedbackArea from '../../components/liveSession/FeedbackArea'
import MobileMenuBar from '../../components/liveSession/MobileMenuBar'
import QuestionArea from '../../components/liveSession/QuestionArea'

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

function Index({
  activeBlock,
  blocks,
  displayName,
  id,
  isAudienceInteractionActive,
  isFeedbackChannelPublic,
  isGamificationEnabled,
  name,
  namespace,
  status,
}: Session) {
  const router = useRouter()
  const sessionId = router.query.id as string
  const [activeMobilePage, setActiveMobilePage] = useState('questions')

  // TODO: implement response handling for user response to question
  const handleNewResponse = () => {}

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
            (isFeedbackChannelPublic || isAudienceInteractionActive) &&
              'md:w-1/2',
            activeMobilePage === 'questions' && 'block'
          )}
        >
          {activeBlock === -1 ||
          activeBlock === blocks?.length ||
          blocks?.length === 0 ||
          !blocks ? (
            'Keine Frage aktiv.'
          ) : (
            <QuestionArea
              expiresAt={blocks[activeBlock]?.expiresAt}
              questions={
                blocks[activeBlock]?.instances.map((question: any) => {
                  return { ...question.questionData, instanceId: question.id }
                }) || []
              }
              handleNewResponse={handleNewResponse}
              sessionId={sessionId}
              timeLimit={blocks[activeBlock]?.timeLimit as number}
              execution={blocks[activeBlock]?.execution || 0}
            />
          )}
        </div>

        {isGamificationEnabled && (
          <div
            className={twMerge(
              'w-full md:w-1/2 p-4 bg-white md:border-2 md:border-solid md:rounded-lg md:border-uzh-blue-40 hidden md:block min-h-full',
              activeMobilePage === 'leaderboard' && 'block'
            )}
          >
            LEADERBOARD
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
