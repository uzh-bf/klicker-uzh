import React from 'react'
import PropTypes from 'prop-types'
import { Checkbox } from 'semantic-ui-react'
import { FormattedMessage } from 'react-intl'

import Feedback from './Feedback'

import withCSS from '../../../../lib/withCSS'

const FeedbackChannel = ({ data, intl }) => (
  <div>
    <h2>
      {/* TODO correct naming of identifier */}
      <FormattedMessage
        defaultMessage="Feedback-Channel"
        id="pages.runningSession.feedbackChannel.title"
      />
    </h2>
    <Checkbox
      toggle
      label={intl.formatMessage({
        defaultMessage: 'Aktiviert',
        id: 'pages.runningSession.feedbackChannel.checkbox.activated', // TODO correct naming of identifier
      })}
    />
    <Checkbox
      toggle
      className="publishCheckbox"
      label={intl.formatMessage({
        defaultMessage: 'Fragen publizieren',
        id: 'pages.runningSession.feedbackChannel.checkbox.publishQuestions', // TODO correct naming of identifier
      })}
    />
    <div className="feedbacks">
      {
        data.map(({ content, id, votes }) => <Feedback key={id} content={content} votes={votes} />)
      }
    </div>
    <style jsx>{`
      .feedbacks {
        margin-top: .5rem;
      }
    `}</style>
  </div>
)

FeedbackChannel.propTypes = {
  data: PropTypes.arrayOf({
    content: PropTypes.string,
    id: PropTypes.string,
    votes: PropTypes.number,
  }).isRequired,
  intl: PropTypes.shape({
    formatMessage: PropTypes.func.isRequired,
  }).isRequired,
}

// TODO semantic-ui styling import
export default withCSS(FeedbackChannel, ['checkbox', 'header'])
