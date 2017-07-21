import React from 'react'
import PropTypes from 'prop-types'

import Session from './Session'

const SessionList = ({ data }) => {
  if (data.loading) {
    return <div>Loading</div>
  }

  return (
    <div>
      {data.allQuestions.map(session => <Session {...session} />)}
    </div>
  )
}

SessionList.propTypes = {
  data: PropTypes.shape({
    allSessions: PropTypes.arrayOf(
      PropTypes.shape({
        id: PropTypes.string.isRequired,
        title: PropTypes.string.isRequired,
      }),
    ),
  }).isRequired,
}

export default SessionList
