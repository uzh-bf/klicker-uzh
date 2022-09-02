// TODO: remove solution data in a more specialized query than getSession (only the active instances are required)
// TODO: move layout around questions and feedback to separte component for reusability

import { GetSessionDocument } from '@klicker-uzh/graphql/dist/ops'
import { GetServerSideProps } from 'next'
// import { useQuery } from '@apollo/client'

import FeedbackArea from '@components/liveSession/FeedbackArea'
import QuestionArea from '@components/liveSession/QuestionArea'
import { initializeApollo } from '@lib/apollo'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { twMerge } from 'tailwind-merge'

function Index({ session }: any) {
  const router = useRouter()
  const sessionId = router.query.id as string

  // TODO: Remove / Keep code snipped to reuse for Feedback fetching
  // const { loading, error, data } = useQuery(GetSessionDocument, {
  //   variables: {
  //     id: router.query.id as string,
  //   },
  // })
  // if (loading || !data) return <p>Loading...</p>
  // if (error) return <p>Oh no... {error.message}</p>
  // console.log(data)

  // console.log(session)

  // TODO: remove hardcoded parameters and replace them by their corresponding values from DB
  // TODO: directly destructure session into its components to simplify notation
  const isFeedbackChannelActive = false // session.feedbackChannelActive
  const activeBlock = session.activeBlock // session.activeBlock

  // TODO: implement response handling for user response to question
  const handleNewResponse = () => {}

  // TODO: Layout similar to old version for desktop and app with bottom menu for mobile
  return (
    <div className="p-1.5 w-full h-full bg-uzh-grey-60 flex flex-row md:gap-1.5">
      <Head>
        <title>Live Session</title>
        <meta
          name="description"
          content={'Live Session ' + session.displayName}
          charSet="utf-8"
        ></meta>
      </Head>

      <div
        className={twMerge(
          'p-4 rounded-lg border-2 border-solid border-uzh-blue-40 w-full bg-white',
          (isFeedbackChannelActive || session.isAudienceInteractionActive) &&
            'md:w-1/2'
        )}
      >
        {/* replace check through activeInstances.length > 0 */}
        {activeBlock === -1 || activeBlock === session.blocks.length ? (
          'Keine Frage aktiv.'
        ) : (
          <QuestionArea
            expiresAt={session.blocks[activeBlock].expiresAt}
            questions={session.blocks[activeBlock].instances.map((question: any) => question.questionData)}
            handleNewResponse={handleNewResponse}
            sessionId={sessionId}
            timeLimit={session.blocks[activeBlock].timeLimit}
          />
        )}
      </div>

      {(isFeedbackChannelActive || session.isAudienceInteractionActive) && (
        <div className="w-1/2 p-4 bg-white border-2 border-solid rounded-lg border-uzh-blue-40">
          <FeedbackArea feedbacks={[]} />
        </div>
      )}
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
