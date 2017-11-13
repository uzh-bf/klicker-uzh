import React from 'react'
import PropTypes from 'prop-types'
import { FormattedMessage } from 'react-intl'

const propTypes = {
  totalResponses: PropTypes.number,
}

const defaultProps = {
  totalResponses: 0,
}

const Info = ({ totalResponses }) => (
  <div className="info">
    <FormattedMessage
      defaultMessage="Total participants:"
      id="teacher.evaluation.totalParticipants.label"
    />{' '}
    {totalResponses}
  </div>
)

Info.propTypes = propTypes
Info.defaultProps = defaultProps

export default Info
