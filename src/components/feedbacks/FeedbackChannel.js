import React from 'react'
import PropTypes from 'prop-types'
import { Checkbox } from 'semantic-ui-react'
import { FormattedMessage, intlShape } from 'react-intl'
import { lifecycle } from 'recompose'

import Feedback from './Feedback'

const propTypes = {
  feedbacks: PropTypes.arrayOf(PropTypes.object),
  handleActiveToggle: PropTypes.func.isRequired,
  handleDeleteFeedback: PropTypes.func.isRequired,
  handlePublicToggle: PropTypes.func.isRequired,
  intl: intlShape.isRequired,
  isActive: PropTypes.bool,
  isPublic: PropTypes.bool,
}

const defaultProps = {
  feedbacks: [],
  isActive: false,
  isPublic: false,
}

const FeedbackChannel = ({
  feedbacks,
  intl,
  isActive,
  isPublic,
  handleActiveToggle,
  handlePublicToggle,
  handleDeleteFeedback,
}) => (
  <div className="feedbackChannel">
    <h2>
      <FormattedMessage
        defaultMessage="Feedback-Channel"
        id="runningSession.feedbackChannel.string.title"
      />
    </h2>
    <div className="toggle">
      <Checkbox
        toggle
        defaultChecked={isActive}
        label={intl.formatMessage({
          defaultMessage: 'Activated',
          id: 'common.string.activated',
        })}
        value={isActive}
        onChange={handleActiveToggle}
      />
    </div>
    <div className="toggle publicationToggle">
      <Checkbox
        toggle
        className="publishCheckbox"
        defaultChecked={isPublic}
        disabled={!isActive}
        label={intl.formatMessage({
          defaultMessage: 'Publish questions',
          id: 'runningSession.feedbackChannel.publishQuestions',
        })}
        value={isPublic}
        onChange={handlePublicToggle}
      />
    </div>

    {isActive && (
      <div className="feedbacks">
        {feedbacks.map(({ id, content, votes }) => (
          <div className="feedback">
            <Feedback
              content={content}
              key={id}
              votes={votes}
              onDelete={() => handleDeleteFeedback(id)}
            />
          </div>
        ))}
      </div>
    )}

    <style jsx>
      {`
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
          margin-bottom: 1rem;
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
      `}
    </style>
  </div>
)

FeedbackChannel.propTypes = propTypes
FeedbackChannel.defaultProps = defaultProps

export default lifecycle({
  componentDidMount() {
    this.props.subscribeToMore()
  },
})(FeedbackChannel)
