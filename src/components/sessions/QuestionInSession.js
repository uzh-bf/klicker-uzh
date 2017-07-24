import React from 'react'
import PropTypes from 'prop-types'
import { Divider, Grid, Segment } from 'semantic-ui-react'

import withCSS from '../../lib/withCSS'

const QuestionInSession = ({ head, id, title, type }) =>
  (<Segment as={Grid} className="questionInSession">
    {head}
    <Grid.Row className="titleRow" columns="2">
      <Grid.Column floated="left" width="8"><strong>{id}</strong></Grid.Column>
      <Grid.Column floated="right" width="1">{type}</Grid.Column>
    </Grid.Row>
    <Divider />
    <Grid.Row className="contentRow">
      {title}
    </Grid.Row>
    <style jsx global>{`
      .ui.grid.questionInSession {
        margin: 0;
      }
      .ui.grid.questionInSession > .row.titleRow {
        padding-top: 0;
        padding-bottom: 0;
      }
      .ui.grid.questionInSession > .row.titleRow > .column {
        padding-left: 0;
        padding-right: 0;
      }
    `}</style>
  </Segment>)

QuestionInSession.propTypes = {
  head: PropTypes.node.isRequired,
  id: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
  type: PropTypes.string.isRequired,
}

export default withCSS(QuestionInSession, ['segment'])
