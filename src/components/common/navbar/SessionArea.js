import React from 'react'
import { Button, Divider, Icon, Image, Menu, Popup } from 'semantic-ui-react'
import { FormattedMessage } from 'react-intl'

const SessionArea = ({ sessionId }) => {
  const popupTrigger = (
    <Menu.Item name="session">
      /sessions/{sessionId} <Icon name="qrcode" />
    </Menu.Item>
  )

  return (
    <Popup
      basic
      hideOnScroll
      className="sessionArea"
      on="click"
      position="bottom right"
      trigger={popupTrigger}
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

export default SessionArea
