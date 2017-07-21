import React from 'react'
import PropTypes from 'prop-types'
import { Grid, Segment } from 'semantic-ui-react'

import withCSS from '../../lib/withCSS'

// TODO only for testing
const tagList = ['CAPM']

const Question = ({ head, id, title, type, version, lastUsed }) =>
  (<Grid stackable className="questions">
    {head}

    <Grid.Row className="titleRow">
      <Grid.Column className="title" floated="left" width="12">
        <strong>#{id}</strong> - {title} {version > 1 && `(v${version})`}
      </Grid.Column>
      <Grid.Column floated="right" width="1">
        <b>{type}</b>
      </Grid.Column>
      <Grid.Column className="tagGroup" floated="right" width="1">
        {
          tagList.map(tag => <div className="tag" key={tag}>{tag}</div>)
        }
      </Grid.Column>
    </Grid.Row>
    <Segment as={Grid.Row}>
      <Grid.Column width="11">Test</Grid.Column>
      <Grid.Column color="grey" width="5">
        Zuletzt verwendet
        {
          lastUsed.map(date => <div key={date}>{date}</div>)
        }
      </Grid.Column>
    </Segment>

    <style jsx global>{`
      .ui.grid .questions {
        margin-bottom: 30px;
      }
      .ui.grid.questions > .row.titleRow {
        padding-bottom: 0;
      }
      .ui.grid.questions >.row.titleRow >.column.tagGroup {
        padding: 0;
      }
      .ui.grid.questions > .row.titleRow > .column.title {
        padding-bottom: 20px;
      }
      .ui.segment {
        margin: 0;
      }
    `}</style>
    <style jsx>{`
      .tag {
        border: solid 1px;
        height: 100%;
      }
      .tagGroup {
        display: inline;
      }
    `}</style>
  </Grid>)

Question.propTypes = {
  head: PropTypes.node.isRequired,
  id: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
  type: PropTypes.oneOf(['SC', 'MC', 'FREE']).isRequired,
  version: PropTypes.number,
  lastUsed: PropTypes.arrayOf(PropTypes.string),
}

Question.defaultProps = {
  version: 1,
  lastUsed: ['2017-08-08', '2016-09-09'], // TODO define default prop
}

export default withCSS(Question, ['grid', 'segment'])
