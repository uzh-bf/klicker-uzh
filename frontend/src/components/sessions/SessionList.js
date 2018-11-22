import React from 'react'
import PropTypes from 'prop-types'
import Router from 'next/router'
import { Loader, Message } from 'semantic-ui-react'
import { FormattedMessage, intlShape } from 'react-intl'
import { Query } from 'react-apollo'

import Session from './Session'
import { SessionListQuery } from '../../graphql'
import { SESSION_STATUS } from '../../constants'
import { buildIndex, filterSessions } from '../../lib'

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
  [SESSION_STATUS.PAUSED]: {
    icon: 'pause',
    message: <FormattedMessage defaultMessage="Continue" id="session.button.paused.content" />,
  },
}

const propTypes = {
  filters: PropTypes.object.isRequired,
  handleCopySession: PropTypes.func.isRequired,
  handleStartSession: PropTypes.func.isRequired,
  intl: intlShape.isRequired,
}

export const SessionListPres = ({ intl, filters, handleCopySession, handleStartSession }) => {
  // calculate what action to take on button click based on session status
  const handleSessionAction = (sessionId, status) => {
    if (status === SESSION_STATUS.CREATED || status === SESSION_STATUS.PAUSED) {
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

  return (
    <div className="sessionList">
      <Query query={SessionListQuery}>
        {({ data, error, loading }) => {
          if (loading) {
            return <Loader active />
          }

          if (error) {
            return <Message error>{error.message}</Message>
          }

          const { sessions } = data

          if (sessions.length === 0) {
            return (
              <div className="session">
                <FormattedMessage defaultMessage="No session was found." id="sessionList.string.noSessions" />
              </div>
            )
          }

          // extract the running session from all sessions
          const runningSessions = sessions
            .filter(session => session.status === SESSION_STATUS.RUNNING)
            .map(session => ({
              ...session,
              button: {
                ...statusCases[SESSION_STATUS.RUNNING],
                onClick: () => Router.push('/sessions/running'),
              },
            }))

          // extract paused sessions
          const pausedSessions = sessions
            .filter(session => session.status === SESSION_STATUS.PAUSED)
            .map(session => ({
              ...session,
              button: {
                ...statusCases[SESSION_STATUS.PAUSED],
                disabled: runningSessions.length > 0,
                onClick: handleSessionAction(session.id, session.status),
              },
            }))

          // create a session index
          const sessionIndex = buildIndex('sessions', sessions, ['name', 'createdAt'])

          const processedSessions = filterSessions(sessions, filters, sessionIndex).map(session => ({
            ...session,
            button: {
              ...statusCases[session.status],
              disabled: session.status === SESSION_STATUS.COMPLETED,
              hidden: session.status === SESSION_STATUS.COMPLETED,
              onClick: handleSessionAction(session.id, session.status),
            },
          }))

          const remainingSessions = processedSessions.filter(session => session.status === SESSION_STATUS.CREATED)
          const completedSessions = processedSessions.filter(session => session.status === SESSION_STATUS.COMPLETED)

          return (
            <>
              {runningSessions.length + pausedSessions.length > 0 ? (
                <div className="runningSessions">
                  <h2>
                    <FormattedMessage
                      defaultMessage="Running / paused sessions"
                      id="sessionList.title.runningSession"
                    />{' '}
                    ({runningSessions.length + pausedSessions.length})
                  </h2>
                  <div className="sessions">
                    {[...runningSessions, ...pausedSessions].map(running => (
                      <div className="runningSession">
                        <Session intl={intl} {...running} />
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="sessions">
                  <FormattedMessage
                    defaultMessage="No session is currently running."
                    id="sessionList.string.noSessionRunning"
                  />
                </div>
              )}

              {remainingSessions.length > 0 && (
                <>
                  <h2>
                    <FormattedMessage defaultMessage="Planned sessions" id="sessionList.title.plannedSessions" /> (
                    {remainingSessions.length})
                  </h2>
                  {remainingSessions.map(session => (
                    <div className="session" key={session.id}>
                      <Session intl={intl} {...session} />
                    </div>
                  ))}
                </>
              )}

              {completedSessions.length > 0 && (
                <>
                  <h2>
                    <FormattedMessage defaultMessage="Completed sessions" id="sessionList.title.completedSessions" /> (
                    {completedSessions.length})
                  </h2>
                  {completedSessions.map(session => (
                    <div className="session" key={session.id}>
                      <Session intl={intl} {...session} />
                    </div>
                  ))}
                </>
              )}
            </>
          )
        }}
      </Query>

      <style jsx>
        {`
          @import 'src/theme';

          .session,
          .sessions {
            margin-bottom: 1rem;
            padding: 0.5rem;
            border: 1px solid lightgrey;
            background-color: #f9f9f9;
          }

          .runningSessions {
            & > .sessions {
              background-color: #f9f9f9;
              border: 1px solid $color-primary;
            }

            .runningSession:not(:last-child) {
              margin-bottom: 0.5rem;
            }
          }
        `}
      </style>
    </div>
  )
}

SessionListPres.propTypes = propTypes

export default SessionListPres
