// TODO: remove solution data from getSession query (in service as for learning element)

import { GetSessionDocument } from '@klicker-uzh/graphql/dist/ops'

import { useQuery } from '@apollo/client'
// import { faRotate } from '@fortawesome/free-solid-svg-icons'
// import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
// import { push } from '@socialgouv/matomo-next'
// import { Button } from '@uzh-bf/design-system'
// import getConfig from 'next/config'
import { useRouter } from 'next/router'
import React from 'react'
// import { Message } from 'semantic-ui-react'
import { twMerge } from 'tailwind-merge'

import Layout from '../../components/Layout'
// import FeedbackArea from '../../components/liveSession/FeedbackArea'
import QuestionArea from '../../components/liveSession/QuestionArea'
// import AddFeedbackMutation from '../../graphql/mutations/AddFeedbackMutation.graphql'
// import AddResponseMutation from '../../graphql/mutations/AddResponseMutation.graphql'
// import ReactToFeedbackResponseMutation from '../../graphql/mutations/ReactToFeedbackResponseMutation.graphql'
// import UpvoteFeedbackMutation from '../../graphql/mutations/UpvoteFeedbackMutation.graphql'
// import JoinQAQuery from '../../graphql/queries/JoinQAQuery.graphql'
// import JoinSessionQuery from '../../graphql/queries/JoinSessionQuery.graphql'
import UpdatedSessionSubscription from '../../graphql/subscriptions/UpdateSessionSubscription.graphql'
// import { APOLLO_STATE_PROP_NAME, initializeApollo } from '../../lib/apollo'
// import useFingerprint from '../../lib/hooks/useFingerprint'
// import useStickyState from '../../lib/hooks/useStickyState'

interface LiveSessionProps {
  shortname: string
}

function LiveSession({ shortname }: LiveSessionProps): React.ReactElement {
  const router = useRouter()

  const { loading, error, data } = useQuery(GetSessionDocument, {
    variables: {
      id: router.query.id as string,
    },
  })

  if (loading || !data) return <p>Loading...</p>
  if (error) return <p>Oh no... {error.message}</p>

  console.log(data)

  // return <div className="p-4">{data.session?.id}</div>

  return (
    <Layout
      feedbackIds={feedbackIds}
      isAuthenticationEnabled={settings.isParticipantAuthenticationEnabled}
      isInteractionEnabled={
        settings.isConfusionBarometerActive || settings.isFeedbackChannelActive
      }
      questionIds={questionIds}
      responseIds={responseIds}
      sidebar={{
        activeItem: sidebarActiveItem,
        handleSidebarActiveItemChange: onSidebarActiveItemChange,
        handleToggleSidebarVisible: onToggleSidebarVisible,
        sidebarVisible,
      }}
      subscribeToMore={(): any =>
        subscribeToMore({
          document: UpdatedSessionSubscription,
          updateQuery: (prev, { subscriptionData }): any => {
            if (!subscriptionData.data) return prev
            return { joinSession: subscriptionData.data.sessionUpdated }
          },
          variables: { sessionId },
        })
      }
      title={title}
    >
      <div className="flex w-full min-h-full gap-2 bg-gray-300 md:p-2">
        {activeInstances.length > 0 ? (
          <QuestionArea
            active={sidebarActiveItem === 'activeQuestion'}
            expiresAt={expiresAt}
            handleNewResponse={onNewResponse}
            isAuthenticationEnabled={
              settings.isParticipantAuthenticationEnabled
            }
            message={extraMessage}
            questions={activeInstances}
            sessionId={sessionId}
            shortname={shortname}
            timeLimit={timeLimit}
          />
        ) : (
          <div
            className={twMerge(
              'flex-1 bg-white md:flex md:flex-col md:shadow md:rounded-xl p-4',
              sidebarActiveItem !== 'activeQuestion' && 'hidden'
            )}
          >
            No question active.
          </div>
        )}

        {/* {settings.isFeedbackChannelActive && (
          <FeedbackArea
            active={sidebarActiveItem === 'feedbackChannel'}
            data={dataQA}
            handleFeedbackIds={onNewFeedbackIds}
            handleNewFeedback={onNewFeedback}
            handleReactToFeedbackResponse={onReactToFeedbackResponse}
            handleUpvoteFeedback={onUpvoteFeedback}
            isConfusionBarometerActive={settings.isConfusionBarometerActive}
            isFeedbackChannelActive={settings.isFeedbackChannelActive}
            reactions={reactions}
            sessionId={sessionId}
            setReactions={setReactions}
            setUpvotedFeedbacks={setUpvotedFeedbacks}
            shortname={shortname}
            subscribeToMore={subscribeToMoreQA}
            upvotedFeedbacks={upvotedFeedbacks}
          />
        )} */}
      </div>
    </Layout>
  )
}

// export async function getServerSideProps(props) {
//   const apolloClient = initializeApollo()

//   try {
//     await Promise.all([
//       apolloClient.query({
//         query: JoinSessionQuery,
//         variables: {
//           shortname: props.req.params.shortname,
//         },
//       }),
//       apolloClient.query({
//         query: JoinQAQuery,
//         variables: {
//           shortname: props.req.params.shortname,
//         },
//       }),
//     ])
//   } catch (error) {
//     console.log(error)
//   }

//   return {
//     props: {
//       [APOLLO_STATE_PROP_NAME]: apolloClient.cache.extract(),
//       shortname: props.req.params.shortname,
//     },
//   }
// }

export default LiveSession
