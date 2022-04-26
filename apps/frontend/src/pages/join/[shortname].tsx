import clsx from 'clsx'
import _debounce from 'lodash/debounce'
import { useRouter } from 'next/router'
import React, { useState, useEffect } from 'react'
import { useMutation, useQuery } from '@apollo/client'
import { defineMessages, FormattedMessage, useIntl } from 'react-intl'
import { Button, Message } from 'semantic-ui-react'
import { push } from '@socialgouv/matomo-next'
import localForage from 'localforage'

import useStickyState from '../../lib/hooks/useStickyState'
import StudentLayout from '../../components/layouts/StudentLayout'
import FeedbackArea from '../../components/sessions/join/FeedbackArea'
import QuestionArea from '../../components/sessions/join/QuestionArea'
import AddFeedbackMutation from '../../graphql/mutations/AddFeedbackMutation.graphql'
import AddResponseMutation from '../../graphql/mutations/AddResponseMutation.graphql'
import UpvoteFeedbackMutation from '../../graphql/mutations/UpvoteFeedbackMutation.graphql'
import ReactToFeedbackResponseMutation from '../../graphql/mutations/ReactToFeedbackResponseMutation.graphql'
import JoinSessionQuery from '../../graphql/queries/JoinSessionQuery.graphql'
import UpdatedSessionSubscription from '../../graphql/subscriptions/UpdateSessionSubscription.graphql'
import useFingerprint from '../../lib/hooks/useFingerprint'
import JoinQAQuery from '../../graphql/queries/JoinQAQuery.graphql'
import { APOLLO_STATE_PROP_NAME, initializeApollo } from '../../lib/apollo'

const messages = defineMessages({
  activeQuestionTitle: {
    defaultMessage: 'Active Question',
    id: 'joinSession.activeQuestion.title',
  },
  feedbackChannelTitle: {
    defaultMessage: 'Feedback-Channel',
    id: 'joinSession.feedbackChannel.title',
  },
  ignoredSecondResponse: {
    defaultMessage: 'As you are only allowed to respond once, we did not count your latest response.',
    id: 'joinSession.string.responseIgnored',
  },
  joinForbidden: {
    defaultMessage: 'You are not permitted to join this session',
    id: 'joinSession.string.joinForbidden',
  },
})

