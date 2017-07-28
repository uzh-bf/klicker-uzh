import React from 'react'
import { Header } from 'semantic-ui-react'

import withCSS from '../../../lib/withCSS'

const ConfusionBarometer = () => (
  <div>
    <Header dividing as="h2" content="Confusion-Barometer" />
  </div>
)

export default withCSS(ConfusionBarometer, ['header'])
