import React from 'react'
import PropTypes from 'prop-types'
import { Checkbox } from 'semantic-ui-react'
import { intlShape, FormattedMessage } from 'react-intl'

import Feedback from './Feedback'

const propTypes = {
  data: PropTypes.arrayOf(Feedback.propTypes),
  handleActiveToggle: PropTypes.func.isRequired,
  handlePublicToggle: PropTypes.func.isRequired,
  intl: intlShape.isRequired,
  isActive: PropTypes.bool.isRequired,
  isPublic: PropTypes.bool.isRequired,
}

const defaultProps = {
  data: [],
  isActive: false,
  isPublic: false,
}

const FeedbackChannel = ({
  data,
  intl,
  isActive,
  isPublic,
  handleActiveToggle,
  handlePublicToggle,
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
          id: 'runningSession.feedbackChannel.string.publishQuestions',
        })}
        value={isPublic}
        onChange={handlePublicToggle}
      />
    </div>

    {isActive && (
      <div className="feedbacks">
        {data.map(({ content, key, votes }) => (
          <div className="feedback">
            <Feedback key={key} content={content} votes={votes} />
          </div>
        ))}
      </div>
    )}

    <style jsx>
      {`
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

        @media all and (min-width: 768px) {
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

export default FeedbackChannel
