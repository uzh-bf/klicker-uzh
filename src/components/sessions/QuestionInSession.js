import React from 'react'
import PropTypes from 'prop-types'
import { Divider, Grid, Segment } from 'semantic-ui-react'

import withCSS from '../../lib/withCSS'

const QuestionInSession = ({ head, id, title, type }) =>
  (<Segment as={Grid}>
    {head}
    <Grid.Row columns="2">
      <Grid.Column><strong>{id}</strong></Grid.Column>
      <Grid.Column>{type}</Grid.Column>
    </Grid.Row>
    <Divider />
    <Grid.Row>
      {title}
    </Grid.Row>
    <style jsx global>{`

    `}</style>
  </Segment>)

QuestionInSession.propTypes = {
  head: PropTypes.node.isRequired,
  id: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
  type: PropTypes.string.isRequired,
}

export default withCSS(QuestionInSession, ['segment'])
