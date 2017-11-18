import React from 'react'
import PropTypes from 'prop-types'
import Router from 'next/router'
import { graphql } from 'react-apollo'
import { compose, withPropsOnChange, branch, renderComponent } from 'recompose'
import { FormattedMessage } from 'react-intl'

import Session from './Session'
import { LoadingDiv } from '../common'
import { SessionListQuery } from '../../graphql/queries'
import { SessionStatus } from '../../constants'

const propTypes = {
  error: PropTypes.string,
  runningSession: PropTypes.object,
  sessions: PropTypes.array,
}

const defaultProps = {
  error: undefined,
  runningSession: undefined,
  sessions: [],
}

export const SessionListPres = ({ error, runningSession, sessions }) => {
  if (error) {
    return <div>{error}</div>
  }

  return (
    <div>
      {runningSession ? (
        <div className="session running">
          <h2>Running session</h2>
          <Session {...runningSession} />
        </div>
      ) : (
        <div className="session">No session is currently running.</div>
      )}

      {runningSession && <h2>Remaining sessions</h2>}
      {sessions.map(session => (
        <div className="session" key={session.id}>
          <Session {...session} />
        </div>
      ))}

      <style jsx>{`
        .session {
          margin-bottom: 2rem;
        }
      `}</style>
    </div>
  )
}

SessionListPres.propTypes = propTypes
SessionListPres.defaultProps = defaultProps

// prepare possible status messages for different session stati
const statusCases = {
  [SessionStatus.COMPLETED]: {
    icon: 'copy',
    message: <FormattedMessage defaultMessage="Copy" id="session.button.completed.content" />,
  },
  [SessionStatus.CREATED]: {
    icon: 'play',
    message: <FormattedMessage defaultMessage="Start" id="session.button.created.content" />,
  },
  [SessionStatus.RUNNING]: {
    icon: 'play',
    message: <FormattedMessage defaultMessage="Running" id="session.button.running.content" />,
  },
}

export default compose(
  graphql(SessionListQuery),
  branch(props => props.data.loading, renderComponent(LoadingDiv)),
  withPropsOnChange(
    ['data'],
    ({ data: { error, sessions }, handleCopySession, handleStartSession }) => {
      // calculate what action to take on button click based on session status
      const handleSessionAction = (sessionId, status) => {
        if (status === SessionStatus.CREATED) {
          return handleStartSession(sessionId)
        }

        if (status === SessionStatus.RUNNING) {
          return () => Router.push('/sessions/running')
        }

        if (status === SessionStatus.COMPLETED) {
          return handleCopySession(sessionId)
        }

        return () => null
      }

      // extract the running session from all sessions
      const runningSession = sessions.filter(session => session.status === SessionStatus.RUNNING)

      // return the newly composed props
      return {
        error,
        runningSession: runningSession.length === 1 && {
          ...runningSession[0],
          button: {
            ...statusCases[SessionStatus.RUNNING],
            onClick: () => Router.push('/sessions/running'),
          },
        },
        sessions: sessions.map(session => ({
          ...session,
          button: {
            ...statusCases[session.status],
            onClick: handleSessionAction(session.id, session.status),
          },
        })),
      }
    },
  ),
)(SessionListPres)
