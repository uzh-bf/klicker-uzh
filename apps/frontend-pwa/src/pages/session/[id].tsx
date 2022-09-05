// TODO: remove solution data in a more specialized query than getSession (only the active instances are required)
// TODO: move layout around questions and feedback to separte component for reusability

import { faQuestion, faRankingStar } from '@fortawesome/free-solid-svg-icons'
import { faCommentDots } from '@fortawesome/free-regular-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { GetSessionDocument } from '@klicker-uzh/graphql/dist/ops'
import { GetServerSideProps } from 'next'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
// import { useQuery } from '@apollo/client'

import { initializeApollo } from '@lib/apollo'
import FeedbackArea from '../../components/liveSession/FeedbackArea'
import MobileMenuBar from '../../components/liveSession/MobileMenuBar'
import QuestionArea from '../../components/liveSession/QuestionArea'

function Index({ session }: any) {
  const router = useRouter()
  const sessionId = router.query.id as string
  const [activeMobilePage, setActiveMobilePage] = useState('questions')

  // TODO: Remove / Keep code snipped to reuse for Feedback fetching
  // const { loading, error, data } = useQuery(GetSessionDocument, {
  //   variables: {
  //     id: router.query.id as string,
  //   },
  // })
  // if (loading || !data) return <p>Loading...</p>
  // if (error) return <p>Oh no... {error.message}</p>
  // console.log(data)

  // TODO: remove hardcoded parameters and replace them by their corresponding values from DB
  // TODO: directly destructure session into its components to simplify notation

  const isFeedbackChannelActive = true // session.feedbackChannelActive
  const isSessionGamified = true

  // TODO: implement response handling for user response to question
  const handleNewResponse = () => {}

  const mobileMenuItems = [
    {
      value: 'questions',
      label: 'Questions',
      icon: (
        <FontAwesomeIcon
          icon={faQuestion}
          className=""
          size='lg'
        />
      ),
    },
    {
      value: 'feedbacks',
      label: 'Feedback',
      icon: (
        <FontAwesomeIcon
          icon={faCommentDots}
          className=""
          size='lg'
        />
      ),
    },
    {
      value: 'leaderboard',
      label: 'Leaderboard',
      icon: (
        <FontAwesomeIcon
          icon={faRankingStar}
          className=""
          size='lg'
        />
      ),
    },
  ]

  return (
    <div className="md:p-1.5 w-full h-full bg-uzh-grey-60">
      <Head>
        <title>Live Session</title>
        <meta
          name="description"
          content={'Live Session ' + session.displayName}
          charSet="utf-8"
        ></meta>
      </Head>

      <div className="absolute flex flex-row bottom-16 md:bottom-0 top-0 left-0 right-0 md:p-1.5 overflow-auto gap-1.5 bg-white md:bg-uzh-grey-60 md:overflow-scroll min-h-screen h-max">
        <div
          className={twMerge(
            'p-4 md:rounded-lg md:border-2 md:border-solid md:border-uzh-blue-40 w-full bg-white hidden md:block min-h-full',
            (isFeedbackChannelActive || session.isAudienceInteractionActive) &&
              'md:w-1/2',
            activeMobilePage === 'questions' && 'block'
          )}
        >
          {/* // TODO replace check through activeInstances.length > 0 */}
          {session.activeBlock === -1 ||
          session.activeBlock === session.blocks.length ? (
            'Keine Frage aktiv.'
          ) : (
            <QuestionArea
              expiresAt={session.blocks[session.activeBlock].expiresAt}
              questions={session.blocks[session.activeBlock].instances.map(
                (question: any) => question.questionData
              )}
              handleNewResponse={handleNewResponse}
              sessionId={sessionId}
              timeLimit={session.blocks[session.activeBlock].timeLimit}
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

        {(isFeedbackChannelActive || session.isAudienceInteractionActive) && (
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
  const apolloClient = initializeApollo()

  // TODO: implement polling, to be replaced by more efficient solution like subscriptions
  const result = await apolloClient.query({
    query: GetSessionDocument,
    variables: {
      id: ctx.query?.id as string,
    },
  })

  return { props: { session: result.data?.session } }
}

export default Index