function Join({ shortname }): React.ReactElement {
  const intl = useIntl()
  const router = useRouter()

  const [sidebarVisible, setSidebarVisible] = useState(false)
  const [sidebarActiveItem, setSidebarActiveItem] = useState('activeQuestion')
  const [extraMessage, setExtraMessage] = useState(null as string)

  const [feedbackIds, setFeedbackIds] = useState([])
  const [responseIds, setResponseIds] = useState([])

  const [upvotedFeedbacks, setUpvotedFeedbacks] = useStickyState({}, 'feedbackUpvotes')
  const [reactions, setReactions] = useStickyState({}, 'responseReactions')

  const [newFeedback] = useMutation(AddFeedbackMutation)
  const [newResponse, { error: responseError }] = useMutation(AddResponseMutation)
  const [upvoteFeedback] = useMutation(UpvoteFeedbackMutation)
  const [reactToFeedbackResponse] = useMutation(ReactToFeedbackResponseMutation)
  const { data, loading, error, subscribeToMore } = useQuery(JoinSessionQuery, {
    variables: { shortname },
  })

  const { data: dataQA, subscribeToMore: subscribeToMoreQA } = useQuery(JoinQAQuery, {
    variables: { shortname },
    pollInterval: 60000,
  })

  useEffect(() => {
    // if we need to login before being able to access the session, redirect to the login
    if (error?.graphQLErrors[0]?.message === 'INVALID_PARTICIPANT_LOGIN') {
      const { id, authenticationMode } = error.graphQLErrors[0].extensions
      if (authenticationMode === 'AAI') {
        window.location = `https://aai.klicker.uzh.ch/public/participants?shortname=${shortname}&session=${id}` as any
      } else {
        router.push(`/login/${shortname}/${id}`)
      }
    } else if (error?.graphQLErrors[0]?.message === 'SESSION_NOT_ACCESSIBLE') {
      setExtraMessage(intl.formatMessage(messages.joinForbidden))
    } else {
      setExtraMessage(null)
    }
  }, [error])

  useEffect(() => {
    setExtraMessage(null)
    if (responseError?.graphQLErrors[0]?.message === 'RESPONSE_NOT_ALLOWED') {
      setExtraMessage(intl.formatMessage(messages.ignoredSecondResponse))
    }
    if (data?.joinSession?.isFeedbackOnlySession) {
      setSidebarActiveItem('feedbackChannel')
    }
  }, [data, loading, responseError])

  const fingerprint = useFingerprint()

  if (loading || error || !data.joinSession || data.joinSession.status === 'COMPLETED') {
    return (
      <div className="p-4 font-bold noSession">
        {extraMessage && <Message error>{extraMessage}</Message>}
        <Button className="!mb-4 !mr-4" icon="refresh" onClick={(): void => window.location.reload()} />
        <FormattedMessage
          defaultMessage="No session active. Please reload the page once a session has been started."
          id="joinSession.noSessionActive"
        />
      </div>
    )
  }

  const { id: sessionId, settings, activeInstances, expiresAt, timeLimit } = data.joinSession

  const onSidebarActiveItemChange =
    (newSidebarActiveItem): any =>
    (): void => {
      setSidebarActiveItem(newSidebarActiveItem)
      setSidebarVisible(false)
      push(['trackEvent', 'Join Session', 'Sidebar Item Changed', newSidebarActiveItem])
    }

  const onToggleSidebarVisible = (): void => setSidebarVisible((prev): boolean => !prev)

  // handle creation of a new feedback
  const onNewFeedback = async ({ content }): Promise<void> => {
    if (!newFeedback) {
      return
    }

    try {
      newFeedback({
        variables: { content, fp: fingerprint, sessionId },
      })

      push(['trackEvent', 'Join Session', 'Feedback Added'])
    } catch ({ message }) {
      console.error(message)
    }
  }

  // handle creation of a new response
  const onNewResponse = async ({ instanceId, response }): Promise<void> => {
    try {
      await fetch('http://localhost:7071/api/AddResponse', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fp: fingerprint,
          instanceId,
          response,
        }),
      })
      // newResponse({
      //   variables: { fp: fingerprint, instanceId, response },
      // })
    } catch ({ message }) {
      console.error(message)

      try {
        await fetch('http://localhost:7071/api/AddResponse', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            instanceId,
            response,
          }),
        })
        // newResponse({
        //   variables: { instanceId, response },
        // })
      } catch (e) {
        console.error(e)
      }
    }

    push(['trackEvent', 'Join Session', 'Response Submitted'])
  }

  const onUpvoteFeedback = async ({ feedbackId, undo }) => {
    try {
      await upvoteFeedback({ variables: { sessionId, feedbackId, undo } })
    } catch ({ message }) {
      console.error(message)
    }

    push(['trackEvent', 'Join Session', 'Feedback Upvoted'])
  }

  const onReactToFeedbackResponse = async ({ feedbackId, responseId, positive, negative }) => {
    try {
      await reactToFeedbackResponse({ variables: { sessionId, feedbackId, responseId, positive, negative } })
    } catch (e) {
      console.error(e)
    }

    push(['trackEvent', 'Join Session', 'Feedback Response Reacted'])
  }

  const questionIds = activeInstances.map((instance: any) => instance.id)

  const onNewFeedbackIds = async (fIds: any, rIds: any) => {
    setFeedbackIds(fIds)
    setResponseIds(rIds)
  }

  const title =
    sidebarActiveItem === 'activeQuestion'
      ? intl.formatMessage(messages.activeQuestionTitle)
      : intl.formatMessage(messages.feedbackChannelTitle)

  return (
    <StudentLayout
      feedbackIds={feedbackIds}
      isAuthenticationEnabled={settings.isParticipantAuthenticationEnabled}
      isInteractionEnabled={settings.isConfusionBarometerActive || settings.isFeedbackChannelActive}
      pageTitle={`Join ${shortname}`}
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
            isAuthenticationEnabled={settings.isParticipantAuthenticationEnabled}
            message={extraMessage}
            questions={activeInstances}
            sessionId={sessionId}
            shortname={shortname}
            timeLimit={timeLimit}
          />
        ) : (
          <div
            className={clsx(
              'flex-1 bg-white md:flex md:flex-col md:shadow md:rounded-xl p-4',
              sidebarActiveItem !== 'activeQuestion' && 'hidden'
            )}
          >
            <FormattedMessage defaultMessage="No question active." id="joinSession.noQuestionActive" />
          </div>
        )}

        {settings.isFeedbackChannelActive && (
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
        )}
      </div>
    </StudentLayout>
  )
}

export async function getServerSideProps(props) {
  const apolloClient = initializeApollo()

  try {
    await Promise.all([
      apolloClient.query({
        query: JoinSessionQuery,
        variables: {
          shortname: props.req.params.shortname,
        },
      }),
      apolloClient.query({
        query: JoinQAQuery,
        variables: {
          shortname: props.req.params.shortname,
        },
      }),
    ])
  } catch (error) {
    console.log(error)
  }

  return {
    props: {
      [APOLLO_STATE_PROP_NAME]: apolloClient.cache.extract(),
      shortname: props.req.params.shortname,
    },
  }
}

export default Join
