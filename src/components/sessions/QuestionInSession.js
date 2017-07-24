import React from 'react'
import PropTypes from 'prop-types'
import { Segment } from 'semantic-ui-react'

import withCSS from '../../lib/withCSS'

const QuestionInSession = ({ head, id, title, type }) =>
  (<Segment>
    {head}
    <strong>{id}</strong> - {title} - {type}
  </Segment>)

QuestionInSession.propTypes = {
  head: PropTypes.node.isRequired,
  id: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
  type: PropTypes.string.isRequired,
}

export default withCSS(QuestionInSession, ['segment'])
