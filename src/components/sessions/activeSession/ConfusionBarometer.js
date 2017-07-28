import React from 'react'
import PropTypes from 'prop-types'
import { Checkbox, Header } from 'semantic-ui-react'

import withCSS from '../../../lib/withCSS'

const ConfusionBarometer = () => (
  <div>
    <Header dividing as="h2" content="Confusion-Barometer" />
    {/* TODO semantic-ui styling import */}
    <Checkbox toggle />
  </div>
)

ConfusionBarometer.propTypes = {
  head: PropTypes.node.isRequired,
}

export default withCSS(ConfusionBarometer, ['checkbox', 'header'])
