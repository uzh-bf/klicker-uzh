import { useQuery } from '@apollo/client'
import { useRouter } from 'next/router'
import React from 'react'
import { FormattedMessage, useIntl } from 'react-intl'
import { Loader, Message } from 'semantic-ui-react'
import { SESSION_STATUS } from '../../constants'
import SessionListQuery from '../../graphql/queries/SessionListQuery.graphql'
import { buildIndex, filterByTitle } from '../../lib/utils/filters'
import Session from './Session'

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

// calculate what action to take on button click based on session status
function handleSessionAction(sessionId, status, router, handleStartSession, handleCopySession): any {
  if (status === SESSION_STATUS.CREATED || status === SESSION_STATUS.PAUSED) {
    return handleStartSession(sessionId)
  }

  if (status === SESSION_STATUS.RUNNING) {
    return (): Promise<boolean> => router.push('/sessions/running')
  }

  if (status === SESSION_STATUS.COMPLETED) {
    return handleCopySession(sessionId)
  }

  return (): void => null
}

interface Props {
  filters: any
  handleCopySession: any
  handleStartSession: any
}

function SessionList({ filters, handleCopySession, handleStartSession }: Props): React.ReactElement {
  const intl = useIntl()
  const router = useRouter()

  const { data, loading, error } = useQuery(SessionListQuery)

  return (
    <div className="sessionList">
      {((): React.ReactElement => {
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
          .filter((session): boolean => session.status === SESSION_STATUS.RUNNING)
          .map((session): any => ({
            ...session,
            ...session.settings,
            button: {
              ...statusCases[SESSION_STATUS.RUNNING],
              onClick: (): Promise<boolean> => router.push('/sessions/running'),
            },
          }))

        // extract paused sessions
        const pausedSessions = sessions
          .filter((session): boolean => session.status === SESSION_STATUS.PAUSED)
          .map((session): any => ({
            ...session,
            ...session.settings,
            button: {
              ...statusCases[SESSION_STATUS.PAUSED],
              disabled: runningSessions.length > 0,
              onClick: handleSessionAction(session.id, session.status, router, handleStartSession, handleCopySession),
            },
          }))

        // create a session index
        const sessionIndex = buildIndex('sessions', sessions, ['name', 'createdAt'])

        const processedSessions = filterByTitle(sessions, filters, sessionIndex).map((session): any => ({
          ...session,
          ...session.settings,
          button: {
            ...statusCases[session.status],
            disabled: session.status === SESSION_STATUS.COMPLETED,
            hidden: session.status === SESSION_STATUS.COMPLETED,
            onClick: handleSessionAction(session.id, session.status, router, handleStartSession, handleCopySession),
          },
        }))

        const remainingSessions = processedSessions.filter(
          (session): boolean => session.status === SESSION_STATUS.CREATED
        )
        const completedSessions = processedSessions.filter(
          (session): boolean => session.status === SESSION_STATUS.COMPLETED
        )

        return (
          <>
            {runningSessions.length + pausedSessions.length > 0 ? (
              <div className="runningSessions">
                <h2>
                  <FormattedMessage defaultMessage="Running / paused sessions" id="sessionList.title.runningSession" />{' '}
                  ({runningSessions.length + pausedSessions.length})
                </h2>
                <div className="sessions">
                  {[...runningSessions, ...pausedSessions].map(
                    (running): React.ReactElement => (
                      <div className="runningSession">
                        <Session intl={intl} {...running} />
                      </div>
                    )
                  )}
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
                {remainingSessions.map(
                  (session): React.ReactElement => (
                    <div className="session" key={session.id}>
                      <Session intl={intl} {...session} />
                    </div>
                  )
                )}
              </>
            )}

            {completedSessions.length > 0 && (
              <>
                <h2>
                  <FormattedMessage defaultMessage="Completed sessions" id="sessionList.title.completedSessions" /> (
                  {completedSessions.length})
                </h2>
                {completedSessions.map(
                  (session): React.ReactElement => (
                    <div className="session" key={session.id}>
                      <Session intl={intl} {...session} />
                    </div>
                  )
                )}
              </>
            )}
          </>
        )
      })()}

      <style jsx>{`
        @import 'src/theme';

        .session {
          padding-bottom: 1.5rem;
        }

        @include desktop-tablet-only {
          .session {
            padding: 1rem 0;
            border-top: 1px solid lightgrey;
          }
        }
      `}</style>
    </div>
  )
}

export default SessionList
