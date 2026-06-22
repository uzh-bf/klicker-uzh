import { faThumbsUp } from '@fortawesome/free-regular-svg-icons'
import { faQuestion } from '@fortawesome/free-solid-svg-icons'
import { Button, toast } from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import localForage from 'localforage'
import { useTranslations } from 'next-intl'
import React, { useEffect, useState } from 'react'

type Feedback = {
  id: number
  isResolved: boolean
  content: string
  resolvedAt?: Date | string | null
  createdAt: Date | string
  responses?:
    | {
        id: number
        content: string
        positiveReactions: number
        negativeReactions: number
        createdAt?: Date | string | null
      }[]
    | null
}

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
  const [pendingVoteKey, setPendingVoteKey] = useState<string | null>(null)

  const persistUpvotes = async (
    value: typeof upvotes | { upvote: boolean; [key: number]: -1 | 0 | 1 }
  ) => {
    await localForage.setItem(`${feedbackId}-upvotes`, JSON.stringify(value))
  }

  const rollbackUpvotes = async (previousUpvotes: typeof upvotes) => {
    setUpvotes(previousUpvotes)
    try {
      await persistUpvotes(previousUpvotes)
    } catch (error) {
      console.error(error)
    }
  }

  const showVoteError = () => {
    toast({
      type: 'error',
      message: t('shared.generic.systemError'),
      options: { duration: 5000 },
    })
  }

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
    if (pendingVoteKey) return

    const previousUpvotes = upvotes
    const newUpvotes = { ...upvotes, upvote: !previousValue }
    setPendingVoteKey('feedback')

    try {
      setUpvotes(newUpvotes)
      await persistUpvotes(newUpvotes)
      await onUpvoteFeedback(feedbackId, previousValue ? -1 : 1)
    } catch (error) {
      console.error(error)
      await rollbackUpvotes(previousUpvotes)
      showVoteError()
    } finally {
      setPendingVoteKey(null)
    }
  }

  const onResponseUpvote = async ({
    previousValue,
    responseId,
  }: {
    previousValue?: number
    responseId: number
  }) => {
    if (pendingVoteKey) return

    const previousUpvotes = upvotes
    const newUpvotes = {
      ...upvotes,
      [String(responseId)]: previousValue === 1 ? 0 : 1,
    }
    setPendingVoteKey(`response-${responseId}-up`)

    try {
      setUpvotes(newUpvotes)
      await persistUpvotes(newUpvotes)

      // send upvote change to parent component
      if (previousValue === 1) {
        await onReactToFeedbackResponse(responseId, -1, 0)
      } else if (previousValue === 0 || typeof previousValue === 'undefined') {
        await onReactToFeedbackResponse(responseId, 1, 0)
      } else if (previousValue === -1) {
        await onReactToFeedbackResponse(responseId, 1, -1)
      }
    } catch (error) {
      console.error(error)
      await rollbackUpvotes(previousUpvotes)
      showVoteError()
    } finally {
      setPendingVoteKey(null)
    }
  }

  const onResponseDownvote = async ({
    previousValue,
    responseId,
  }: {
    previousValue?: number
    responseId: number
  }) => {
    if (pendingVoteKey) return

    const previousUpvotes = upvotes
    const newUpvotes = {
      ...upvotes,
      [String(responseId)]: previousValue === -1 ? 0 : -1,
    }
    setPendingVoteKey(`response-${responseId}-down`)

    try {
      setUpvotes(newUpvotes)
      await persistUpvotes(newUpvotes)

      // send downvote change to parent component
      if (previousValue === -1) {
        await onReactToFeedbackResponse(responseId, 0, -1)
      } else if (previousValue === 0 || typeof previousValue === 'undefined') {
        await onReactToFeedbackResponse(responseId, 0, 1)
      } else if (previousValue === 1) {
        await onReactToFeedbackResponse(responseId, -1, 1)
      } else {
        console.log('Error: previousValue is not -1, 0 or 1:', previousValue)
      }
    } catch (error) {
      console.error(error)
      await rollbackUpvotes(previousUpvotes)
      showVoteError()
    } finally {
      setPendingVoteKey(null)
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
          disabled={!!feedback.resolvedAt || pendingVoteKey !== null}
          loading={pendingVoteKey === 'feedback'}
          onClick={() => onUpvote(upvotes.upvote)}
          className={{
            root: 'h-10 w-10 transform transition hover:scale-105',
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
                key={response.id}
                className="bg-uzh-grey-20 mb-1 ml-8 flex flex-1 transform flex-row rounded-md border border-solid p-1.5 text-sm shadow-sm transition-shadow duration-300 hover:shadow-md"
              >
                <div className="flex flex-1 flex-col">{response.content}</div>
                <div>
                  <Button
                    onClick={async () =>
                      await onResponseUpvote({
                        previousValue: upvotes[response.id],
                        responseId: response.id,
                      })
                    }
                    active={upvotes[response.id] === 1}
                    disabled={pendingVoteKey !== null}
                    loading={pendingVoteKey === `response-${response.id}-up`}
                    className={{
                      root: 'mr-1 h-9 w-9 transform transition hover:scale-105',
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
                    onClick={async () =>
                      await onResponseDownvote({
                        previousValue: upvotes[response.id],
                        responseId: response.id,
                      })
                    }
                    active={upvotes[response.id] === -1}
                    disabled={pendingVoteKey !== null}
                    loading={pendingVoteKey === `response-${response.id}-down`}
                    className={{
                      root: 'h-9 w-9 transform transition hover:scale-105',
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
