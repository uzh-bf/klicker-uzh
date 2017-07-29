import React from 'react'
import { Checkbox, Header } from 'semantic-ui-react'

import Feedback from './Feedback'

import withCSS from '../../../lib/withCSS'

/* TODO: Correct implementation with graphQL */
const testData = [
  {
    content: 'Du bisch so hübsch!!',
    id: '1jkj090',
    votes: 1000,
  },
  {
    content: 'Was bedeutet das CAPM genau?',
    id: '10fghj89890',
    votes: 200,
  },
  {
    content: 'Super Vorlesung',
    id: '10jkjkj90',
    votes: 10,
  },
]

const FeedbackChannel = () => (
  <div>
    <Header dividing as="h2" content="Feedback-Channel" />
    <Checkbox toggle label="Aktiviert" />
    <Checkbox toggle label="Fragen publizieren" />
    <div className="feedbacks">
      {
        testData.map(({ content, votes }) => <Feedback content={content} votes={votes} />)
      }
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
