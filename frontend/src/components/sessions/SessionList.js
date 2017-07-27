import React from 'react'
import PropTypes from 'prop-types'
import { gql, graphql } from 'react-apollo'
import { Message } from 'semantic-ui-react'

import Session from './session/Session'

const SessionList = ({ data }) => {
  if (data.loading) {
    return <div>Loading</div>
  }

  if (data.error) {
    return (
      <Message error>
        {data.error}
      </Message>
    )
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

export default graphql(
  gql`
    {
      sessions: allSessions(orderBy: updatedAt_DESC) {
        id
        name
        blocks {
          id
          showSolutions
          timeLimit
          questions {
            id
            questionDefinition {
              title
              type
            }
          }
        }
        createdAt
        updatedAt
      }
    }
  `,
)(SessionList)
