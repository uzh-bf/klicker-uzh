import React, { useState, useEffect } from 'react'
import clsx from 'clsx'
import { FormattedMessage, useIntl, defineMessages } from 'react-intl'
import { Form, Button, TextArea } from 'semantic-ui-react'
import { partition, sortBy } from 'ramda'
import dayjs from 'dayjs'
import PublicFeedbackAddedSubscription from '../../../graphql/subscriptions/PublicFeedbackAddedSubscription.graphql'
import PublicFeedbackRemovedSubscription from '../../../graphql/subscriptions/PublicFeedbackRemovedSubscription.graphql'
import FeedbackDeletedSubscription from '../../../graphql/subscriptions/FeedbackDeletedSubscription.graphql'
import FeedbackResolvedSubscription from '../../../graphql/subscriptions/FeedbackResolvedSubscription.graphql'
import FeedbackResponseAddedSubscription from '../../../graphql/subscriptions/FeedbackResponseAddedSubscription.graphql'
import ConfusionDialog from '../../interaction/confusion/ConfusionDialog'
import FeedbackResponseDeletedSubscription from '../../../graphql/subscriptions/FeedbackResponseDeletedSubscription.graphql'

import PublicFeedback from './PublicFeedback'

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
  isConfusionBarometerActive: boolean
  handleNewConfusionTS: any
  subscribeToMore: any
  data: any
  shortname: string
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
  isConfusionBarometerActive,
  handleNewConfusionTS,
  shortname,
  subscribeToMore,
  data,
}: Props): React.ReactElement {
  const [confusionDifficulty, setConfusionDifficulty] = useState()
  const [confusionSpeed, setConfusionSpeed] = useState()

  const intl = useIntl()

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

  useEffect((): void => {
    try {
      const confusion = window.sessionStorage?.getItem(`${shortname}-${sessionId}-confusion`)
      if (confusion) {
        setConfusionSpeed(JSON.parse(confusion).prevSpeed)
        setConfusionDifficulty(JSON.parse(confusion).prevDifficulty)
      }
    } catch (e) {
      console.error(e)
    }
  }, [])

  const onNewConfusionTS = async (newValue: any, selector: string) => {
    // send the new confusion entry to the server
    if (selector === 'speed') {
      setConfusionSpeed(newValue)
      handleNewConfusionTS({
        difficulty: confusionDifficulty ? confusionDifficulty : 0,
        speed: newValue,
      })
    } else if (selector === 'difficulty') {
      setConfusionDifficulty(newValue)
      handleNewConfusionTS({
        difficulty: newValue,
        speed: confusionSpeed ? confusionSpeed : 0,
      })
    }
  }

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
        'bg-white p-2 md:p-4 flex-col md:border-primary md:border-solid md:border flex-1 md:flex h-[93vh] md:h-full',
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

      {/* max-h-[35vh] overflow-scroll md:max-h-full */}
      <div className="flex-1 mt-4 mb-auto overflow-y-auto">
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
      </div>
      {isFeedbackChannelActive && isConfusionBarometerActive && (
        <div className="mt-5 mb-2">
          <ConfusionDialog
            handleChange={(newValue: any): Promise<void> => onNewConfusionTS(newValue, 'speed')}
            labels={{ max: 'fast', mid: 'optimal', min: 'slow' }}
            title={
              <h2 className="text-center sectionTitle md:text-left">
                <FormattedMessage defaultMessage="Speed" id="common.string.speed" />
              </h2>
            }
            value={confusionSpeed}
          />
          <ConfusionDialog
            handleChange={(newValue: any): Promise<void> => onNewConfusionTS(newValue, 'difficulty')}
            labels={{ max: 'hard', mid: 'optimal', min: 'easy' }}
            title={
              <h2 className="text-center sectionTitle md:text-left">
                <FormattedMessage defaultMessage="Difficulty" id="common.string.difficulty" />
              </h2>
            }
            value={confusionDifficulty}
          />
        </div>
      )}
    </div>
  )
}

FeedbackArea.defaultProps = defaultProps

export default FeedbackArea
