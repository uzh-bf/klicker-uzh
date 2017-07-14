import React from 'react'
import PropTypes from 'prop-types'
import { Grid } from 'semantic-ui-react'

const BaseLayout = ({ children }) =>
  (<Grid.Row>
    <Grid.Column>
      {children}
    </Grid.Column>
  </Grid.Row>)

BaseLayout.propTypes = {
  children: PropTypes.node.isRequired,
}

export default BaseLayout
