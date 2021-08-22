import React, { useEffect } from 'react'
import { Checkbox } from 'semantic-ui-react'
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
  subscribeToMore,
}: Props): React.ReactElement {
  useEffect((): void => {
    if (subscribeToMore) {
      subscribeToMore()
    }
  }, [subscribeToMore])

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

      {isActive && (
        <div className="mt-4">
          {feedbacks.map(
            ({ id, content, votes }): React.ReactElement => (
              <div className="mt-2 first:mt-0" key={id}>
                <Feedback content={content} votes={votes} onDelete={(): void => handleDeleteFeedback(id)} />
              </div>
            )
          )}
        </div>
      )}
    </div>
  )
}

FeedbackChannel.defaultProps = defaultProps

export default FeedbackChannel
