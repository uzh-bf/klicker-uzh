import React, { useState, useEffect } from 'react'
import clsx from 'clsx'
import { FormattedMessage, useIntl, defineMessages } from 'react-intl'
import { Form, Button, TextArea, Message } from 'semantic-ui-react'
import { partition, sortBy } from 'ramda'
import dayjs from 'dayjs'
import PublicFeedbackAddedSubscription from '../../../graphql/subscriptions/PublicFeedbackAddedSubscription.graphql'
import PublicFeedbackRemovedSubscription from '../../../graphql/subscriptions/PublicFeedbackRemovedSubscription.graphql'
import FeedbackDeletedSubscription from '../../../graphql/subscriptions/FeedbackDeletedSubscription.graphql'
import FeedbackResolvedSubscription from '../../../graphql/subscriptions/FeedbackResolvedSubscription.graphql'
import FeedbackResponseAddedSubscription from '../../../graphql/subscriptions/FeedbackResponseAddedSubscription.graphql'
import FeedbackResponseDeletedSubscription from '../../../graphql/subscriptions/FeedbackResponseDeletedSubscription.graphql'

import PublicFeedback from './PublicFeedback'
import useStickyState from '../../../lib/hooks/useStickyState'

const messages = defineMessages({
  feedbackPlaceholder: {
    id: 'joinSession.feedbackArea.feedbackPlaceholder',
    defaultMessage: 'Post a question or feedback...',
  },
})

interface Props {
  active: boolean
  isFeedbackChannelActive?: boolean
  handleNewFeedback: any
  handleUpvoteFeedback: any
  handleReactToFeedbackResponse: any
  handleFeedbackIds: any
  upvotedFeedbacks: any
  setUpvotedFeedbacks: any
  reactions: any
  setReactions: any
  sessionId: string
  subscribeToMore: any
  data: any
}

const defaultProps = {
  isConfusionBarometerActive: false,
  isFeedbackChannelActive: false,
}

