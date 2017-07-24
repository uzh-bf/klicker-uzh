import React from 'react'
import PropTypes from 'prop-types'
import { Grid, Segment } from 'semantic-ui-react'

import withCSS from '../../lib/withCSS'

const QuestionInSession = ({ head, id, title, type }) =>
  (<Segment as={Grid}>
    {head}
    <Grid.Row>
      <strong>{id}</strong> - {type}
    </Grid.Row>
    <Grid.Row>
      {title}
    </Grid.Row>
  </Segment>)

QuestionInSession.propTypes = {
  head: PropTypes.node.isRequired,
  id: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
  type: PropTypes.string.isRequired,
}

export default withCSS(QuestionInSession, ['segment'])
