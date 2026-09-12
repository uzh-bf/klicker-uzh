import { faThumbsUp } from '@fortawesome/free-regular-svg-icons'
import { faQuestion } from '@fortawesome/free-solid-svg-icons'
import { Feedback } from '@klicker-uzh/graphql/dist/ops'
import { Button } from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import localForage from 'localforage'
import { useTranslations } from 'next-intl'
import React, { useEffect, useState } from 'react'

function PublicFeedback({
  feedback,
  onUpvoteFeedback,
  onReactToFeedbackResponse,
}: {
  feedback: Feedback
  onUpvoteFeedback: (id: number, change: number) => Promise<void>
  onReactToFeedbackResponse: (
    id: number,
    upvoteChange: number,
    downvoteChange: number
  ) => Promise<void>
}): React.ReactElement {
  const feedbackId = feedback.id
  const t = useTranslations()

  // structure for upvotes element: { upvote: true/false, responseId1: 1, 0 or -1, responseId2: 1, 0 or -1, ...}
  // upvote true meaning feadback is upvoted, responseId value for upvote, no vote or downvote
  const [upvotes, setUpvotes] = useState<{
    upvote: boolean
    [key: number]: -1 | 0 | 1
  }>({
    upvote: false,
    ...feedback.responses
      ?.map((response) => response?.id)
      .reduce((accumulator, value) => {
        return { ...accumulator, [String(value)]: 0 }
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
                  return { ...accumulator, [String(value)]: 0 }
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
    await onUpvoteFeedback(feedbackId, previousValue ? -1 : 1)
  }

  const onResponseUpvote = async ({
    previousValue,
    responseId,
  }: {
    previousValue?: number
    responseId: number
  }) => {
    const newUpvotes = {
      ...upvotes,
      [String(responseId)]: previousValue === 1 ? 0 : 1,
    }
    setUpvotes(newUpvotes)
    await localForage.setItem(
      `${feedbackId}-upvotes`,
      JSON.stringify(newUpvotes)
    )

    // send upvote change to parent component
    if (previousValue === 1) {
      await onReactToFeedbackResponse(responseId, -1, 0)
    } else if (previousValue === 0 || typeof previousValue === 'undefined') {
      await onReactToFeedbackResponse(responseId, 1, 0)
    } else if (previousValue === -1) {
      await onReactToFeedbackResponse(responseId, 1, -1)
    }
  }

  const onResponseDownvote = async ({
    previousValue,
    responseId,
  }: {
    previousValue?: number
    responseId: number
  }) => {
    const newUpvotes = {
      ...upvotes,
      [String(responseId)]: previousValue === -1 ? 0 : -1,
    }
    setUpvotes(newUpvotes)
    await localForage.setItem(
      `${feedbackId}-upvotes`,
      JSON.stringify(newUpvotes)
    )

    // send upvote change to parent component
    if (previousValue === -1) {
      await onReactToFeedbackResponse(responseId, 0, -1)
    } else if (previousValue === 0 || typeof previousValue === 'undefined') {
      await onReactToFeedbackResponse(responseId, 0, 1)
    } else if (previousValue === 1) {
      await onReactToFeedbackResponse(responseId, -1, 1)
    } else {
      console.log('Error: previousValue is not -1, 0 or 1:', previousValue)
    }
  }

  return (
    <div className="mb-3 w-full">
      <div className="mb-2 flex w-full flex-row rounded-lg border bg-white p-2 shadow-sm transition-shadow duration-200 hover:shadow-md">
        <div className="flex flex-1 flex-col">
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
          active={upvotes.upvote}
          aria-pressed={!!upvotes.upvote}
          aria-label={t('pwa.feedbacks.upvoteQuestion')}
          disabled={feedback.resolvedAt}
          onClick={() => onUpvote(upvotes.upvote)}
          className={{
            root: 'h-11 w-11 shrink-0',
            active: 'border-unset',
          }}
          data={{ cy: `feedback-upvote-${feedback.content}` }}
        >
          <Button.Icon
            withoutLabel
            icon={faThumbsUp}
            className={{ root: 'h-5 w-5' }}
          />
        </Button>
      </div>
      {feedback.responses &&
        feedback.responses.length > 0 &&
        feedback.responses.map(
          (response) =>
            response && (
              <div
                key={response.content}
                className="bg-uzh-grey-20 mb-1 ml-8 flex flex-1 transform flex-row rounded-md border border-solid p-1.5 text-sm shadow-sm transition-shadow duration-300 hover:shadow-md"
              >
                <div className="flex flex-1 flex-col">{response.content}</div>
                <div>
                  <Button
                    aria-label={t('pwa.feedbacks.helpfulResponse')}
                    aria-pressed={upvotes[response.id] === 1}
                    onClick={async () =>
                      await onResponseUpvote({
                        previousValue: upvotes[response.id],
                        responseId: response.id,
                      })
                    }
                    active={upvotes[response.id] === 1}
                    className={{
                      root: 'mr-1 h-11 w-11',
                      active: 'border-unset',
                    }}
                    data={{
                      cy: `feedback-response-upvote-${response.content}`,
                    }}
                  >
                    <Button.Icon
                      withoutLabel
                      icon={faThumbsUp}
                      className={{ root: 'h-4 w-4' }}
                    />
                  </Button>
                  <Button
                    aria-label={t('pwa.feedbacks.unhelpfulResponse')}
                    aria-pressed={upvotes[response.id] === -1}
                    onClick={async () =>
                      await onResponseDownvote({
                        previousValue: upvotes[response.id],
                        responseId: response.id,
                      })
                    }
                    active={upvotes[response.id] === -1}
                    className={{
                      root: 'h-11 w-11',
                      active: 'border-unset',
                    }}
                    data={{ cy: 'feedback-response-downvote' }}
                  >
                    <Button.Icon
                      withoutLabel
                      icon={faQuestion}
                      className={{ root: 'h-4 w-4' }}
                    />
                  </Button>
                </div>
              </div>
            )
        )}
    </div>
  )
}

export default PublicFeedback
