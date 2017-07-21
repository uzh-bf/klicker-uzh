import React from 'react'
import PropTypes from 'prop-types'
import { Grid, Segment } from 'semantic-ui-react'

import withCSS from '../../lib/withCSS'

// TODO only for testing
const tagList = ['CAPM', 'Risk']

const Question = ({ head, id, title, type, version, lastUsed }) =>
  (<Grid stackable className="questions">
    {head}

    <Grid.Row className="titleRow">
      <Grid.Column className="title" floated="left" width="11">
        <strong>#{id}</strong> - {title} {version > 1 && `(v${version})`}
      </Grid.Column>
      <Grid.Column className="box type" floated="right"><b>{type}</b></Grid.Column>
      {
        /* TODO vertical text align */
        tagList.map(tag => <Grid.Column className="box tag" floated="right" key={tag}>{tag}</Grid.Column>)
      }
    </Grid.Row>
    <Segment divided as={Grid.Row} className="lowerSection">
      <Grid.Column width="13">Test</Grid.Column>
      <Grid.Column width="3">
        <div className="lastUsedTitle">Zuletzt verwendet</div>
        {
          lastUsed.map(date => <div key={date}>{date}</div>)
        }
      </Grid.Column>
    </Segment>

    <style jsx global>{`
      .ui.grid .questions {
        margin-bottom: 10px;
      }
      .ui.grid.questions .ui.segment.lowerSection {
        background-color: #ededed;
      }
      .ui.grid.questions > .row.titleRow {
        padding-bottom: 0;
      }
      .ui.grid.questions >.row.titleRow >.column.box {
        border-top: solid 1px;
        border-left: solid 1px;
        height: 100%;
        margin: 0;
        padding: 0;
        text-align: center;
        position: relative;
      }
      .ui.grid.questions >.row.titleRow >.column.tag:last-child {
        border-right: solid 1px;
        margin-right: 20px;
      }
      .ui.grid.questions > .row.titleRow > .column.title {
        padding-bottom: 20px;
      }
      .ui.segment {
        margin: 0;
      }
    `}</style>
    <style jsx>{`
      .lastUsedTitle {
        font-weight: bold;
        margin-bottom: 10px;
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
  lastUsed: ['2017-08-08 14:30:22', '2016-09-09 15:22:09'], // TODO define default prop
}

export default withCSS(Question, ['grid', 'segment'])
