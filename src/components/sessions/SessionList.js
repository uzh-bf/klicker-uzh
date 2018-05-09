import React from 'react'
import PropTypes from 'prop-types'
import Router from 'next/router'
import { Loader, Message } from 'semantic-ui-react'
import { FormattedMessage } from 'react-intl'
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
}

const propTypes = {
  filters: PropTypes.object.isRequired,
  handleCopySession: PropTypes.func.isRequired,
  handleStartSession: PropTypes.func.isRequired,
}

export const SessionListPres = ({ filters, handleCopySession, handleStartSession }) => {
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

  return (
    <div className="sessionList">
      <Query query={SessionListQuery}>
        {({ data: { sessions }, error, loading }) => {
          if (loading) {
            return <Loader active />
          }

          if (error) {
            return <Message error>{error.message}</Message>
          }

          if (sessions.length === 0) {
            return (
              <div className="session">
                <FormattedMessage
                  defaultMessage="No session was found."
                  id="sessionList.string.noSessions"
                />
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

          // create a session index
          const sessionIndex = buildIndex('sessions', sessions, ['name', 'createdAt'])

          const processedSessions = filterSessions(sessions, filters, sessionIndex).map(
            session => ({
              ...session,
              button: {
                ...statusCases[session.status],
                disabled: session.status === SESSION_STATUS.COMPLETED,
                hidden: session.status === SESSION_STATUS.COMPLETED,
                onClick: handleSessionAction(session.id, session.status),
              },
            }),
          )

          const remainingSessions = processedSessions.filter(
            session => session.status === SESSION_STATUS.CREATED,
          )
          const completedSessions = processedSessions.filter(
            session => session.status === SESSION_STATUS.COMPLETED,
          )

          return (
            <React.Fragment>
              {runningSessions.length > 0 ? (
                <div className="runningSession">
                  <h2>
                    <FormattedMessage
                      defaultMessage="Running session"
                      id="sessionList.title.runningSession"
                    />
                  </h2>
                  <div className="session">
                    {runningSessions.map(running => <Session {...running} />)}
                  </div>
                </div>
              ) : (
                <div className="session">
                  <FormattedMessage
                    defaultMessage="No session is currently running."
                    id="sessionList.string.noSessionRunning"
                  />
                </div>
              )}

              {remainingSessions.length > 0 && (
                <React.Fragment>
                  <h2>
                    <FormattedMessage
                      defaultMessage="Planned sessions"
                      id="sessionList.title.plannedSessions"
                    />{' '}
                    ({remainingSessions.length})
                  </h2>
                  {remainingSessions.map(session => (
                    <div className="session" key={session.id}>
                      <Session {...session} />
                    </div>
                  ))}
                </React.Fragment>
              )}

              {completedSessions.length > 0 && (
                <React.Fragment>
                  <h2>
                    <FormattedMessage
                      defaultMessage="Completed sessions"
                      id="sessionList.title.completedSessions"
                    />{' '}
                    ({completedSessions.length})
                  </h2>
                  {completedSessions.map(session => (
                    <div className="session" key={session.id}>
                      <Session {...session} />
                    </div>
                  ))}
                </React.Fragment>
              )}
            </React.Fragment>
          )
        }}
      </Query>

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

export default SessionListPres
