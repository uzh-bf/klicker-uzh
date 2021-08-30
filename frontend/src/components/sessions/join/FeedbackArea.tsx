import React, { useState, useEffect } from 'react'
import clsx from 'clsx'
import dayjs from 'dayjs'
import { FormattedMessage } from 'react-intl'
import { Form, Button, TextArea } from 'semantic-ui-react'
import { partition, sortBy } from 'ramda'

import ConfusionSlider from '../../interaction/confusion/ConfusionSlider'
import PublicFeedback from './PublicFeedback'

interface Props {
  active: boolean
  isConfusionBarometerActive: boolean
  isFeedbackChannelActive: boolean
  feedbacks?: any[]
  handleNewConfusionTS: any
  handleNewFeedback: any
  handleUpvoteFeedback: any
  handleReactToFeedbackResponse: any
  shortname: string
  sessionId: string
  upvotedFeedbacks: any
  setUpvotedFeedbacks: any
  reactions: any
  setReactions: any
}

const defaultProps = {
  feedbacks: [],
  isConfusionBarometerActive: false,
  isFeedbackChannelActive: false,
}

function FeedbackArea({
  active,
  isConfusionBarometerActive,
  isFeedbackChannelActive,
  feedbacks,
  handleNewConfusionTS,
  handleNewFeedback,
  handleUpvoteFeedback,
  handleReactToFeedbackResponse,
  shortname,
  sessionId,
  upvotedFeedbacks,
  setUpvotedFeedbacks,
  reactions,
  setReactions,
}: Props): React.ReactElement {
  // const [confusionDifficulty, setConfusionDifficulty] = useState()
  // const [confusionSpeed, setConfusionSpeed] = useState()
  const [feedbackInputValue, setFeedbackInputValue] = useState('')
  const [processedFeedbacks, setProcessedFeedbacks] = useState({
    open: [],
    resolved: [],
  })

  useEffect(() => {
    const [resolved, open] = partition((feedback) => feedback.resolved, feedbacks)
    setProcessedFeedbacks({
      resolved: sortBy((o) => -o.votes, resolved as any[]),
      open: sortBy((o) => -o.votes, open as any[]),
    })
  }, [feedbacks])

  useEffect(() => {
    setProcessedFeedbacks((prev) => ({
      open: prev.open.map((feedback) => ({
        ...feedback,
        upvoted: upvotedFeedbacks && !!upvotedFeedbacks[feedback.id],
        responses: feedback.responses.map((response) => ({
          ...response,
          positive: reactions[response.id] > 0,
          negative: reactions[response.id] < 0,
        })),
      })),
      resolved: prev.resolved.map((feedback) => ({
        ...feedback,
        upvoted: upvotedFeedbacks && !!upvotedFeedbacks[feedback.id],
        responses: feedback.responses.map((response) => ({
          ...response,
          positive: reactions[response.id] > 0,
          negative: reactions[response.id] < 0,
        })),
      })),
    }))
  }, [feedbacks, upvotedFeedbacks, reactions])

  // useEffect((): void => {
  //   try {
  //     if (window.sessionStorage) {
  //       const confusion = JSON.parse(sessionStorage.getItem(`${shortname}-${sessionId}-confusion`))
  //       setConfusionDifficulty(confusion.confusionDifficulty)
  //       setConfusionSpeed(confusion.confusionSpeed)
  //     }
  //   } catch (e) {
  //     console.error(e)
  //   }
  // }, [])

  // const onNewConfusionTS = (): void => {
  //   // send the new confusion entry to the server
  //   handleNewConfusionTS({
  //     difficulty: confusionDifficulty,
  //     speed: confusionSpeed,
  //   })

  //   // update the confusion cookie
  //   try {
  //     if (window.sessionStorage) {
  //       sessionStorage.setItem(
  //         `${shortname}-${sessionId}-confusion`,
  //         JSON.stringify({
  //           difficulty: confusionDifficulty,
  //           speed: confusionSpeed,
  //           timestamp: dayjs().unix(),
  //         })
  //       )
  //     }
  //   } catch (e) {
  //     console.error(e)
  //   }
  // }

  const onNewFeedback = (): void => {
    setFeedbackInputValue('')
    handleNewFeedback({ content: feedbackInputValue })
  }

  const onUpvoteFeedback = async (feedbackId: string) => {
    await handleUpvoteFeedback({ feedbackId, undo: !!upvotedFeedbacks[feedbackId] })
    setUpvotedFeedbacks((prev) => ({ ...prev, [feedbackId]: !prev[feedbackId] }))
  }

  const handlePositiveResponseReaction = async (responseId: string, feedbackId: string) => {
    if (reactions[responseId] < 0) {
      await handleReactToFeedbackResponse({ feedbackId, responseId, positive: 1, negative: -1 })
    } else {
      await handleReactToFeedbackResponse({ feedbackId, responseId, positive: 1, negative: 0 })
    }
    setReactions((prev) => {
      return {
        ...prev,
        [responseId]: prev[responseId] > 0 ? undefined : 1,
      }
    })
  }

  const handleNegativeResponseReaction = async (responseId: string, feedbackId: string) => {
    if (reactions[responseId] > 0) {
      await handleReactToFeedbackResponse({ feedbackId, responseId, positive: -1, negative: 1 })
    } else {
      await handleReactToFeedbackResponse({ feedbackId, responseId, positive: 0, negative: 1 })
    }
    setReactions((prev) => {
      return {
        ...prev,
        [responseId]: prev[responseId] < 0 ? undefined : -1,
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
      <h1>Feedback-Channel</h1>

      {isFeedbackChannelActive && (
        <div>
          <Form>
            <Form.Field className="!mb-2">
              <TextArea
                className="h-24"
                name="feedbackInput"
                placeholder="Post a question or feedback..."
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
        {isFeedbackChannelActive && feedbacks && feedbacks.length > 0 && (
          <div>
            {processedFeedbacks.open.length > 0 && (
              <div>
                <h2 className="!mb-2">Open</h2>
                {processedFeedbacks.open.map(
                  ({ id, content, votes, responses, createdAt, pinned, resolved, upvoted }): React.ReactElement => (
                    <div className="mt-2 first:mt-0" key={id}>
                      <PublicFeedback
                        content={content}
                        createdAt={createdAt}
                        pinned={pinned}
                        resolved={resolved}
                        responses={responses}
                        upvoted={upvoted}
                        votes={votes}
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
                <h2 className="!mb-2">Resolved</h2>
                {processedFeedbacks.resolved.map(
                  ({
                    id,
                    content,
                    votes,
                    responses,
                    createdAt,
                    resolvedAt,
                    pinned,
                    resolved,
                    upvoted,
                  }): React.ReactElement => (
                    <div className="mt-2 first:mt-0" key={id}>
                      <PublicFeedback
                        content={content}
                        createdAt={createdAt}
                        pinned={pinned}
                        resolved={resolved}
                        resolvedAt={resolvedAt}
                        responses={responses}
                        upvoted={upvoted}
                        votes={votes}
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

      {/* {isConfusionBarometerActive && (
        <div className="confusion">
          <ConfusionSlider
            handleChange={(newValue): void => setConfusionSpeed(newValue)}
            handleChangeComplete={onNewConfusionTS}
            labels={{ max: 'fast', mid: 'optimal', min: 'slow' }}
            max={5}
            min={-5}
            title={
              <h2 className="sectionTitle">
                <FormattedMessage defaultMessage="Speed" id="common.string.speed" />
              </h2>
            }
            value={confusionSpeed}
          />

          <ConfusionSlider
            handleChange={(newValue): void => setConfusionDifficulty(newValue)}
            handleChangeComplete={onNewConfusionTS}
            labels={{ max: 'hard', mid: 'optimal', min: 'easy' }}
            max={5}
            min={-5}
            title={
              <h2 className="sectionTitle">
                <FormattedMessage defaultMessage="Difficulty" id="common.string.difficulty" />
              </h2>
            }
            value={confusionDifficulty}
          />
        </div>
      )} */}
    </div>
  )
}

FeedbackArea.defaultProps = defaultProps

export default FeedbackArea
