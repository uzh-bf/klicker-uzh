import React from 'react'
import PropTypes from 'prop-types'
import { Segment } from 'semantic-ui-react'

import withCSS from '../../lib/withCSS'

const Session = ({ head, id, title }) =>
  (<Segment>
    {head}
    <strong>{id}</strong> - {title}
  </Segment>)

Session.propTypes = {
  head: PropTypes.node.isRequired,
  id: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
}

export default withCSS(Session, ['segment'])
