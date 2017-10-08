import React from 'react'
import PropTypes from 'prop-types'
import { Button, Divider, Icon, Image, Menu, Popup } from 'semantic-ui-react'
import { FormattedMessage } from 'react-intl'

const propTypes = {
  sessionId: PropTypes.string.isRequired,
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
          {/* TODO: QR code creation from session url */}
          <Image
            fluid
            src="http://www.rd.com/wp-content/uploads/sites/2/2016/02/06-train-cat-shake-hands.jpg"
          />
          <Divider />
          <Button fluid primary>
            <Icon name="download" />
            <FormattedMessage id="common.button.download" defaultMessage="Download" />
          </Button>
        </Popup.Content>
      </Popup>
    )
  }

  // if no session is running, return a button allowing to start one
  // TODO: this should redirect to the question pool and activate creation mode
  return <button>Create session</button>
}

SessionArea.propTypes = propTypes

export default SessionArea
