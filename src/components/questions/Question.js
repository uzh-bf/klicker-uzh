import React from 'react'
import PropTypes from 'prop-types'
import { Grid, Segment } from 'semantic-ui-react'

import withCSS from '../../lib/withCSS'

const Question = ({ head, id, lastUsed, tags, title, type, version }) =>
  (<Grid stackable className="questions">
    {head}

    <Grid.Row className="titleRow">
      <Grid.Column className="title" floated="left" width="11">
        <strong>#{id}</strong> - {title} {version > 1 && `(v${version})`}
      </Grid.Column>
      <Grid.Column className="box type" floated="right">
        <b>
          {type}
        </b>
      </Grid.Column>
      {/* TODO vertical text align */
      tags.map(tag =>
        (<Grid.Column
          className="box tag"
          floated="right"
          key={tag}
          textAlign="center"
          verticalAlign="middle"
        >
          <span>
            {tag}
          </span>
        </Grid.Column>),
      )}
    </Grid.Row>
    <Segment divided as={Grid.Row} className="lowerSection">
      <Grid.Column width="13">Test</Grid.Column>
      <Grid.Column width="3">
        <div className="lastUsedTitle">Zuletzt verwendet</div>
        {lastUsed.map(date =>
          (<div key={date}>
            {date}
          </div>),
        )}
      </Grid.Column>
    </Segment>

    <style jsx global>{`
      .ui.grid.questions .ui.segment.lowerSection {
        background-color: #ededed;
      }
      .ui.grid.questions > .row.titleRow {
        padding-bottom: 0;
      }
      .ui.grid.questions > .row.titleRow > .column.box {
        border-top: solid 1px;
        border-left: solid 1px;
        height: 100%;
        margin: 0;
        padding: 0;
        text-align: center;
        position: relative;
      }
      .ui.grid.questions > .row.titleRow > .column.tag:last-child {
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
  lastUsed: PropTypes.arrayOf(PropTypes.string),
  tags: PropTypes.arrayOf(PropTypes.string),
  title: PropTypes.string.isRequired,
  type: PropTypes.oneOf(['SC', 'MC', 'FREE']).isRequired,
  version: PropTypes.number,
}

Question.defaultProps = {
  lastUsed: [],
  tags: [],
  version: 1,
}

export default withCSS(Question, ['grid', 'segment'])
