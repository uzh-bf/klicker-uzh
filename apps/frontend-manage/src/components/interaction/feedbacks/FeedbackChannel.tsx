// TODO: notifications

import { faEye, faEyeSlash } from '@fortawesome/free-regular-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  Feedback as FeedbackType,
  FeedbackResponse,
} from '@klicker-uzh/graphql/dist/ops'
import { Button } from '@uzh-bf/design-system'
import { useState } from 'react'

import useFeedbackFilter from '../../../lib/hooks/useFeedbackFilter'
// import { createNotification, requestNotificationPermissions } from '../../../lib/utils/notifications'
import Feedback from './Feedback'
import FeedbackSearchAndFilters from './FeedbackSearchAndFilters'

interface Props {
  feedbacks?: FeedbackType[]
  handleDeleteFeedback: (feedbackId: number) => void
  handlePinFeedback: (feedbackId: number, isPinned: boolean) => void
  handlePublishFeedback: (feedbackId: number, isPublished: boolean) => void
  handleResolveFeedback: (feedbackId: number, resolvedState: boolean) => void
  handleRespondToFeedback: (feedbackId: number, response: string) => void
  handleDeleteFeedbackResponse: (responseId: number) => void
  isActive?: boolean
  isPublic?: boolean
}

const defaultProps = {
  feedbacks: [],
  isActive: false,
  isPublic: false,
}

function FeedbackChannel({
  feedbacks,
  isPublic,
  handleDeleteFeedback,
  handlePinFeedback,
  handlePublishFeedback,
  handleResolveFeedback,
  handleRespondToFeedback,
  handleDeleteFeedbackResponse,
}: Props) {
  // const [isSurveyBannerVisible, setIsSurveyBannerVisible, hasSurveyBannerInitialized] = useStickyState(
  //   true,
  //   'qa-survey-lecturer-visible'
  // )

  const [sortedFeedbacks, filterProps] = useFeedbackFilter(feedbacks, {
    withSearch: true,
  })
  // const [feedbackLength, setFeedbackLength] = useState(0)

  // useEffect(() => {
  //   requestNotificationPermissions((permission) => {
  //     if (permission === 'granted') {
  //       setFeedbackLength(feedbacks.length)
  //     }
  //   })
  // }, [])

  // useEffect(() => {
  //   if (!sessionStorage?.getItem(`feedback ${feedbacks[feedbacks.length - 1]?.id}`)) {
  //     if (feedbacks.length > feedbackLength) {
  //       createNotification(intl.formatMessage(messages.notificationTitle), feedbacks[feedbacks.length - 1].content)
  //     }
  //     sessionStorage?.setItem(`feedback ${feedbacks[feedbacks.length - 1]?.id}`, 'notified')
  //   }
  //   setFeedbackLength(feedbacks.length)
  // }, [feedbacks.length])

  return (
    <div>
      <FeedbackSearchAndFilters
        disabled={sortedFeedbacks?.length === 0}
        {...filterProps}
      />

      <div className="flex flex-col gap-2 mt-4 overflow-y-auto">
        {/* // TODO: styling */}
        {!feedbacks ||
          (feedbacks.length === 0 && (
            <div>Bisher keine Feedbacks erhalten...</div>
          ))}

        {/* // TODO: styling */}
        {feedbacks &&
          feedbacks.length > 0 &&
          sortedFeedbacks &&
          sortedFeedbacks.length === 0 && (
            <div>
              Keine Feedbacks stimmen mit den aktuellen Filtereinstellungen
              überein...
            </div>
          )}

        {sortedFeedbacks?.map(
          ({
            id,
            content,
            createdAt,
            votes,
            isResolved,
            isPinned,
            isPublished,
            responses,
            resolvedAt,
          }: FeedbackType) => (
            <div className="flex flex-row print:mt-2" key={id}>
              {!isPublic && (
                <div className="flex-initial print:hidden">
                  <Button
                    className="justify-center mr-2 w-9 h-9"
                    onClick={() => {
                      handlePublishFeedback(id, !isPublished)
                    }}
                  >
                    {isPublished ? (
                      <Button.Icon>
                        <FontAwesomeIcon icon={faEye} />
                      </Button.Icon>
                    ) : (
                      <Button.Icon>
                        <FontAwesomeIcon icon={faEyeSlash} />
                      </Button.Icon>
                    )}
                  </Button>
                </div>
              )}
              <div className="flex-1">
                <Feedback
                  id={id}
                  content={content}
                  createdAt={createdAt}
                  pinned={isPinned}
                  resolved={isResolved}
                  resolvedAt={resolvedAt}
                  responses={responses as FeedbackResponse[]}
                  votes={votes}
                  onDeleteFeedback={() => handleDeleteFeedback(id)}
                  onDeleteResponse={(responseId) =>
                    handleDeleteFeedbackResponse(responseId)
                  }
                  onPinFeedback={(pinState) => handlePinFeedback(id, pinState)}
                  onResolveFeedback={(resolvedState) =>
                    handleResolveFeedback(id, resolvedState)
                  }
                  onRespondToFeedback={(id, response) =>
                    handleRespondToFeedback(id, response)
                  }
                />
              </div>
            </div>
          )
        )}

        {/* // TODO: still include this banner?
        {hasSurveyBannerInitialized && (isSurveyBannerVisible ?? true) && (
          <div className="mt-2 print:hidden">
            <Message
              warning
              content={
                <FormattedMessage
                  defaultMessage="If you have used our feedback-channel (Q&A) functionality, please consider participating in our 2-minute survey under this {link}."
                  id="runningSession.audienceInteraction.survey"
                  values={{
                    link: (
                      <a href="https://hi.switchy.io/6IeK" rel="noreferrer" target="_blank">
                        link
                      </a>
                    ),
                  }}
                />
              }
              icon="bullhorn"
              size="tiny"
              onDismiss={() => setIsSurveyBannerVisible(false)}
            />
          </div>
        )} */}
      </div>
    </div>
  )
}

FeedbackChannel.defaultProps = defaultProps

export default FeedbackChannel
