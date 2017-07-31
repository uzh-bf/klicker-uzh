import React from 'react'
import PropTypes from 'prop-types'
import { Checkbox, Header } from 'semantic-ui-react'

import Feedback from './Feedback'

import withCSS from '../../../../lib/withCSS'

const FeedbackChannel = ({ data }) => (
  <div>
    <Header dividing as="h2" content="Feedback-Channel" />
    <Checkbox toggle label="Aktiviert" />
    <Checkbox toggle className="publishCheckbox" label="Fragen publizieren" />
    <div className="feedbacks">
      {
        data.map(({ content, votes }) => <Feedback content={content} votes={votes} />)
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
}

// TODO semantic-ui styling import
export default withCSS(FeedbackChannel, ['checkbox', 'header'])