function FeedbackArea({
  active,
  isFeedbackChannelActive,
  handleNewFeedback,
  handleUpvoteFeedback,
  handleReactToFeedbackResponse,
  handleFeedbackIds,
  upvotedFeedbacks,
  setUpvotedFeedbacks,
  reactions,
  setReactions,
  sessionId,
  subscribeToMore,
  data,
}: Props): React.ReactElement {
  const intl = useIntl()

  const [isSurveyBannerVisible, setIsSurveyBannerVisible, hasSurveyBannerInitialized] = useStickyState(
    true,
    'qa-survey-student-visible'
  )

  useEffect(() => {
    const publicFeedbackAdded = subscribeToMore({
      document: PublicFeedbackAddedSubscription,
      variables: { sessionId },
      updateQuery: (prev, { subscriptionData }) => {
        if (!subscriptionData.data) return prev
        const newItem = subscriptionData.data.publicFeedbackAdded
        if (prev.joinQA.map((item) => item.id).includes(newItem.id)) return prev
        return { ...prev, joinQA: [newItem, ...prev.joinQA] }
      },
    })

    const publicFeedbackRemoved = subscribeToMore({
      document: PublicFeedbackRemovedSubscription,
      variables: { sessionId },
      updateQuery: (prev, { subscriptionData }) => {
        if (!subscriptionData.data) return prev
        return {
          ...prev,
          joinQA: prev.joinQA.filter((feedback) => feedback.id !== subscriptionData.data.publicFeedbackRemoved),
        }
      },
    })

    const feedbackDeleted = subscribeToMore({
      document: FeedbackDeletedSubscription,
      variables: { sessionId },
      updateQuery: (prev, { subscriptionData }) => {
        if (!subscriptionData.data) return prev
        return { ...prev, joinQA: prev.joinQA.filter((item) => item.id !== subscriptionData.data.feedbackDeleted) }
      },
    })

    const feedbackResolved = subscribeToMore({
      document: FeedbackResolvedSubscription,
      variables: { sessionId },
      updateQuery: (prev, { subscriptionData }) => {
        if (!subscriptionData.data) return prev
        return {
          ...prev,
          joinQA: prev.joinQA.map((item) => {
            if (item.id === subscriptionData.data.feedbackResolved.feedbackId) {
              return {
                ...item,
                resolved: subscriptionData.data.feedbackResolved.resolvedState,
                resolvedAt: subscriptionData.data.feedbackResolved.resolvedAt,
              }
            }
            return item
          }),
        }
      },
    })

    const feedbackResponseAdded = subscribeToMore({
      document: FeedbackResponseAddedSubscription,
      variables: { sessionId },
      updateQuery: (prev, { subscriptionData }) => {
        if (!subscriptionData.data) return prev
        return {
          ...prev,
          joinQA: prev.joinQA.map((item) => {
            if (item.id === subscriptionData.data.feedbackResponseAdded.feedbackId) {
              return {
                ...item,
                responses: [...item.responses, subscriptionData.data.feedbackResponseAdded],
                resolved: true,
                resolvedAt: new Date(),
              }
            }
            return item
          }),
        }
      },
    })

    const feedbackResponseDeleted = subscribeToMore({
      document: FeedbackResponseDeletedSubscription,
      variables: { sessionId },
      updateQuery: (prev, { subscriptionData }) => {
        if (!subscriptionData.data) return prev
        return {
          ...prev,
          joinQA: prev.joinQA.map((feedback) => {
            if (feedback.id === subscriptionData.data.feedbackResponseDeleted.feedbackId) {
              return {
                ...feedback,
                responses: feedback.responses.filter(
                  (response) => response.id !== subscriptionData.data.feedbackResponseDeleted.id
                ),
              }
            }
            return feedback
          }),
        }
      },
    })

    return () => {
      publicFeedbackAdded && publicFeedbackAdded()
      feedbackDeleted && feedbackDeleted()
      feedbackResolved && feedbackResolved()
      feedbackResponseAdded && feedbackResponseAdded()
      feedbackResponseDeleted && feedbackResponseDeleted()
      publicFeedbackRemoved && publicFeedbackRemoved()
    }
  }, [subscribeToMore, sessionId])

  const [feedbackInputValue, setFeedbackInputValue] = useState('')
  const [processedFeedbacks, setProcessedFeedbacks] = useState({
    open: [],
    resolved: [],
  })

  useEffect(() => {
    if (data?.joinQA) {
      const [resolved, open] = partition((feedback: any) => feedback.resolved, data.joinQA)
      setProcessedFeedbacks({
        resolved: sortBy((o: any) => dayjs(o.resolvedAt).unix(), resolved),
        open: sortBy((o: any) => -dayjs(o.createdAt).unix(), open),
      })
    }
  }, [data?.joinQA])

  useEffect(() => {
    setProcessedFeedbacks((prev) => ({
      open: prev.open.map((feedback) => ({
        ...feedback,
        upvoted: upvotedFeedbacks && !!upvotedFeedbacks[feedback.id],
        responses: feedback.responses.map((response) => ({
          ...response,
          positive: reactions?.[response.id] > 0,
          negative: reactions?.[response.id] < 0,
        })),
      })),
      resolved: prev.resolved.map((feedback) => ({
        ...feedback,
        upvoted: upvotedFeedbacks && !!upvotedFeedbacks[feedback.id],
        responses: feedback.responses.map((response) => ({
          ...response,
          positive: reactions?.[response.id] > 0,
          negative: reactions?.[response.id] < 0,
        })),
      })),
    }))
  }, [data?.joinQA, upvotedFeedbacks, reactions])

  useEffect(() => {
    // forward all feedback ids (visible resolved and open questions) to the join-page
    const feedbackIds = processedFeedbacks.open
      .map((feedback: any) => feedback.id)
      .concat(processedFeedbacks.resolved.map((feedback: any) => feedback.id))
    const responseIds = processedFeedbacks.open
      .filter((feedback) => feedback.responses && !(feedback.responses.length == 0))
      .map((feedback) =>
        feedback.responses.map((response: any) => {
          return response.id
        })
      )
      .concat(
        processedFeedbacks.resolved
          .filter((feedback) => feedback.responses && !(feedback.responses.length == 0))
          .map((feedback) =>
            feedback.responses.map((response: any) => {
              return response.id
            })
          )
      )
      .flat()
    handleFeedbackIds(feedbackIds, responseIds)
  }, [processedFeedbacks])

  const onNewFeedback = (): void => {
    setFeedbackInputValue('')
    handleNewFeedback({ content: feedbackInputValue })
  }

  const onUpvoteFeedback = async (feedbackId: string) => {
    await handleUpvoteFeedback({ feedbackId, undo: upvotedFeedbacks && !!upvotedFeedbacks[feedbackId] })
    setUpvotedFeedbacks((prev) => ({ ...(prev || {}), [feedbackId]: prev?.[feedbackId] ? !prev[feedbackId] : true }))
  }

  const handlePositiveResponseReaction = async (responseId: string, feedbackId: string) => {
    if (reactions?.[responseId] < 0) {
      await handleReactToFeedbackResponse({ feedbackId, responseId, positive: 1, negative: -1 })
    } else {
      await handleReactToFeedbackResponse({ feedbackId, responseId, positive: 1, negative: 0 })
    }
    setReactions((prev) => {
      return {
        ...(prev || {}),
        [responseId]: prev?.[responseId] > 0 ? undefined : 1,
      }
    })
  }

  const handleNegativeResponseReaction = async (responseId: string, feedbackId: string) => {
    if (reactions?.[responseId] > 0) {
      await handleReactToFeedbackResponse({ feedbackId, responseId, positive: -1, negative: 1 })
    } else {
      await handleReactToFeedbackResponse({ feedbackId, responseId, positive: 0, negative: 1 })
    }
    setReactions((prev) => {
      return {
        ...(prev || {}),
        [responseId]: prev?.[responseId] < 0 ? undefined : -1,
      }
    })
  }

  return (
    <div
      className={clsx(
        'bg-white p-2 md:p-4 flex-col md:border-primary md:border-solid md:border flex-1 md:flex',
        active ? 'flex' : 'hidden'
      )}
    >
      <h1 className="hidden md:block">Feedback-Channel</h1>

      {isFeedbackChannelActive && (
        <div>
          <Form>
            <Form.Field className="!mb-2">
              <TextArea
                className="h-24"
                name="feedbackInput"
                placeholder={intl.formatMessage(messages.feedbackPlaceholder)}
                rows={4}
                value={feedbackInputValue}
                onChange={(e): void => setFeedbackInputValue(e.target.value)}
              />
            </Form.Field>

            <Button primary disabled={!feedbackInputValue} type="submit" onClick={onNewFeedback}>
              <FormattedMessage defaultMessage="Submit" id="common.button.submit" />
            </Button>
          </Form>
        </div>
      )}

      <div className="flex flex-col justify-between h-full mt-4">
        {isFeedbackChannelActive && data?.joinQA && data.joinQA.length > 0 && (
          <div>
            {processedFeedbacks.open.length > 0 && (
              <div>
                <h2 className="!mb-2">
                  <FormattedMessage defaultMessage="Open" id="joinSession.feedbackArea.open" />
                </h2>
                {processedFeedbacks.open.map(
                  ({ id, content, responses, createdAt, resolved, upvoted }): React.ReactElement => (
                    <div className="mt-2 first:mt-0" key={id}>
                      <PublicFeedback
                        content={content}
                        createdAt={createdAt}
                        resolved={resolved}
                        responses={responses}
                        upvoted={upvoted}
                        onNegativeResponseReaction={(responseId: string) =>
                          handleNegativeResponseReaction(responseId, id)
                        }
                        onPositiveResponseReaction={(responseId: string) =>
                          handlePositiveResponseReaction(responseId, id)
                        }
                        onUpvoteFeedback={() => onUpvoteFeedback(id)}
                      />
                    </div>
                  )
                )}
              </div>
            )}

            {processedFeedbacks.resolved.length > 0 && (
              <div className="mt-4">
                <h2 className="!mb-2">
                  <FormattedMessage defaultMessage="Resolved" id="joinSession.feedbackArea.resolved" />
                </h2>
                {processedFeedbacks.resolved.map(
                  ({ id, content, responses, createdAt, resolvedAt, resolved, upvoted }): React.ReactElement => (
                    <div className="mt-2 first:mt-0" key={id}>
                      <PublicFeedback
                        content={content}
                        createdAt={createdAt}
                        resolved={resolved}
                        resolvedAt={resolvedAt}
                        responses={responses}
                        upvoted={upvoted}
                        onNegativeResponseReaction={(responseId: string) =>
                          handleNegativeResponseReaction(responseId, id)
                        }
                        onPositiveResponseReaction={(responseId: string) =>
                          handlePositiveResponseReaction(responseId, id)
                        }
                      />
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        )}

        {hasSurveyBannerInitialized && (isSurveyBannerVisible ?? true) && (
          <div className="fixed bottom-0 left-0 right-0">
            <Message
              warning
              className="!rounded-none"
              content={
                <FormattedMessage
                  defaultMessage="If you have used our feedback-channel (Q&A) functionality, please consider participating in our 2-minute survey under this {link}."
                  id="joinSession.feedbackArea.survey"
                  values={{
                    link: (
                      <a href="https://hi.switchy.io/6Igb" rel="noreferrer" target="_blank">
                        link
                      </a>
                    ),
                  }}
                />
              }
              icon="bullhorn"
              size="large"
              onDismiss={() => setIsSurveyBannerVisible(false)}
            />
          </div>
        )}
      </div>
    </div>
  )
}

FeedbackArea.defaultProps = defaultProps

export default FeedbackArea
