import React from 'react'
import { Checkbox, Header } from 'semantic-ui-react'
import Feedback from './Feedback'

import withCSS from '../../../lib/withCSS'

const FeedbackChannel = () => (
  <div>
    <Header dividing as="h2" content="Feedback-Channel" />
    <Checkbox toggle label="Aktiviert" />
    <Checkbox toggle label="Fragen publizieren" />
    <div className="feedbacks">
      <Feedback />
    </div>
    <style jsx>{`
      .feedbacks {
        background: lightgrey;
        margin-top: .5rem;
      }
    `}</style>
  </div>
)

// TODO semantic-ui styling import
export default withCSS(FeedbackChannel, ['checkbox', 'header'])
