import { useEffect, useState } from 'react'
import { Checkbox, Dropdown } from 'semantic-ui-react'
import { defineMessages, FormattedMessage, useIntl } from 'react-intl'

import Feedback from './Feedback'

const messages = defineMessages({
  activated: {
    defaultMessage: 'Activated',
    id: 'common.string.activated',
  },
  publishQuestions: {
    defaultMessage: 'Publish feedbacks',
    id: 'runningSession.feedbackChannel.publishFeedbacks',
  },
})

interface Props {
  feedbacks?: any[]
  handleActiveToggle: any
  handleDeleteFeedback: any
  handlePublicToggle: any
  handlePinFeedback: (id: string, pinState: boolean) => void
  handleResolveFeedback: (id: string, resolvedState: boolean) => void
  handleRespondToFeedback: (id: string, response: string) => void
  isActive?: boolean
  isPublic?: boolean
  subscribeToMore: any
}

const defaultProps = {
  feedbacks: [],
  isActive: false,
  isPublic: false,
}

function FeedbackChannel({
  feedbacks,
  isActive,
  isPublic,
  handleActiveToggle,
  handlePublicToggle,
  handleDeleteFeedback,
  handlePinFeedback,
  handleResolveFeedback,
  handleRespondToFeedback,
  subscribeToMore,
}: Props) {
  const [showResolved, setShowResolved] = useState(false)
  const [showOpen, setShowOpen] = useState(true)

  useEffect((): void => {
    if (subscribeToMore) {
      subscribeToMore()
    }
  }, [])

  const intl = useIntl()

  return (
    <div>
      <div>
        <FormattedMessage
          defaultMessage="The Feedback-Channel allows you to get open feedback from your participants. If you publish the feedbacks, your participants will be able to see what other participants have already posted."
          id="runningSession.feedbackChannel.info"
        />
      </div>

      <div className="flex flex-col mt-4 md:flex-row">
        <div>
          <Checkbox
            toggle
            checked={isActive}
            defaultChecked={isActive}
            label={intl.formatMessage(messages.activated)}
            onChange={handleActiveToggle}
          />
        </div>
        <div className="mt-4 md:ml-8 md:mt-0">
          <Checkbox
            toggle
            checked={isPublic}
            defaultChecked={isPublic}
            disabled={!isActive}
            label={intl.formatMessage(messages.publishQuestions)}
            onChange={handlePublicToggle}
          />
        </div>
      </div>

      <div>
        <Checkbox checked={showResolved} label="Resolved" onChange={() => setShowResolved((current) => !current)} />
        <Checkbox checked={showOpen} label="Open" onChange={() => setShowOpen((current) => !current)} />
        <Dropdown
          disabled={feedbacks?.length === 0}
          id="sortBy"
          options={[
            { content: 'Recency', value: 'recency' },
            { content: 'Upvotes', value: 'upvotes' },
          ]}
          value="upvotes"
        />
      </div>

      {isActive && (
        <div className="mt-4 overflow-y-auto">
          {feedbacks.map(({ id, content, createdAt, votes, resolved, pinned, responses }) => (
            <div className="mt-2 first:mt-0" key={id}>
              <Feedback
                content={content}
                createdAt={createdAt}
                pinned={pinned}
                resolved={resolved}
                responses={responses}
                votes={votes}
                onDelete={() => handleDeleteFeedback(id)}
                onPinFeedback={(pinState) => handlePinFeedback(id, pinState)}
                onResolveFeedback={(resolvedState) => handleResolveFeedback(id, resolvedState)}
                onRespondToFeedback={(response) => handleRespondToFeedback(id, response)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

FeedbackChannel.defaultProps = defaultProps

export default FeedbackChannel
