import React from 'react'
import PropTypes from 'prop-types'
import { Grid, Segment } from 'semantic-ui-react'

import withCSS from '../../lib/withCSS'

const Question = ({ head, id, title }) =>
  (
    <Segment>
      <Grid>
        <Grid.Row>
          <Grid.Column floated="left" width="12">
            {head}
            <strong>{id}</strong> - {title}
          </Grid.Column>
          <Grid.Column floated="right" width="1">MC</Grid.Column>
          <Grid.Column floated="right" width="1">CAPM</Grid.Column>
          <Grid.Column floated="right" width="1">Risk</Grid.Column>
        </Grid.Row>
        <Grid.Row>
          <Grid.Column width="11">Test</Grid.Column>
          <Grid.Column width="5">
           Zuletzt
          </Grid.Column>
        </Grid.Row>
      </Grid>
    </Segment>

  )

Question.propTypes = {
  head: PropTypes.node.isRequired,
  id: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
}

export default withCSS(Question, ['grid', 'segment'])
