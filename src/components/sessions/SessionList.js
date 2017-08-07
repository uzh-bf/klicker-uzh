import React from 'react'
import PropTypes from 'prop-types'
import { graphql } from 'react-apollo'

import Session from './Session'
import { SessionListQuery } from '../../queries/queries'

const SessionList = ({ data }) => {
  if (data.loading) {
    return <div>Loading</div>
  }

  if (data.error) {
    return <div>{data.error}</div>
  }

  return (
    <div>
      {data.sessions.map(session =>
        (<div className="session">
          <Session key={session.id} {...session} />
        </div>),
      )}

      <style jsx>{`
        .session {
          margin-bottom: 2rem;
        }
      `}</style>
    </div>
  )
}

SessionList.propTypes = {
  data: PropTypes.shape({
    sessions: PropTypes.arrayOf(
      PropTypes.shape({
        blocks: PropTypes.arrayOf({
          id: PropTypes.string.isRequired,
          questions: PropTypes.shape({
            id: PropTypes.string.isRequired,
            questionDefinition: PropTypes.shape({
              title: PropTypes.string.isRequired,
              type: PropTypes.string.isRequired,
            }).isRequired,
          }).isRequired,
        }).isRequired,
        createdAt: PropTypes.string.isRequired,
        id: PropTypes.string.isRequired,
        name: PropTypes.string.isRequired,
        status: PropTypes.string.isRequired,
        updatedAt: PropTypes.string.isRequired,
      }),
    ),
  }).isRequired,
}

export default graphql(SessionListQuery)(SessionList)
