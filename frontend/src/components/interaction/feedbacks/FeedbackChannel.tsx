import { Message, Button } from 'semantic-ui-react'
import { FormattedMessage } from 'react-intl'
import useFeedbackFilter from '../../../lib/hooks/useFeedbackFilter'
import Feedback from './Feedback'
import FeedbackSearchAndFilters from './FeedbackSearchAndFilters'

interface Props {
  feedbacks?: any[]
  handleActiveToggle: any
  handleDeleteFeedback: any
  handlePublicToggle: any
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
  const [sortedFeedbacks, filterProps] = useFeedbackFilter(feedbacks, { withSearch: true })

  return (
    <div>
      <FeedbackSearchAndFilters disabled={sortedFeedbacks?.length === 0} {...filterProps} />

      <div className="mt-4 overflow-y-auto">
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
            <div className="flex flex-row mt-4 print:mt-2 first:mt-0" key={id}>
              {!isPublic && (
                <div className="flex-initial print:hidden">
                  <Button
                    basic
                    compact
                    icon={published ? 'eye' : 'eye slash outline'}
                    onClick={() => {
                      handlePublishFeedback(id, !published)
                    }}
                  />
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
      </div>
    </div>
  )
}

FeedbackChannel.defaultProps = defaultProps

export default FeedbackChannel
