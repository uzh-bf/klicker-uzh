import { useMutation } from '@apollo/client'
import {
  CreateFeedbackDocument,
  Feedback,
  UpvoteFeedbackDocument,
  VoteFeedbackResponseDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, H1, H3 } from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import { Field, Form, Formik } from 'formik'
import { useRouter } from 'next/router'
import React from 'react'
import { Oval } from 'react-loader-spinner'

import PublicFeedback from './PublicFeedback'

interface FeedbackAreaProps {
  feedbacks: Feedback[]
  loading?: boolean
  isModerationEnabled?: boolean
}

const defaultProps = {
  loading: false,
  isModerationEnabled: true,
}

function FeedbackArea({
  feedbacks,
  loading,
  isModerationEnabled,
}: FeedbackAreaProps): React.ReactElement {
  const router = useRouter()
  const [upvoteFeedback] = useMutation(UpvoteFeedbackDocument)
  const [voteFeedbackResponse] = useMutation(VoteFeedbackResponseDocument)
  const [createFeedback] = useMutation(CreateFeedbackDocument)

  const onAddFeedback = (input: string) => {
    createFeedback({
      variables: {
        sessionId: router.query.id as string,
        content: input,
        isPublished: !isModerationEnabled,
      },
    })
  }

  const onUpvoteFeedback = (id: number, change: number) => {
    upvoteFeedback({ variables: { feedbackId: id, increment: change } })
  }

  const onReactToFeedbackResponse = (
    id: number,
    upvoteChange: number,
    downvoteChange: number
  ) => {
    voteFeedbackResponse({
      variables: {
        id: id,
        incrementUpvote: upvoteChange,
        incrementDownvote: downvoteChange,
      },
    })
  }

  if (loading || !feedbacks) {
    return <div>Loading...</div>
  }
  const openFeedbacks = feedbacks.filter(
    (feedback) => feedback.isResolved === false
  )
  const resolvedFeedbacks = feedbacks.filter(
    (feedback) => feedback.isResolved === true
  )

  return (
    <div className="w-full h-full">
      <H1>Feedback-Kanal</H1>

      <div className="mb-8">
        <Formik
          initialValues={{ feedbackInput: '' }}
          onSubmit={(values, { setSubmitting }) => {
            if (values.feedbackInput !== '') {
              onAddFeedback(values.feedbackInput)
              values.feedbackInput = ''

              setTimeout(() => {
                setSubmitting(false)
              }, 700)
            } else {
              setSubmitting(false)
            }
          }}
        >
          {({ isSubmitting }) => (
            <Form>
              <Field
                className="w-full mb-1 border-2 border-solid border-uzh-grey-80 rounded-md p-1.5 text-sm"
                component="textarea"
                rows="3"
                name="feedbackInput"
                placeholder="Feedback / Frage eingeben"
              />
              <Button
                className="float-right h-10 text-center items-center !w-30"
                type="submit"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <Button.Label>
                    <Oval
                      height={20}
                      width={20}
                      color="#0028a5"
                      visible={true}
                      ariaLabel="oval-loading"
                      secondaryColor="#99a9db"
                      strokeWidth={5}
                      strokeWidthSecondary={5}
                    />
                  </Button.Label>
                ) : (
                  <Button.Label className="text-sm">Absenden</Button.Label>
                )}
              </Button>
            </Form>
          )}
        </Formik>
      </div>

      <div className="mb-8 text-sm">ConfusionArea PLACEHOLDER // TODO</div>

      {feedbacks.length > 0 && (
        <div>
          {openFeedbacks.length > 0 && (
            <div className="mb-8">
              <H3>Open Questions</H3>
              {openFeedbacks.map((feedback) => (
                <PublicFeedback
                  key={feedback.content}
                  feedback={feedback}
                  onUpvoteFeedback={onUpvoteFeedback}
                  onReactToFeedbackResponse={onReactToFeedbackResponse}
                />
              ))}
            </div>
          )}

          {resolvedFeedbacks.length > 0 && (
            <div className="mb-4">
              <H3>Resolved Questions</H3>
              {resolvedFeedbacks
                .sort((feedback1, feedback2) =>
                  dayjs(feedback2.resolvedAt).diff(dayjs(feedback1.resolvedAt))
                )
                .map((feedback) => (
                  <PublicFeedback
                    key={feedback.content}
                    feedback={feedback}
                    onUpvoteFeedback={onUpvoteFeedback}
                    onReactToFeedbackResponse={onReactToFeedbackResponse}
                  />
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

FeedbackArea.defaultProps = defaultProps

export default FeedbackArea
