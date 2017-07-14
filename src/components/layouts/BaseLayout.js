import React from 'react'
import PropTypes from 'prop-types'
import { Grid } from 'semantic-ui-react'

const BaseLayout = ({ columnClasses, rowClasses, children }) =>
  (<Grid.Row className={rowClasses}>
    <Grid.Column className={columnClasses}>
      {children}
    </Grid.Column>
  </Grid.Row>)

BaseLayout.propTypes = {
  children: PropTypes.node.isRequired,
  columnClasses: PropTypes.string,
  rowClasses: PropTypes.string,
}

BaseLayout.defaultProps = {
  columnClasses: null,
  rowClasses: null,
}

export default BaseLayout
