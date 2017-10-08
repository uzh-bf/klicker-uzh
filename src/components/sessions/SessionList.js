import React from 'react'
import PropTypes from 'prop-types'
import { graphql } from 'react-apollo'
import { compose, withProps, branch, renderComponent } from 'recompose'
import { FormattedMessage } from 'react-intl'

import Session from './Session'
import Loading from '../common/Loading'
import { SessionListQuery } from '../../queries/queries'

const propTypes = {
  error: PropTypes.string,
  sessions: PropTypes.array,
}

const defaultProps = {
  error: undefined,
  sessions: [],
}

export const SessionListPres = ({ error, sessions }) => {
  if (error) {
    return <div>{error}</div>
  }

  return (
    <div>
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
        `}
      </style>
    </div>
  )
}

SessionListPres.propTypes = propTypes
SessionListPres.defaultProps = defaultProps

// prepare possible status messages for different session stati
const statusMessages = [
  <FormattedMessage id="session.button.created.content" defaultMessage="Start" />,
  <FormattedMessage id="session.button.running.content" defaultMessage="Running" />,
  <FormattedMessage id="session.button.completed.content" defaultMessage="Copy" />,
]

export default compose(
  graphql(SessionListQuery),
  branch(props => props.data.loading, renderComponent(Loading)),
  withProps(({ data: { error, sessions }, handleCopySession, handleStartSession }) => ({
    error,
    sessions: sessions.map(session => ({
      ...session,
      button: {
        disabled: session.status === 1,
        icon: session.status < 2 ? 'play' : 'copy',
        message: statusMessages[session.status],
        onClick:
          session.status < 2 ? handleStartSession(session.id) : handleCopySession(session.id),
      },
    })),
  })),
)(SessionListPres)
