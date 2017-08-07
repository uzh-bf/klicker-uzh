import React from 'react'
import PropTypes from 'prop-types'
import { Checkbox } from 'semantic-ui-react'
import { FormattedMessage } from 'react-intl'

import Feedback from './Feedback'

import withCSS from '../../../../lib/withCSS'

const FeedbackChannel = ({
  data,
  head,
  intl,
  isActive,
  isPublic,
  onActiveToggle,
  onPublicToggle,
}) =>
  (<div className="feedbackChannel">
    {head}

    <h2>
      <FormattedMessage
        defaultMessage="Feedback-Channel"
        id="runningSession.feedbackChannel.string.title"
      />
    </h2>

    <div className="toggle">
      <Checkbox
        toggle
        label={intl.formatMessage({
          defaultMessage: 'Activated',
          id: 'common.string.activated',
        })}
        value={isActive}
        onChange={onActiveToggle}
      />
    </div>
    <div className="toggle publicationToggle">
      <Checkbox
        toggle
        className="publishCheckbox"
        disabled={!isActive}
        label={intl.formatMessage({
          defaultMessage: 'Publish questions',
          id: 'runningSession.feedbackChannel.string.publishQuestions',
        })}
        value={isPublic}
        onChange={onPublicToggle}
      />
    </div>

    {isActive &&
      <div className="feedbacks">
        {data.map(({ content, id, votes }) =>
          (<div className="feedback">
            <Feedback key={id} content={content} votes={votes} />
          </div>),
        )}
      </div>}

    <style jsx>{`
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
          margin-bottom: .5rem;
        }
      }
    `}</style>
  </div>)

FeedbackChannel.propTypes = {
  data: PropTypes.arrayOf({
    content: PropTypes.string,
    id: PropTypes.string,
    votes: PropTypes.number,
  }).isRequired,
  head: PropTypes.node.isRequired, // head as injected by HOC
  intl: PropTypes.shape({
    formatMessage: PropTypes.func.isRequired,
  }).isRequired,
  isActive: PropTypes.bool.isRequired,
  isPublic: PropTypes.bool.isRequired,
  onActiveToggle: PropTypes.func.isRequired,
  onPublicToggle: PropTypes.func.isRequired,
}

export default withCSS(FeedbackChannel, ['checkbox'])
