import { faThumbsUp } from '@fortawesome/free-regular-svg-icons'
import { faQuestion } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Feedback } from '@klicker-uzh/graphql/dist/ops'
import { Button } from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import localForage from 'localforage'
import { useTranslations } from 'next-intl'
import React, { useEffect, useState } from 'react'

interface FeedbackProps {
  feedback: Feedback
  onUpvoteFeedback: (id: number, change: number) => void
  onReactToFeedbackResponse: (
    id: number,
    upvoteChange: number,
    downvoteChange: number
  ) => void
}

function PublicFeedback({
  feedback,
  onUpvoteFeedback,
  onReactToFeedbackResponse,
}: FeedbackProps): React.ReactElement {
  const feedbackId = feedback.id
  const t = useTranslations()

  // structure for upvotes element: { upvote: true/false, responseId1: 1, 0 or -1, responseId2: 1, 0 or -1, ...}
  // upvote true meaning feadback is upvoted, responseId value for upvote, no vote or downvote
  const [upvotes, setUpvotes] = useState({
    upvote: false,
    ...feedback.responses
      ?.map((response) => response?.id)
      .reduce((accumulator, value) => {
        return { ...accumulator, [value as unknown as string]: 0 }
      }, {}),
  })

  useEffect((): void => {
    const exec = async () => {
      try {
        let storedUpvotes: any = await localForage.getItem(
          `${feedbackId}-upvotes`
        )

        if (storedUpvotes) {
          if (typeof storedUpvotes === 'string') {
            storedUpvotes = JSON.parse(storedUpvotes)
          }
          setUpvotes(storedUpvotes)
        } else {
          await localForage.setItem(
            `${feedbackId}-upvotes`,
            JSON.stringify({
              upvote: false,
              ...feedback.responses
                ?.map((response) => response?.id)
                .reduce((accumulator, value) => {
                  return { ...accumulator, [value as unknown as string]: 0 }
                }, {}),
            })
          )
        }
      } catch (e) {
        console.error(e)
      }
    }
    exec()
  }, [feedback, feedbackId])

  const onUpvote = async (previousValue: boolean) => {
    const newUpvotes = { ...upvotes, upvote: !previousValue }
    setUpvotes(newUpvotes)
    await localForage.setItem(
      `${feedbackId}-upvotes`,
      JSON.stringify(newUpvotes)
    )
    onUpvoteFeedback(feedbackId, previousValue ? -1 : 1)
  }

  const onResponseUpvote = async (
    previousValue: number,
    responseId: number
  ) => {
    const newUpvotes = {
      ...upvotes,
      [responseId as unknown as string]: previousValue === 1 ? 0 : 1,
    }
    setUpvotes(newUpvotes)
    await localForage.setItem(
      `${feedbackId}-upvotes`,
      JSON.stringify(newUpvotes)
    )

    // send upvote change to parent component
    if (previousValue === 1) {
      onReactToFeedbackResponse(responseId, -1, 0)
    } else if (previousValue === 0) {
      onReactToFeedbackResponse(responseId, 1, 0)
    } else {
      onReactToFeedbackResponse(responseId, 1, -1)
    }
  }

  const onResponseDownvote = async (
    previousValue: number,
    responseId: number
  ) => {
    const newUpvotes = {
      ...upvotes,
      [responseId as unknown as string]: previousValue === -1 ? 0 : -1,
    }
    setUpvotes(newUpvotes)
    await localForage.setItem(
      `${feedbackId}-upvotes`,
      JSON.stringify(newUpvotes)
    )

    // send upvote change to parent component
    if (previousValue === -1) {
      onReactToFeedbackResponse(responseId, 0, -1)
    } else if (previousValue === 0) {
      onReactToFeedbackResponse(responseId, 0, 1)
    } else {
      onReactToFeedbackResponse(responseId, -1, 1)
    }
  }

  return (
    <div className="w-full mb-3">
      <div className="flex flex-row w-full p-1.5 text-sm border border-solid rounded-md bg-opacity-30 mb-1 bg-primary-20 border-primary-40">
        <div className="flex flex-col flex-1">
          <div className="mb-0.5">{feedback.content}</div>
          <div className="text-xs italic text-gray-600">
            {feedback.resolvedAt
              ? t('pwa.feedbacks.solvedAt', {
                  date: dayjs(feedback.resolvedAt).format('DD.MM.YYYY HH:mm'),
                })
              : t('pwa.feedbacks.postedAt', {
                  date: dayjs(feedback.createdAt).format('DD.MM.YYYY HH:mm'),
                })}
          </div>
        </div>
        <Button
          onClick={() => onUpvote(upvotes.upvote)}
          active={upvotes.upvote}
          className={{ root: 'w-10 h-10' }}
          disabled={feedback.resolvedAt}
          data={{ cy: `feedback-upvote-${feedback.content}` }}
        >
          <Button.Icon>
            <FontAwesomeIcon icon={faThumbsUp} size="lg" />
          </Button.Icon>
        </Button>
      </div>
      {feedback.responses &&
        feedback.responses.length > 0 &&
        feedback.responses.map(
          (response) =>
            response && (
              <div
                key={response.content}
                className="ml-8 flex flex-row flex-1 p-1.5 text-sm border-2 border-solid rounded-md border-uzh-grey-60 bg-uzh-grey-20 mb-1"
              >
                <div className="flex flex-col flex-1">{response.content}</div>
                <div>
                  <Button
                    onClick={() =>
                      onResponseUpvote(upvotes[response.id], response.id)
                    }
                    active={upvotes[response.id] === 1}
                    className={{ root: 'mr-1 w-9 h-9' }}
                    data={{
                      cy: `feedback-response-upvote-${response.content}`,
                    }}
                  >
                    <Button.Icon>
                      <FontAwesomeIcon icon={faThumbsUp} size="lg" />
                    </Button.Icon>
                  </Button>
                  <Button
                    onClick={() =>
                      onResponseDownvote(upvotes[response.id], response.id)
                    }
                    active={upvotes[response.id] === -1}
                    className={{ root: 'w-9 h-9' }}
                    data={{ cy: 'feedback-response-downvote' }}
                  >
                    <Button.Icon>
                      <FontAwesomeIcon icon={faQuestion} size="lg" />
                    </Button.Icon>
                  </Button>
                </div>
              </div>
            )
        )}
    </div>
  )
}

export default PublicFeedback
