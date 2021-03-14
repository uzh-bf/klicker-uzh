import React, { useEffect } from 'react'
import { defineMessages, FormattedMessage, useIntl } from 'react-intl'
import { Checkbox } from 'semantic-ui-react'
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
    subscribeToMore()
  }, [])

  const intl = useIntl()

  return (
    <div className="feedbackChannel">
      <h2>
        <FormattedMessage defaultMessage="Feedback-Channel" id="runningSession.feedbackChannel.string.title" />
      </h2>

      <div className="infoMessage">
        <FormattedMessage
          defaultMessage="The Feedback-Channel allows you to get open feedback from your participants. If you publish the feedbacks, your participants will be able to see what other participants have already posted."
          id="runningSession.feedbackChannel.info"
        />
      </div>

      <div className="toggle">
        <Checkbox
          toggle
          checked={isActive}
          defaultChecked={isActive}
          label={intl.formatMessage(messages.activated)}
          onChange={handleActiveToggle}
        />
      </div>
      <div className="toggle publicationToggle">
        <Checkbox
          toggle
          checked={isPublic}
          className="publishCheckbox"
          defaultChecked={isPublic}
          disabled={!isActive}
          label={intl.formatMessage(messages.publishQuestions)}
          onChange={handlePublicToggle}
        />
      </div>

      {isActive && (
        <div className="feedbacks">
          {feedbacks.map(
            ({ id, content, votes }): React.ReactElement => (
              <div className="feedback">
                <Feedback content={content} key={id} votes={votes} onDelete={(): void => handleDeleteFeedback(id)} />
              </div>
            )
          )}
        </div>
      )}

      <style jsx>{`
        @import 'src/theme';

        .feedbackChannel {
          display: flex;
          flex-direction: column;
        }

        h2,
        .toggle,
        .feedbacks {
          flex: 1;
        }

        h2 {
          margin-bottom: 0.5rem;
        }

        .infoMessage {
          color: 404040;
          margin-bottom: 0.5rem;
        }

        .publicationToggle {
          margin-top: 1rem;
        }

        .feedbacks {
          margin-top: 1rem;
        }

        .feedback:not(:last-child) {
          margin-bottom: 1rem;
        }

        @include desktop-tablet-only {
          .feedbackChannel {
            flex-flow: row wrap;
          }

          h2,
          .feedbacks {
            flex: 0 0 100%;
          }

          .toggle {
            flex: 0 0 auto;
          }

          .publicationToggle {
            margin: 0 0 0 2rem;
          }

          .feedback:not(:last-child) {
            margin-bottom: 0.5rem;
          }
        }
      `}</style>
    </div>
  )
}

FeedbackChannel.defaultProps = defaultProps

export default FeedbackChannel
