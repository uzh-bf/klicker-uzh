import React from 'react'
import PropTypes from 'prop-types'
import QRCode from 'qrcode.react'
import { Icon, Menu, Popup } from 'semantic-ui-react'

const propTypes = {
  sessionId: PropTypes.string,
}

const defaultProps = {
  sessionId: undefined,
}

const SessionArea = ({ sessionId }) => {
  // if a session is currently running, display details
  if (sessionId) {
    return (
      <Popup
        basic
        hideOnScroll
        className="sessionArea"
        on="click"
        position="bottom right"
        trigger={
          <Menu.Item name="session">
            /sessions/{sessionId} <Icon name="qrcode" />
          </Menu.Item>
        }
      >
        <Popup.Content>
          <QRCode value={`https://www.klicker.uzh.ch/sessions/${sessionId}`} />
        </Popup.Content>
      </Popup>
    )
  }

  // if no session is running, return a button allowing to start one
  // TODO: this should redirect to the question pool and activate creation mode
  // return <Button>Create session</Button>
  return null
}

SessionArea.propTypes = propTypes
SessionArea.defaultProps = defaultProps

export default SessionArea
