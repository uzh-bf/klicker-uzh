import React from 'react'
import PropTypes from 'prop-types'
import { Grid, Segment } from 'semantic-ui-react'

import withCSS from '../../lib/withCSS'

const Question = ({ head, id, title, type, version }) =>
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
        CAPM
      </Grid.Column>
      <Grid.Column floated="right" width="1">
        Risk
      </Grid.Column>
    </Grid.Row>
    <Segment as={Grid.Row} divided>
      <Grid.Column width="11">Test</Grid.Column>
      <Grid.Column color="grey" width="5">
        Zuletzt verwendet
      </Grid.Column>
    </Segment>

    <style jsx>{`
      .questions {
        margin-bottom: 30px;
      }
    `}</style>
  </Grid>)

Question.propTypes = {
  head: PropTypes.node.isRequired,
  id: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
  type: PropTypes.oneOf(['SC', 'MC', 'FREE']).isRequired,
  version: PropTypes.number,
}

Question.defaultProps = {
  version: 1,
}

export default withCSS(Question, ['grid', 'segment'])
