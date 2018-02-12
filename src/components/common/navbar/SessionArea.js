import React from 'react'
import PropTypes from 'prop-types'
import Link from 'next/link'
import { Button, Icon, Menu } from 'semantic-ui-react'
import { FormattedMessage } from 'react-intl'

const propTypes = {
  sessionId: PropTypes.string,
  shortname: PropTypes.string.isRequired,
}

const defaultProps = {
  sessionId: undefined,
}

const SessionArea = ({ sessionId, shortname }) => (
  <React.Fragment>
    <Menu.Item>
      <Link prefetch href="/sessions/running">
        <Button icon primary disabled={!sessionId} labelPosition="left">
          <Icon name="play" />
          <FormattedMessage defaultMessage="To Running Session" id="sessionArea.toRunningSession" />
        </Button>
      </Link>
    </Menu.Item>

    <Menu.Item>
      <a href={`/join/${shortname}`} target="_blank">
        <Button icon labelPosition="left">
          <Icon name="external" />
          <FormattedMessage
            defaultMessage="To /join/{shortname}"
            id="sessionArea.toJoinSession"
            values={{ shortname }}
          />
        </Button>
      </a>
    </Menu.Item>
  </React.Fragment>
)

SessionArea.propTypes = propTypes
SessionArea.defaultProps = defaultProps

export default SessionArea
