import React from 'react'
import PropTypes from 'prop-types'
import Router from 'next/router'
import { graphql } from 'react-apollo'
import { compose, withPropsOnChange, branch, renderComponent } from 'recompose'
import { FormattedMessage } from 'react-intl'

import Session from './Session'
import { LoadingDiv } from '../common'
import { SessionListQuery } from '../../graphql'
import { SESSION_STATUS } from '../../constants'

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

  const remainingSessions = sessions.filter(session => session.status === 'CREATED')
  const completedSessions = sessions.filter(session => session.status === 'COMPLETED')

  const sessionsAvailable = sessions.length !== 0
  const remainingSessionsAvailable = remainingSessions.length !== 0
  const completedSessionsAvailable = completedSessions.length !== 0

  return (
    <div>
      {!sessionsAvailable ? (
        <div className="session">
          <FormattedMessage
            defaultMessage="No session was found."
            id="sessionList.string.noSessions"
          />
        </div>
      ) : (
        []
      )}

      {sessionsAvailable && runningSession ? (
        <div className="runningSession">
          <h2>
            <FormattedMessage
              defaultMessage="Running session"
              id="sessionList.title.runningSession"
            />
          </h2>
          <div className="session">
            <Session {...runningSession} />
          </div>
        </div>
      ) : (
        []
      )}

      {sessionsAvailable && !runningSession ? (
        <div className="session">
          <FormattedMessage
            defaultMessage="No session is currently running."
            id="sessionList.string.noSessionRunning"
          />
        </div>
      ) : (
        []
      )}

      {remainingSessionsAvailable && (
        <h2>
          <FormattedMessage
            defaultMessage="Planned sessions"
            id="sessionList.title.plannedSessions"
          />{' '}
          ({remainingSessions.length})
        </h2>
      )}
      {remainingSessionsAvailable &&
        remainingSessions.map(session => (
          <div className="session" key={session.id}>
            <Session {...session} />
          </div>
        ))}

      {completedSessionsAvailable && (
        <h2>
          <FormattedMessage
            defaultMessage="Completed sessions"
            id="sessionList.title.completedSessions"
          />{' '}
          ({completedSessions.length})
        </h2>
      )}
      {completedSessionsAvailable &&
        completedSessions.map(session => (
          <div className="session" key={session.id}>
            <Session {...session} />
          </div>
        ))}

      <style jsx>{`
        @import 'src/theme';

        .session {
          margin-bottom: 1rem;
          padding: 0.5rem;
          border: 1px solid lightgrey;
          background-color: #f9f9f9;
        }

        .runningSession > .session {
          background-color: #f9f9f9;
          border: 1px solid $color-primary;
        }
      `}</style>
    </div>
  )
}

SessionListPres.propTypes = propTypes
SessionListPres.defaultProps = defaultProps

// prepare possible status messages for different session stati
const statusCases = {
  [SESSION_STATUS.COMPLETED]: {
    icon: 'copy',
    message: <FormattedMessage defaultMessage="Copy" id="session.button.completed.content" />,
  },
  [SESSION_STATUS.CREATED]: {
    icon: 'play',
    message: <FormattedMessage defaultMessage="Start" id="session.button.created.content" />,
  },
  [SESSION_STATUS.RUNNING]: {
    icon: 'play',
    message: <FormattedMessage defaultMessage="Running" id="session.button.running.content" />,
  },
}

export default compose(
  graphql(SessionListQuery),
  branch(({ data }) => data.loading, renderComponent(LoadingDiv)),
  withPropsOnChange(
    ['data'],
    ({ data: { error, sessions }, handleCopySession, handleStartSession }) => {
      // calculate what action to take on button click based on session status
      const handleSessionAction = (sessionId, status) => {
        if (status === SESSION_STATUS.CREATED) {
          return handleStartSession(sessionId)
        }

        if (status === SESSION_STATUS.RUNNING) {
          return () => Router.push('/sessions/running')
        }

        if (status === SESSION_STATUS.COMPLETED) {
          return handleCopySession(sessionId)
        }

        return () => null
      }

      // extract the running session from all sessions
      const runningSession = sessions.filter(session => session.status === SESSION_STATUS.RUNNING)

      // return the newly composed props
      return {
        error,
        runningSession: runningSession.length === 1 && {
          ...runningSession[0],
          button: {
            ...statusCases[SESSION_STATUS.RUNNING],
            onClick: () => Router.push('/sessions/running'),
          },
        },
        sessions: sessions.map(session => ({
          ...session,
          button: {
            ...statusCases[session.status],
            disabled: session.status === SESSION_STATUS.COMPLETED,
            hidden: session.status === SESSION_STATUS.COMPLETED,
            onClick: handleSessionAction(session.id, session.status),
          },
        })),
      }
    },
  ),
)(SessionListPres)
