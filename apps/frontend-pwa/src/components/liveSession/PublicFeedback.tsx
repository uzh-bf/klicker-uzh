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
  // structure for upvotes element: { upvote: true/false, responseId1: 1 0 or -1, responseId2: 1 0 or -1, ...}
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
          console.log('found stored upvotes')
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
          console.log('initialized upvotes')
        }
      } catch (e) {
        console.error(e)
      }
    }
    exec()
  }, [feedback])

  console.log('upvotes', upvotes)

  const onUpvote = async (previousValue: boolean) => {
    const newUpvotes = { ...upvotes, upvote: !previousValue }
    setUpvotes(newUpvotes)
    await localForage.setItem(
      `${feedback.id}-upvotes`,
      JSON.stringify(newUpvotes)
    )
    // TODO: send upvote to server
  }

  // TODO: implement
  const onResponseUpvote = async (
    previousValue: boolean,
    responseId: string
  ) => {
    console.log('previous value', previousValue, responseId)
    const newUpvotes = { ...upvotes, [responseId]: previousValue ? 0 : 1 }
    setUpvotes(newUpvotes)
    await localForage.setItem(
      `${feedback.id}-upvotes`,
      JSON.stringify(newUpvotes)
    )
    // TODO: send upvote to server
  }

  const onResponseDownvote = async (
    previousValue: boolean,
    responseId: string
  ) => {
    console.log('previous value', previousValue, responseId)
    const newUpvotes = { ...upvotes, [responseId]: previousValue ? 0 : -1 }
    setUpvotes(newUpvotes)
    await localForage.setItem(
      `${feedback.id}-upvotes`,
      JSON.stringify(newUpvotes)
    )
    // TODO: send upvote to server
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
                      upvotes[response.id] === 1,
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
                      upvotes[response.id] === -1,
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
