import React from 'react'
import PropTypes from 'prop-types'
import { Grid, Segment } from 'semantic-ui-react'

import withCSS from '../../lib/withCSS'

const Session = ({ head, id, title }) => (
  <Grid padded stackable className="session">
    {head}
    <Grid.Row className="titleRow">
      <Grid.Column width="12"><strong>{id}</strong> | {title}</Grid.Column>
      <Grid.Column width="4">Erstellt am 60.80.1000</Grid.Column>
    </Grid.Row>
    <Segment as={Grid.Row} className="questions">
      <Grid.Column>Hello World</Grid.Column>
    </Segment>
    <style jsx global>{`
      .ui.grid.session > .row.questions {
        margin-top: 0;
      }
    `}</style>
  </Grid>
)

Session.propTypes = {
  head: PropTypes.node.isRequired,
  id: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
}

export default withCSS(Session, ['grid', 'segment'])
