import React from 'react'
import PropTypes from 'prop-types'
import { Segment } from 'semantic-ui-react'

import withCSS from '../../lib/withCSS'

const Question = ({ head, id, title }) =>
  (
    <Segment.Group>
      <Segment.Group horizontal>
        <Segment>Hi</Segment>
        <Segment>Ho</Segment>
        <Segment>Ha</Segment>
      </Segment.Group>
      <Segment.Group horizontal>
        <Segment inverted secondary>
          {head}
          <strong>{id}</strong> - {title}
        </Segment>
        <Segment inverted color="pink">Zuletzt</Segment>
      </Segment.Group>
    </Segment.Group>
  )

Question.propTypes = {
  head: PropTypes.node.isRequired,
  id: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
}

export default withCSS(Question, ['segment'])
