import React from 'react'
import PropTypes from 'prop-types'
import { graphql } from 'react-apollo'

import Session from './Session'
import { SessionListQuery } from '../../queries/queries'

const propTypes = {
  data: PropTypes.shape({
    error: PropTypes.string,
    loading: PropTypes.bool.isRequired,
    sessions: PropTypes.array,
  }).isRequired,
}

const SessionList = ({ data }) => {
  if (data.loading) {
    return <div>Loading</div>
  }

  if (data.error) {
    return <div>{data.error}</div>
  }

  return (
    <div>
      {data.sessions.map(session => (
        <div className="session">
          <Session key={session.id} {...session} />
        </div>
      ))}

      <style jsx>
        {`
          .session {
            margin-bottom: 2rem;
          }
        `}
      </style>
    </div>
  )
}

SessionList.propTypes = propTypes

export default graphql(SessionListQuery)(SessionList)
