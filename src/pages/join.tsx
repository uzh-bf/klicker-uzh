import classNames from 'classnames'
import _debounce from 'lodash/debounce'
import { useRouter } from 'next/router'
import React, { useState, useEffect } from 'react'
import { useMutation, useQuery } from '@apollo/react-hooks'
import { defineMessages, FormattedMessage, useIntl } from 'react-intl'
import { Button, Message } from 'semantic-ui-react'

import { withApollo } from '../lib/apollo'
import StudentLayout from '../components/layouts/StudentLayout'
import FeedbackArea from '../components/sessions/join/FeedbackArea'
import QuestionArea from '../components/sessions/join/QuestionArea'
import AddConfusionTSMutation from '../graphql/mutations/AddConfusionTSMutation.graphql'
import AddFeedbackMutation from '../graphql/mutations/AddFeedbackMutation.graphql'
import AddResponseMutation from '../graphql/mutations/AddResponseMutation.graphql'
import JoinSessionQuery from '../graphql/queries/JoinSessionQuery.graphql'
import UpdatedSessionSubscription from '../graphql/subscriptions/UpdateSessionSubscription.graphql'
import useLogging from '../lib/hooks/useLogging'
import useFingerprint from '../lib/hooks/useFingerprint'

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

function Join(): React.ReactElement {
  useLogging({ logRocket: false })

  const intl = useIntl()
  const router = useRouter()

  const [sidebarVisible, setSidebarVisible] = useState(false)
  const [sidebarActiveItem, setSidebarActiveItem] = useState('activeQuestion')
  const [extraMessage, setExtraMessage] = useState(null as string)

  const [newConfusionTS] = useMutation(AddConfusionTSMutation)
  const [newFeedback] = useMutation(AddFeedbackMutation)
  const [newResponse, { error: responseError }] = useMutation(AddResponseMutation)
  const { data, loading, error, subscribeToMore } = useQuery(JoinSessionQuery, {
    variables: { shortname: router.query.shortname },
  })

  const { shortname }: { shortname?: string } = router.query

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
  }, [data, loading, responseError])

  const fingerprint = useFingerprint()

  if (loading || error || !data.joinSession || data.joinSession.status === 'COMPLETED') {
    return (
      <div className="noSession">
        {extraMessage && <Message error>{extraMessage}</Message>}
        <Button icon="refresh" onClick={(): void => window.location.reload()} />
        <FormattedMessage
          defaultMessage="No session active. Please reload the page once a session has been started."
          id="joinSession.noSessionActive"
        />

        <style jsx>{`
          .noSession {
            padding: 1rem;
            font-weight: bold;

            :global(button) {
              margin-right: 1rem;
              margin-bottom: 1rem;
            }
          }
        `}</style>
      </div>
    )
  }

  const { id: sessionId, settings, activeInstances, feedbacks, expiresAt, timeLimit } = data.joinSession

  const onSidebarActiveItemChange = (newSidebarActiveItem): any => (): void => {
    setSidebarActiveItem(newSidebarActiveItem)
    setSidebarVisible(false)
  }

  const onToggleSidebarVisible = (): void => setSidebarVisible((prev): boolean => !prev)

  // handle creation of a new confusion timestep
  const onNewConfusionTS = _debounce(
    async ({ difficulty = 0, speed = 0 }): Promise<void> => {
      try {
        newConfusionTS({
          variables: {
            difficulty,
            fp: fingerprint,
            sessionId,
            speed,
          },
        })
      } catch ({ message }) {
        console.error(message)
      }
    },
    4000,
    { trailing: true }
  )

  // handle creation of a new feedback
  const onNewFeedback = async ({ content }): Promise<void> => {
    if (!newFeedback) {
      return
    }

    try {
      if (settings.isFeedbackChannelPublic) {
        newFeedback({
          // optimistically add the feedback to the array already
          optimisticResponse: {
            addFeedback: {
              __typename: 'Session_Feedback',
              content,
              // randomly generate an id, will be replaced by server response
              id: Math.round(Math.random() * -1000000),
              votes: 0,
            },
          },
          // update the cache after the mutation has completed
          update: (store, { data: { addFeedback } }): void => {
            const query = {
              query: JoinSessionQuery,
              variables: { shortname: router.query.shortname },
            }

            // get the data from the store
            // replace the feedbacks
            const queryData: any = store.readQuery(query)
            queryData.joinSession.feedbacks = [...queryData.joinSession.feedbacks, addFeedback]

            // write the updated data to the store
            store.writeQuery({
              ...query,
              data: queryData,
            })
          },
          variables: { content, fp: fingerprint, sessionId },
        })
      } else {
        newFeedback({ variables: { content, fp: fingerprint, sessionId } })
      }
    } catch ({ message }) {
      console.error(message)
    }
  }

  // handle creation of a new response
  const onNewResponse = async ({ instanceId, response }): Promise<void> => {
    try {
      newResponse({
        variables: { fp: fingerprint, instanceId, response },
      })
    } catch ({ message }) {
      console.error(message)

      try {
        newResponse({
          variables: { instanceId, response },
        })
      } catch (e) {
        console.error(e)
      }
    }
  }

  const title =
    sidebarActiveItem === 'activeQuestion'
      ? intl.formatMessage(messages.activeQuestionTitle)
      : intl.formatMessage(messages.feedbackChannelTitle)

  return (
    <StudentLayout
      isAuthenticationEnabled={settings.isParticipantAuthenticationEnabled}
      isInteractionEnabled={settings.isConfusionBarometerActive || settings.isFeedbackChannelActive}
      pageTitle={`Join ${shortname}`}
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
            console.log(subscriptionData)
            return { joinSession: subscriptionData.data.sessionUpdated }
          },
          variables: { sessionId },
        })
      }
      title={title}
    >
      <div className="joinSession">
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
            className={classNames('questionArea', {
              inactive: sidebarActiveItem !== 'activeQuestion',
            })}
          >
            <FormattedMessage defaultMessage="No question active." id="joinSession.noQuestionActive" />
          </div>
        )}

        {(settings.isConfusionBarometerActive || settings.isFeedbackChannelActive) && (
          <FeedbackArea
            active={sidebarActiveItem === 'feedbackChannel'}
            feedbacks={feedbacks}
            handleNewConfusionTS={onNewConfusionTS}
            handleNewFeedback={onNewFeedback}
            isConfusionBarometerActive={settings.isConfusionBarometerActive}
            isFeedbackChannelActive={settings.isFeedbackChannelActive}
            sessionId={sessionId}
            shortname={shortname}
          />
        )}
      </div>

      <style jsx>{`
        @import 'src/theme';

        .joinSession {
          display: flex;
          min-height: -moz-calc(100vh - 8rem);
          min-height: -webkit-calc(100vh - 8rem);
          min-height: calc(100vh - 8rem);
          width: 100%;

          background-color: lightgray;

          > * {
            flex: 0 0 50%;
          }

          .questionArea,
          .feedbackArea {
            padding: 1rem;

            &.inactive {
              display: none;
            }
          }

          @include desktop-tablet-only {
            padding: 1rem;
            min-height: 100%;

            .questionArea {
              border: 1px solid $color-primary;
              background-color: white;
              margin-right: 0.25rem;
            }

            .feedbackArea {
              border: 1px solid $color-primary;
              background-color: white;
              margin-left: 0.25rem;

              &.inactive {
                display: block;
              }
            }
          }
        }
      `}</style>
    </StudentLayout>
  )
}

export default withApollo({ ssr: true })(Join)
