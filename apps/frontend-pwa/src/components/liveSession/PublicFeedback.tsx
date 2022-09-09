import { Feedback } from '@klicker-uzh/graphql/dist/ops'
import { Button } from '@uzh-bf/design-system'
import localForage from 'localforage'
import React, { useEffect, useState } from 'react'

interface FeedbackProps {
  feedback: Feedback
  onUpvoteFeedback: (change: number) => void
  onReactToFeedbackResponse: (
    upvoteChange: number,
    downvoteChange: number
  ) => void
}

function PublicFeedback({
  feedback,
  onUpvoteFeedback,
  onReactToFeedbackResponse,
}: FeedbackProps): React.ReactElement {
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
          `${feedback.id}-upvotes`
        )

        if (storedUpvotes) {
          if (typeof storedUpvotes === 'string') {
            storedUpvotes = JSON.parse(storedUpvotes)
          }
          setUpvotes(storedUpvotes)
        } else {
          await localForage.setItem(
            `${feedback.id}-upvotes`,
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
  }, [feedback])

  const onUpvote = async (previousValue: boolean) => {
    const newUpvotes = { ...upvotes, upvote: !previousValue }
    setUpvotes(newUpvotes)
    await localForage.setItem(
      `${feedback.id}-upvotes`,
      JSON.stringify(newUpvotes)
    )
    onUpvoteFeedback(previousValue ? -1 : 1)
  }

  const onResponseUpvote = async (
    previousValue: number,
    responseId: string
  ) => {
    const newUpvotes = { ...upvotes, [responseId]: previousValue === 1 ? 0 : 1 }
    setUpvotes(newUpvotes)
    await localForage.setItem(
      `${feedback.id}-upvotes`,
      JSON.stringify(newUpvotes)
    )

    // send upvote change to parent component
    if (previousValue === 1) {
      onReactToFeedbackResponse(-1, 0)
    } else if (previousValue === 0) {
      onReactToFeedbackResponse(1, 0)
    } else {
      onReactToFeedbackResponse(1, -1)
    }
  }

  const onResponseDownvote = async (
    previousValue: number,
    responseId: string
  ) => {
    const newUpvotes = { ...upvotes, [responseId]: previousValue === -1 ? 0 : -1 }
    setUpvotes(newUpvotes)
    await localForage.setItem(
      `${feedback.id}-upvotes`,
      JSON.stringify(newUpvotes)
    )
    
    // send upvote change to parent component
    if (previousValue === -1) {
      onReactToFeedbackResponse(0, -1)
    } else if (previousValue === 0) {
      onReactToFeedbackResponse(0, 1)
    } else {
      onReactToFeedbackResponse(-1, 1)
    }
  }

  return (
    <div className="w-full mb-2 bg-red-400">
      <div>
        {feedback.content}
        <Button
          onClick={() => onUpvote(upvotes.upvote)}
          active={upvotes.upvote}
        >
          <Button.Icon>IC</Button.Icon>
        </Button>
      </div>
      {feedback.responses &&
        feedback.responses.length > 0 &&
        feedback.responses.map(
          (response) =>
            response && (
              <div key={response.content}>
                {response.content}
                <Button
                  onClick={() =>
                    onResponseUpvote(
                      upvotes[response.id],
                      response.id as unknown as string
                    )
                  }
                  active={upvotes[response.id] === 1}
                >
                  <Button.Icon>UP</Button.Icon>
                </Button>
                <Button
                  onClick={() =>
                    onResponseDownvote(
                      upvotes[response.id],
                      response.id as unknown as string
                    )
                  }
                  active={upvotes[response.id] === -1}
                >
                  <Button.Icon>DN</Button.Icon>
                </Button>
              </div>
            )
        )}
    </div>
  )
}

export default PublicFeedback
