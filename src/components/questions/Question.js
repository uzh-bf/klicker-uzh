import React from 'react'
import PropTypes from 'prop-types'
import { Grid, Segment } from 'semantic-ui-react'

import withCSS from '../../lib/withCSS'

const tagList = ['MC', 'CAPM', 'Risk']

const Question = ({ head, id, title, type, version, lastUsed }) =>
  (<Grid className="questions">
    {head}

    <Grid.Row divided>
      <Grid.Column floated="left" width="12">
        <strong>#{id}</strong> - {title} {version > 1 && `(v${version})`}
      </Grid.Column>
      <Grid.Column floated="right" width="1">
        {type}
      </Grid.Column>
      <Grid.Column floated="right" width="1">
        {
          tagList.map(tag => console.log(tag))
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

    <style jsx>{`
      :global(.ui.grid .questions) {
        margin-bottom: 30px;
      }
      :global(.ui.segment) {
        margin: 0;
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
