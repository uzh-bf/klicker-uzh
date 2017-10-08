import React from 'react'
import PropTypes from 'prop-types'
import { graphql } from 'react-apollo'
import { compose, withProps, branch, renderComponent } from 'recompose'

import Session from './Session'
import Loading from '../common/Loading'
import { SessionListQuery } from '../../queries/queries'

const propTypes = {
  error: PropTypes.string,
  handleStartSession: PropTypes.func.isRequired,
  sessions: PropTypes.array,
}

const defaultProps = {
  error: undefined,
  sessions: [],
}

export const SessionListPres = ({ error, handleStartSession, sessions }) => {
  if (error) {
    return <div>{error}</div>
  }

  return (
    <div>
      {sessions.map(session => (
        <div key={session.id} className="session">
          <Session {...session} handleStartSession={handleStartSession(session.id)} />
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

SessionListPres.propTypes = propTypes
SessionListPres.defaultProps = defaultProps

export default compose(
  graphql(SessionListQuery),
  branch(props => props.data.loading, renderComponent(Loading)),
  withProps(({ data: { error, sessions } }) => ({
    error,
    sessions,
  })),
)(SessionListPres)
