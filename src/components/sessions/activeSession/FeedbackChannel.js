import React from 'react'
import { Checkbox, Header } from 'semantic-ui-react'

import withCSS from '../../../lib/withCSS'

const FeedbackChannel = () => (
  <div>
    <Header dividing as="h2" content="Feedback-Channel" />
    {/* TODO semantic-ui styling import */}
    <Checkbox toggle />
  </div>
)

export default withCSS(FeedbackChannel, ['checkbox', 'header'])
