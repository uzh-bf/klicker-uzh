import classNames from 'classnames'
import _debounce from 'lodash/debounce'
import { useRouter } from 'next/router'
import React, { useState } from 'react'
import { useMutation, useQuery } from 'react-apollo'
import { defineMessages, FormattedMessage, useIntl } from 'react-intl'
import { StudentLayout } from '../components/layouts'
import FeedbackArea from '../components/sessions/join/FeedbackArea'
import QuestionArea from '../components/sessions/join/QuestionArea'
import {
  AddConfusionTSMutation,
  AddFeedbackMutation,
  AddResponseMutation,
  JoinSessionQuery,
  UpdatedSessionSubscription,
} from '../graphql'
import useLogging from '../lib/useLogging'
import useFingerprint from '../lib/useFingerprint'

const messages = defineMessages({
  activeQuestionTitle: {
    defaultMessage: 'Active Question',
    id: 'joinSessionactiveQuestion.title',
  },
  feedbackChannelTitle: {
    defaultMessage: 'Feedback-Channel',
    id: 'joinSessionfeedbackChannel.title',
  },
})

function Join(): React.ReactElement {
  useLogging({ logRocket: false })

  const intl = useIntl()
  const router = useRouter()

  const [sidebarVisible, setSidebarVisible] = useState(false)
  const [sidebarActiveItem, setSidebarActiveItem] = useState('activeQuestion')

  const [newConfusionTS] = useMutation(AddConfusionTSMutation)
  const [newFeedback] = useMutation(AddFeedbackMutation)
  const [newResponse] = useMutation(AddResponseMutation)
  const { data, loading, error, subscribeToMore } = useQuery(JoinSessionQuery, {
    variables: { shortname: router.query.shortname },
  })

  const fingerprint = useFingerprint()

  if (loading || error || !data.joinSession) {
    return (
      <div>
        <FormattedMessage defaultMessage="No session active." id="joinSession.noSessionActive" />
      </div>
    )
  }

  const { shortname }: { shortname?: string } = router.query
  const { id: sessionId, settings, activeInstances, feedbacks } = data.joinSession

  const onSidebarActiveItemChange = (newSidebarActiveItem): any => (): void => {
    setSidebarActiveItem(newSidebarActiveItem)
    setSidebarVisible(false)
  }

  const onToggleSidebarVisible = (): void => setSidebarVisible(prev => !prev)

  // handle creation of a new confusion timestep
  const onNewConfusionTS = _debounce(
    async ({ difficulty = 0, speed = 0 }) => {
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
  const onNewFeedback = async ({ content }) => {
    if (!newFeedback) {
      return
    }

    try {
      if (settings.isFeedbackChannelPublic) {
        newFeedback({
          // optimistically add the feedback to the array already
          optimisticResponse: {
            addFeedback: {
              feedbacks: [
                ...feedbacks,
                {
                  __typename: 'Feedback',
                  content,
                  // randomly generate an id, will be replaced by server response
                  id: Math.round(Math.random() * -1000000),
                  votes: 0,
                },
              ],
            },
          },
          // update the cache after the mutation has completed
          update: (store, { data: { addFeedback } }) => {
            const query = {
              query: JoinSessionQuery,
              variables: { shortname: router.query.shortname },
            }

            // get the data from the store
            // replace the feedbacks
            const queryData: any = store.readQuery(query)
            queryData.joinSession.feedbacks = addFeedback.feedbacks

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
  const onNewResponse = async ({ instanceId, response }) => {
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
      isInteractionEnabled={settings.isConfusionBarometerActive || settings.isFeedbackChannelActive}
      pageTitle={`Join ${shortname}`}
      sidebar={{
        activeItem: sidebarActiveItem,
        handleSidebarActiveItemChange: onSidebarActiveItemChange,
        handleToggleSidebarVisible: onToggleSidebarVisible,
        sidebarVisible,
      }}
      subscribeToMore={() =>
        subscribeToMore({
          document: UpdatedSessionSubscription,
          updateQuery: (prev, { subscriptionData }) => {
            if (!subscriptionData.data) return prev
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
            handleNewResponse={onNewResponse}
            questions={activeInstances}
            sessionId={sessionId}
            shortname={shortname}
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

export default Join
