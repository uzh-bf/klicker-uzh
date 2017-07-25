import React from 'react'
import PropTypes from 'prop-types'
import { Grid, Segment } from 'semantic-ui-react'

import withCSS from '../../lib/withCSS'

const Question = ({ head, id, lastUsed, tags, title, type, version }) =>
  (<Grid stackable className="questions">
    {head}

    <Grid.Row className="titleRow">
      <Grid.Column className="titleColumn" floated="left" width="11">
        <strong>{title}</strong> {version > 1 && `(v${version})`}
      </Grid.Column>
      <Grid.Column className="tag" floated="right">
        {type}
      </Grid.Column>
      {/* TODO vertical text align */}
      {tags.map(tag =>
        (<Grid.Column
          key={tag}
          className="tag"
          floated="right"
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

    {/* HACK: find way to not need !important statements */}
    <style jsx>{`
      :global(.tag) {
        border-top: solid 1px;
        border-left: solid 1px;
        height: 100%;
        margin: 0;
        padding: 0;
        text-align: center;
        position: relative;
      }

      :global(.tag) > span {
        vertical-align: middle;
      }

      :global(.tag:not(last-child)) {
        border-right: solid 1px;
        margin-right: 0;
      }

      :global(.titleRow) {
        padding-bottom: 0 !important;
      }

      :global(.titleColumn) {
        padding-bottom: 20px !important;
      }

      :global(.lowerSection) {
        background-color: #ededed !important;
        margin-top: 0 !important;
      }

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
