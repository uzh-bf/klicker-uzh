import React from 'react'
import PropTypes from 'prop-types'
import QRCode from 'qrcode.react'
import { Icon, Menu, Popup } from 'semantic-ui-react'

const propTypes = {
  shortname: PropTypes.string.isRequired,
}

const SessionArea = ({ shortname }) => (
  <Popup
    basic
    hideOnScroll
    className="sessionArea"
    on="click"
    position="bottom right"
    trigger={
      <Menu.Item name="session">
        /join/{shortname} <Icon name="qrcode" />
      </Menu.Item>
    }
  >
    <Popup.Content>
      <QRCode value={`https://react-uniz-klicker.appuioapp.ch/join/${shortname}`} />
    </Popup.Content>
  </Popup>
)

SessionArea.propTypes = propTypes

export default SessionArea
