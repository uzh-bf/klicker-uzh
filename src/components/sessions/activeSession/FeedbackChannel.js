import React from 'react'
import { Header } from 'semantic-ui-react'

import withCSS from '../../../lib/withCSS'

const FeedbackChannel = () => (
  <div>
    <Header dividing as="h2" content="Feedback-Channel" />
  </div>
)

export default withCSS(FeedbackChannel, ['header'])
