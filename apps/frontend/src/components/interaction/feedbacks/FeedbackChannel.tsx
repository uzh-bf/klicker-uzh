import { faEye, faEyeSlash } from '@fortawesome/free-regular-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Button } from '@uzh-bf/design-system'
import { useEffect, useState } from 'react'
import { defineMessages, FormattedMessage, useIntl } from 'react-intl'
import { Message } from 'semantic-ui-react'

import useFeedbackFilter from '../../../lib/hooks/useFeedbackFilter'
import useStickyState from '../../../lib/hooks/useStickyState'
import { createNotification, requestNotificationPermissions } from '../../../lib/utils/notifications'
import Feedback from './Feedback'
import FeedbackSearchAndFilters from './FeedbackSearchAndFilters'

const messages = defineMessages({
  notificationTitle: {
    defaultMessage: 'New Question / Feedback',
    id: 'feedbackchannel.notifications.title',
  },
})

interface Props {
  feedbacks?: any[]
  handleDeleteFeedback: any
  handlePinFeedback: (id: string, pinState: boolean) => void
  handlePublishFeedback: (id: string, publishState: boolean) => void
  handleResolveFeedback: (id: string, resolvedState: boolean) => void
  handleRespondToFeedback: (id: string, response: string) => void
  handleDeleteFeedbackResponse: (id: string, responseId: string) => void
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
  const [isSurveyBannerVisible, setIsSurveyBannerVisible, hasSurveyBannerInitialized] = useStickyState(
    true,
    'qa-survey-lecturer-visible'
  )

  const [sortedFeedbacks, filterProps] = useFeedbackFilter(feedbacks, { withSearch: true })
  const [feedbackLength, setFeedbackLength] = useState(0)
  const intl = useIntl()

  useEffect(() => {
    requestNotificationPermissions((permission) => {
      if (permission === 'granted') {
        setFeedbackLength(feedbacks.length)
      }
    })
  }, [])

  useEffect(() => {
    if (!sessionStorage?.getItem(`feedback ${feedbacks[feedbacks.length - 1]?.id}`)) {
      if (feedbacks.length > feedbackLength) {
        createNotification(intl.formatMessage(messages.notificationTitle), feedbacks[feedbacks.length - 1].content)
      }
      sessionStorage?.setItem(`feedback ${feedbacks[feedbacks.length - 1]?.id}`, 'notified')
    }
    setFeedbackLength(feedbacks.length)
  }, [feedbacks.length])

  return (
    <div>
      <FeedbackSearchAndFilters disabled={sortedFeedbacks?.length === 0} {...filterProps} />

      <div className="flex flex-col gap-2 mt-4 overflow-y-auto">
        {feedbacks.length === 0 && (
          <Message info>
            <FormattedMessage defaultMessage="No feedbacks received yet..." id="runningSession.info.nofeedbacks" />
          </Message>
        )}

        {feedbacks.length > 0 && sortedFeedbacks.length === 0 && (
          <Message info>
            <FormattedMessage
              defaultMessage="No feedbacks matching your current filter selection..."
              id="runningSession.info.nomatchingfeedbacks"
            />
          </Message>
        )}

        {sortedFeedbacks.map(
          ({ id, content, createdAt, votes, resolved, pinned, published, responses, resolvedAt }) => (
            <div className="flex flex-row print:mt-2" key={id}>
              {!isPublic && (
                <div className="flex-initial print:hidden">
                  <Button
                    className="justify-center mr-2 w-9 h-9"
                    onClick={() => {
                      handlePublishFeedback(id, !published)
                    }}
                  >
                    {published ? (
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
                  content={content}
                  createdAt={createdAt}
                  pinned={pinned}
                  resolved={resolved}
                  resolvedAt={resolvedAt}
                  responses={responses}
                  votes={votes}
                  onDeleteFeedback={() => handleDeleteFeedback(id)}
                  onDeleteResponse={(responseId) => handleDeleteFeedbackResponse(id, responseId)}
                  onPinFeedback={(pinState) => handlePinFeedback(id, pinState)}
                  onResolveFeedback={(resolvedState) => handleResolveFeedback(id, resolvedState)}
                  onRespondToFeedback={(response) => handleRespondToFeedback(id, response)}
                />
              </div>
            </div>
          )
        )}

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
        )}
      </div>
    </div>
  )
}

FeedbackChannel.defaultProps = defaultProps

export default FeedbackChannel
