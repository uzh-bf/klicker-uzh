import React from 'react'
import PropTypes from 'prop-types'
import QRCode from 'qrcode.react'
import { Icon, Menu, Popup } from 'semantic-ui-react'

const propTypes = {
  sessionId: PropTypes.string.isRequired,
}

const SessionArea = ({ sessionId }) => (
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
      <QRCode value={`https://react-uniz-klicker.appuioapp.ch/sessions/${sessionId}`} />
    </Popup.Content>
  </Popup>
)

SessionArea.propTypes = propTypes

export default SessionArea
