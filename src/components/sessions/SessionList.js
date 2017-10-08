import React from 'react'
import PropTypes from 'prop-types'
import Router from 'next/router'
import { graphql } from 'react-apollo'
import { compose, withPropsOnChange, branch, renderComponent } from 'recompose'
import { FormattedMessage } from 'react-intl'

import Session from './Session'
import Loading from '../common/Loading'
import { SessionListQuery } from '../../queries/queries'

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
        <div key={session.id} className="session">
          <Session {...session} />
        </div>
      ))}

      <style jsx>
        {`
          .session {
            margin-bottom: 2rem;
          }
          .session.running {
          }
        `}
      </style>
    </div>
  )
}

SessionListPres.propTypes = propTypes
SessionListPres.defaultProps = defaultProps

// prepare possible status messages for different session stati
const statusCases = [
  {
    icon: 'play',
    message: <FormattedMessage id="session.button.created.content" defaultMessage="Start" />,
  },
  {
    icon: 'play',
    message: <FormattedMessage id="session.button.running.content" defaultMessage="Running" />,
  },
  {
    icon: 'copy',
    message: <FormattedMessage id="session.button.completed.content" defaultMessage="Copy" />,
  },
]

export default compose(
  graphql(SessionListQuery),
  branch(props => props.data.loading, renderComponent(Loading)),
  withPropsOnChange(
    ['data'],
    ({ data: { error, sessions }, handleCopySession, handleStartSession }) => {
      // calculate what action to take on button click based on session status
      const handleSessionAction = (sessionId, status) => {
        if (status === 0) {
          return handleStartSession(sessionId)
        }

        if (status === 1) {
          return () => Router.push('/sessions/running')
        }

        if (status === 2) {
          return handleCopySession(sessionId)
        }

        return () => null
      }

      // return the newly composed props
      return {
        error,
        runningSession: {
          ...sessions.filter(session => session.status === 1)[0],
          button: {
            ...statusCases[1],
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
